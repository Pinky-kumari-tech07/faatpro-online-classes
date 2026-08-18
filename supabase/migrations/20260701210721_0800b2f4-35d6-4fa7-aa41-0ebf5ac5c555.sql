
-- ================================================================
-- ENTERPRISE ATTENDANCE MODULE — Phase 1 (Core)
-- ================================================================

-- 1) New enums
DO $$ BEGIN
  CREATE TYPE public.attendance_session_status AS ENUM ('draft','submitted','locked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.attendance_type AS ENUM
    ('live_class','recorded_lesson','offline_classroom','workshop','practical','exam','seminar');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Extend attendance_sessions
ALTER TABLE public.attendance_sessions
  ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES public.batches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lesson_id uuid REFERENCES public.lessons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS instructor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS attendance_type public.attendance_type NOT NULL DEFAULT 'offline_classroom',
  ADD COLUMN IF NOT EXISTS start_time time,
  ADD COLUMN IF NOT EXISTS end_time time,
  ADD COLUMN IF NOT EXISTS status public.attendance_session_status NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS submitted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_att_sess_ws_date  ON public.attendance_sessions(workspace_id, session_date DESC);
CREATE INDEX IF NOT EXISTS idx_att_sess_batch    ON public.attendance_sessions(batch_id);
CREATE INDEX IF NOT EXISTS idx_att_sess_course   ON public.attendance_sessions(course_id);
CREATE INDEX IF NOT EXISTS idx_att_sess_instr    ON public.attendance_sessions(instructor_id);

-- 3) Extend attendance_records
ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS marked_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS uniq_att_records_session_student
  ON public.attendance_records(session_id, student_id);
CREATE INDEX IF NOT EXISTS idx_att_rec_student ON public.attendance_records(student_id);
CREATE INDEX IF NOT EXISTS idx_att_rec_ws      ON public.attendance_records(workspace_id);

-- 4) Attendance settings (per workspace)
CREATE TABLE IF NOT EXISTS public.attendance_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL UNIQUE REFERENCES public.workspaces(id) ON DELETE CASCADE,
  minimum_attendance_percentage numeric(5,2) NOT NULL DEFAULT 75,
  attendance_lock_hours integer NOT NULL DEFAULT 24,
  late_threshold_minutes integer NOT NULL DEFAULT 10,
  working_days jsonb NOT NULL DEFAULT '["mon","tue","wed","thu","fri","sat"]'::jsonb,
  auto_attendance_enabled boolean NOT NULL DEFAULT false,
  qr_enabled boolean NOT NULL DEFAULT false,
  otp_enabled boolean NOT NULL DEFAULT false,
  geo_enabled boolean NOT NULL DEFAULT false,
  notify_on_absent boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_settings TO authenticated;
GRANT ALL ON public.attendance_settings TO service_role;
ALTER TABLE public.attendance_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "att_settings_read_members" ON public.attendance_settings;
CREATE POLICY "att_settings_read_members" ON public.attendance_settings FOR SELECT TO authenticated
USING (public.is_workspace_member(auth.uid(), workspace_id));

DROP POLICY IF EXISTS "att_settings_write_admin" ON public.attendance_settings;
CREATE POLICY "att_settings_write_admin" ON public.attendance_settings FOR ALL TO authenticated
USING (public.has_any_workspace_role(auth.uid(), workspace_id,
        ARRAY['organization_admin','super_admin','staff']::app_role[]))
WITH CHECK (public.has_any_workspace_role(auth.uid(), workspace_id,
        ARRAY['organization_admin','super_admin','staff']::app_role[]));

-- 5) Add certificate-rule columns to courses (default OFF)
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS require_attendance boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS min_attendance_percentage numeric(5,2) NOT NULL DEFAULT 75;

-- 6) updated_at triggers
DROP TRIGGER IF EXISTS trg_att_sessions_touch ON public.attendance_sessions;
CREATE TRIGGER trg_att_sessions_touch BEFORE UPDATE ON public.attendance_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_att_records_touch ON public.attendance_records;
CREATE TRIGGER trg_att_records_touch BEFORE UPDATE ON public.attendance_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_att_settings_touch ON public.attendance_settings;
CREATE TRIGGER trg_att_settings_touch BEFORE UPDATE ON public.attendance_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 7) Helper: is a session locked? (based on workspace lock hours + submitted_at)
CREATE OR REPLACE FUNCTION public.attendance_session_is_locked(_session_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  s public.attendance_sessions;
  lock_hours integer;
BEGIN
  SELECT * INTO s FROM public.attendance_sessions WHERE id = _session_id;
  IF NOT FOUND THEN RETURN true; END IF;
  IF s.status = 'locked' THEN RETURN true; END IF;
  SELECT COALESCE(attendance_lock_hours, 24) INTO lock_hours
    FROM public.attendance_settings WHERE workspace_id = s.workspace_id;
  IF s.submitted_at IS NULL OR lock_hours IS NULL THEN RETURN false; END IF;
  RETURN now() > s.submitted_at + make_interval(hours => lock_hours);
END $$;

-- 8) Instructor-scope helper: can this user manage the given session?
CREATE OR REPLACE FUNCTION public.can_manage_attendance_session(_user_id uuid, _session_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.attendance_sessions s
    WHERE s.id = _session_id
      AND (
        public.has_any_workspace_role(_user_id, s.workspace_id,
          ARRAY['organization_admin','super_admin','staff']::app_role[])
        OR s.instructor_id = _user_id
        OR s.created_by = _user_id
        OR public.is_course_instructor(_user_id, s.course_id)
      )
  );
$$;

-- 9) Admin unlock RPC
CREATE OR REPLACE FUNCTION public.attendance_unlock_session(_session_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE s public.attendance_sessions;
BEGIN
  SELECT * INTO s FROM public.attendance_sessions WHERE id=_session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Session not found'; END IF;
  IF NOT public.has_any_workspace_role(auth.uid(), s.workspace_id,
        ARRAY['organization_admin','super_admin']::app_role[]) THEN
    RAISE EXCEPTION 'Only admins can unlock attendance';
  END IF;
  UPDATE public.attendance_sessions
     SET status='draft', locked_at=NULL, submitted_at=NULL, updated_at=now()
   WHERE id=_session_id;
END $$;

-- 10) Attendance % for a student in a course
CREATE OR REPLACE FUNCTION public.attendance_percentage(_student_id uuid, _course_id uuid)
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    ROUND(
      100.0
      * COUNT(*) FILTER (WHERE r.status IN ('present','late'))
      / NULLIF(COUNT(*), 0)
    , 2), 0)
  FROM public.attendance_records r
  JOIN public.attendance_sessions s ON s.id = r.session_id
  WHERE r.student_id = _student_id
    AND s.course_id = _course_id
    AND s.status IN ('submitted','locked');
$$;

-- 11) RLS on sessions/records (rewrite to include instructor & student rules)
ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "att_sess_select" ON public.attendance_sessions;
CREATE POLICY "att_sess_select" ON public.attendance_sessions FOR SELECT TO authenticated
USING (
  public.has_any_workspace_role(auth.uid(), workspace_id,
      ARRAY['organization_admin','super_admin','staff']::app_role[])
  OR instructor_id = auth.uid()
  OR created_by = auth.uid()
  OR public.is_course_instructor(auth.uid(), course_id)
  OR EXISTS (SELECT 1 FROM public.enrollments e
             WHERE e.course_id = attendance_sessions.course_id AND e.student_id = auth.uid())
);

DROP POLICY IF EXISTS "att_sess_write" ON public.attendance_sessions;
CREATE POLICY "att_sess_write" ON public.attendance_sessions FOR ALL TO authenticated
USING (
  public.has_any_workspace_role(auth.uid(), workspace_id,
      ARRAY['organization_admin','super_admin','staff']::app_role[])
  OR instructor_id = auth.uid()
  OR created_by = auth.uid()
  OR public.is_course_instructor(auth.uid(), course_id)
)
WITH CHECK (
  public.has_any_workspace_role(auth.uid(), workspace_id,
      ARRAY['organization_admin','super_admin','staff']::app_role[])
  OR instructor_id = auth.uid()
  OR created_by = auth.uid()
  OR public.is_course_instructor(auth.uid(), course_id)
);

DROP POLICY IF EXISTS "att_rec_select" ON public.attendance_records;
CREATE POLICY "att_rec_select" ON public.attendance_records FOR SELECT TO authenticated
USING (
  public.has_any_workspace_role(auth.uid(), workspace_id,
      ARRAY['organization_admin','super_admin','staff']::app_role[])
  OR student_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.attendance_sessions s
             WHERE s.id = attendance_records.session_id
               AND (s.instructor_id = auth.uid() OR s.created_by = auth.uid()
                    OR public.is_course_instructor(auth.uid(), s.course_id)))
);

DROP POLICY IF EXISTS "att_rec_write" ON public.attendance_records;
CREATE POLICY "att_rec_write" ON public.attendance_records FOR ALL TO authenticated
USING (
  public.has_any_workspace_role(auth.uid(), workspace_id,
      ARRAY['organization_admin','super_admin','staff']::app_role[])
  OR EXISTS (SELECT 1 FROM public.attendance_sessions s
             WHERE s.id = attendance_records.session_id
               AND (s.instructor_id = auth.uid() OR s.created_by = auth.uid()
                    OR public.is_course_instructor(auth.uid(), s.course_id))
               AND NOT public.attendance_session_is_locked(s.id))
)
WITH CHECK (
  public.has_any_workspace_role(auth.uid(), workspace_id,
      ARRAY['organization_admin','super_admin','staff']::app_role[])
  OR EXISTS (SELECT 1 FROM public.attendance_sessions s
             WHERE s.id = attendance_records.session_id
               AND (s.instructor_id = auth.uid() OR s.created_by = auth.uid()
                    OR public.is_course_instructor(auth.uid(), s.course_id))
               AND NOT public.attendance_session_is_locked(s.id))
);

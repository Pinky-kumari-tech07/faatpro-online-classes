
-- Extend provider enum
ALTER TYPE public.live_class_provider ADD VALUE IF NOT EXISTS 'teams';

-- Make course optional and add new columns
ALTER TABLE public.live_classes
  ALTER COLUMN course_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS banner_url text,
  ADD COLUMN IF NOT EXISTS thumbnail_url text,
  ADD COLUMN IF NOT EXISTS max_participants integer,
  ADD COLUMN IF NOT EXISTS waiting_room boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recording_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS price numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bundle_id uuid REFERENCES public.course_bundles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES public.batches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS institution_id uuid REFERENCES public.institutions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_student_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Fix course_id foreign key null handling already fine.

CREATE INDEX IF NOT EXISTS idx_live_classes_public ON public.live_classes (is_public, starts_at DESC) WHERE is_public = true;

-- Grant anon read for public discovery (RLS still filters)
GRANT SELECT ON public.live_classes TO anon;

-- Refresh policies: allow public read for public classes and target-based access
DROP POLICY IF EXISTS "live_classes_read" ON public.live_classes;
CREATE POLICY "live_classes_public_read" ON public.live_classes
  FOR SELECT
  USING (
    is_public = true
    OR (auth.uid() IS NOT NULL AND (
      public.is_admin_or_staff_anywhere(auth.uid())
      OR (course_id IS NOT NULL AND public.is_course_instructor(auth.uid(), course_id))
      OR (course_id IS NOT NULL AND public.is_enrolled(auth.uid(), course_id))
      OR auth.uid() = ANY(assigned_student_ids)
      OR (bundle_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.student_bundles sb WHERE sb.bundle_id = live_classes.bundle_id AND sb.student_id = auth.uid() AND sb.status = 'active'
      ))
      OR (batch_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.batch_students bs WHERE bs.batch_id = live_classes.batch_id AND bs.student_id = auth.uid()
      ))
      OR (institution_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.institution_students ist WHERE ist.institution_id = live_classes.institution_id AND ist.student_id = auth.uid()
      ))
    ))
  );

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_live_classes_updated_at ON public.live_classes;
CREATE TRIGGER trg_live_classes_updated_at BEFORE UPDATE ON public.live_classes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Attendance table
DO $$ BEGIN
  CREATE TYPE public.live_class_attendance_status AS ENUM ('present','late','absent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.live_class_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  live_class_id uuid NOT NULL REFERENCES public.live_classes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL,
  status public.live_class_attendance_status NOT NULL DEFAULT 'absent',
  joined_at timestamptz,
  left_at timestamptz,
  total_minutes integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (live_class_id, student_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_class_attendance TO authenticated;
GRANT ALL ON public.live_class_attendance TO service_role;

ALTER TABLE public.live_class_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lca_student_own" ON public.live_class_attendance
  FOR ALL
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "lca_admin_manage" ON public.live_class_attendance
  FOR ALL
  USING (public.is_admin_or_staff_anywhere(auth.uid()))
  WITH CHECK (public.is_admin_or_staff_anywhere(auth.uid()));

CREATE POLICY "lca_instructor_read" ON public.live_class_attendance
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.live_classes lc
    WHERE lc.id = live_class_attendance.live_class_id
      AND lc.course_id IS NOT NULL
      AND public.is_course_instructor(auth.uid(), lc.course_id)
  ));

CREATE TRIGGER trg_lca_updated_at BEFORE UPDATE ON public.live_class_attendance
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_lca_class ON public.live_class_attendance (live_class_id);
CREATE INDEX IF NOT EXISTS idx_lca_student ON public.live_class_attendance (student_id);

-- Helper RPC: check if user is eligible to join a live class
CREATE OR REPLACE FUNCTION public.can_join_live_class(_class_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.live_classes lc
    WHERE lc.id = _class_id
      AND (
        lc.is_public = true
        OR (auth.uid() IS NOT NULL AND (
          public.is_admin_or_staff_anywhere(auth.uid())
          OR (lc.course_id IS NOT NULL AND public.is_course_instructor(auth.uid(), lc.course_id))
          OR (lc.course_id IS NOT NULL AND public.is_enrolled(auth.uid(), lc.course_id))
          OR auth.uid() = ANY(lc.assigned_student_ids)
          OR (lc.bundle_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.student_bundles sb WHERE sb.bundle_id = lc.bundle_id AND sb.student_id = auth.uid() AND sb.status = 'active'
          ))
          OR (lc.batch_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.batch_students bs WHERE bs.batch_id = lc.batch_id AND bs.student_id = auth.uid()
          ))
          OR (lc.institution_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.institution_students ist WHERE ist.institution_id = lc.institution_id AND ist.student_id = auth.uid()
          ))
        ))
      )
  );
$$;

-- Mark attendance RPC
CREATE OR REPLACE FUNCTION public.record_live_class_join(_class_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _lc public.live_classes;
  _uid uuid := auth.uid();
  _late_threshold_minutes int := 10;
  _now timestamptz := now();
  _status public.live_class_attendance_status;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO _lc FROM public.live_classes WHERE id = _class_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Class not found'; END IF;

  IF NOT public.can_join_live_class(_class_id) THEN
    RAISE EXCEPTION 'Not eligible to join';
  END IF;

  IF _now < _lc.starts_at - interval '5 minutes' THEN
    RAISE EXCEPTION 'Class has not started yet';
  END IF;

  IF _now > COALESCE(_lc.ends_at, _lc.starts_at + interval '3 hours') THEN
    RAISE EXCEPTION 'Class has ended';
  END IF;

  IF _now > _lc.starts_at + (_late_threshold_minutes || ' minutes')::interval THEN
    _status := 'late';
  ELSE
    _status := 'present';
  END IF;

  INSERT INTO public.live_class_attendance (live_class_id, student_id, workspace_id, status, joined_at)
  VALUES (_class_id, _uid, _lc.workspace_id, _status, _now)
  ON CONFLICT (live_class_id, student_id) DO UPDATE
    SET joined_at = COALESCE(public.live_class_attendance.joined_at, EXCLUDED.joined_at),
        status = CASE WHEN public.live_class_attendance.status = 'absent' THEN EXCLUDED.status ELSE public.live_class_attendance.status END,
        updated_at = now();
END $$;

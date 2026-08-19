
-- 1. Add 'suspended' status
ALTER TYPE public.course_status ADD VALUE IF NOT EXISTS 'suspended';

-- 2. Deletion request workflow
DO $$ BEGIN
  CREATE TYPE public.course_deletion_status AS ENUM ('pending','approved','rejected','archived','deleted','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.course_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason text,
  status public.course_deletion_status NOT NULL DEFAULT 'pending',
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_notes text,
  executed_at timestamptz,
  execution_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_deletion_requests TO authenticated;
GRANT ALL ON public.course_deletion_requests TO service_role;
ALTER TABLE public.course_deletion_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cdr_admin_manage" ON public.course_deletion_requests
  FOR ALL
  USING (public.is_admin_or_staff_anywhere(auth.uid()))
  WITH CHECK (public.is_admin_or_staff_anywhere(auth.uid()));

CREATE POLICY "cdr_workspace_read" ON public.course_deletion_requests
  FOR SELECT
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "cdr_instructor_request" ON public.course_deletion_requests
  FOR INSERT
  WITH CHECK (
    requested_by = auth.uid()
    AND (public.is_course_instructor(auth.uid(), course_id)
         OR public.is_admin_or_staff_anywhere(auth.uid()))
  );

CREATE TRIGGER trg_cdr_updated_at BEFORE UPDATE ON public.course_deletion_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_cdr_workspace_status ON public.course_deletion_requests (workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_cdr_course ON public.course_deletion_requests (course_id);

-- 3. Course audit log
CREATE TABLE IF NOT EXISTS public.course_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.course_audit_log TO authenticated;
GRANT ALL ON public.course_audit_log TO service_role;
ALTER TABLE public.course_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "course_audit_admin_read" ON public.course_audit_log
  FOR SELECT USING (public.is_admin_or_staff_anywhere(auth.uid()));
CREATE POLICY "course_audit_admin_insert" ON public.course_audit_log
  FOR INSERT WITH CHECK (public.is_admin_or_staff_anywhere(auth.uid()));

-- 4. RPCs

-- Instructor / admin requests deletion
CREATE OR REPLACE FUNCTION public.request_course_deletion(_course_id uuid, _reason text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _ws uuid; _existing uuid; _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT workspace_id INTO _ws FROM public.courses WHERE id = _course_id;
  IF _ws IS NULL THEN RAISE EXCEPTION 'Course not found'; END IF;
  IF NOT (public.is_course_instructor(auth.uid(), _course_id)
          OR public.is_admin_or_staff_anywhere(auth.uid())) THEN
    RAISE EXCEPTION 'Not authorized to request deletion';
  END IF;
  SELECT id INTO _existing FROM public.course_deletion_requests
    WHERE course_id = _course_id AND status = 'pending' LIMIT 1;
  IF _existing IS NOT NULL THEN RETURN _existing; END IF;

  INSERT INTO public.course_deletion_requests (workspace_id, course_id, requested_by, reason)
  VALUES (_ws, _course_id, auth.uid(), _reason)
  RETURNING id INTO _id;
  RETURN _id;
END $$;

-- Admin reviews (approve/reject)
CREATE OR REPLACE FUNCTION public.review_course_deletion(_request_id uuid, _approve boolean, _notes text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _r public.course_deletion_requests;
BEGIN
  IF NOT public.is_admin_or_staff_anywhere(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT * INTO _r FROM public.course_deletion_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF _r.status <> 'pending' THEN RAISE EXCEPTION 'Request already processed'; END IF;

  UPDATE public.course_deletion_requests
    SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
        reviewed_by = auth.uid(), reviewed_at = now(), review_notes = _notes
    WHERE id = _request_id;

  INSERT INTO public.course_audit_log (workspace_id, course_id, actor_id, action, details)
  VALUES (_r.workspace_id, _r.course_id, auth.uid(),
          CASE WHEN _approve THEN 'deletion_approved' ELSE 'deletion_rejected' END,
          jsonb_build_object('request_id', _request_id, 'notes', _notes));
END $$;

-- Admin archives a course (soft)
CREATE OR REPLACE FUNCTION public.admin_archive_course(_course_id uuid, _request_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _ws uuid;
BEGIN
  IF NOT public.is_admin_or_staff_anywhere(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT workspace_id INTO _ws FROM public.courses WHERE id = _course_id;
  IF _ws IS NULL THEN RAISE EXCEPTION 'Course not found'; END IF;
  UPDATE public.courses SET status = 'archived', updated_at = now() WHERE id = _course_id;
  IF _request_id IS NOT NULL THEN
    UPDATE public.course_deletion_requests
      SET status = 'archived', executed_at = now(), execution_type = 'archive'
      WHERE id = _request_id;
  END IF;
  INSERT INTO public.course_audit_log (workspace_id, course_id, actor_id, action, details)
  VALUES (_ws, _course_id, auth.uid(), 'archived', jsonb_build_object('request_id', _request_id));
END $$;

-- Admin suspends a course
CREATE OR REPLACE FUNCTION public.admin_suspend_course(_course_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _ws uuid;
BEGIN
  IF NOT public.is_admin_or_staff_anywhere(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT workspace_id INTO _ws FROM public.courses WHERE id = _course_id;
  IF _ws IS NULL THEN RAISE EXCEPTION 'Course not found'; END IF;
  UPDATE public.courses SET status = 'suspended', updated_at = now() WHERE id = _course_id;
  INSERT INTO public.course_audit_log (workspace_id, course_id, actor_id, action, details)
  VALUES (_ws, _course_id, auth.uid(), 'suspended', jsonb_build_object('reason', _reason));
END $$;

-- Admin restores (archived/suspended -> draft)
CREATE OR REPLACE FUNCTION public.admin_restore_course(_course_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _ws uuid;
BEGIN
  IF NOT public.is_admin_or_staff_anywhere(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT workspace_id INTO _ws FROM public.courses WHERE id = _course_id;
  IF _ws IS NULL THEN RAISE EXCEPTION 'Course not found'; END IF;
  UPDATE public.courses SET status = 'draft', updated_at = now() WHERE id = _course_id;
  INSERT INTO public.course_audit_log (workspace_id, course_id, actor_id, action, details)
  VALUES (_ws, _course_id, auth.uid(), 'restored', '{}'::jsonb);
END $$;

-- Admin permanent delete (only allowed once archived)
CREATE OR REPLACE FUNCTION public.admin_permanent_delete_course(_course_id uuid, _request_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _ws uuid; _status public.course_status; _enroll_count int;
BEGIN
  IF NOT public.is_admin_or_staff_anywhere(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT workspace_id, status INTO _ws, _status FROM public.courses WHERE id = _course_id;
  IF _ws IS NULL THEN RAISE EXCEPTION 'Course not found'; END IF;
  IF _status <> 'archived' THEN
    RAISE EXCEPTION 'Course must be archived before permanent deletion';
  END IF;
  SELECT count(*) INTO _enroll_count FROM public.enrollments WHERE course_id = _course_id AND status = 'active';
  IF _enroll_count > 0 THEN
    RAISE EXCEPTION 'Cannot delete: % active enrollments still exist', _enroll_count;
  END IF;

  INSERT INTO public.course_audit_log (workspace_id, course_id, actor_id, action, details)
  VALUES (_ws, _course_id, auth.uid(), 'permanent_delete', jsonb_build_object('request_id', _request_id));

  IF _request_id IS NOT NULL THEN
    UPDATE public.course_deletion_requests
      SET status = 'deleted', executed_at = now(), execution_type = 'permanent'
      WHERE id = _request_id;
  END IF;

  DELETE FROM public.courses WHERE id = _course_id;
END $$;

-- Admin reassigns instructor
CREATE OR REPLACE FUNCTION public.admin_reassign_course_instructor(_course_id uuid, _new_instructor_id uuid, _notes text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _ws uuid; _old uuid; _is_instr boolean;
BEGIN
  IF NOT public.is_admin_or_staff_anywhere(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT workspace_id, instructor_id INTO _ws, _old FROM public.courses WHERE id = _course_id;
  IF _ws IS NULL THEN RAISE EXCEPTION 'Course not found'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE profile_id = _new_instructor_id AND role = 'instructor'::app_role AND status = 'active'
  ) INTO _is_instr;
  IF NOT _is_instr THEN RAISE EXCEPTION 'Target user is not an active instructor'; END IF;

  UPDATE public.courses SET instructor_id = _new_instructor_id, updated_at = now() WHERE id = _course_id;

  INSERT INTO public.course_audit_log (workspace_id, course_id, actor_id, action, details)
  VALUES (_ws, _course_id, auth.uid(), 'instructor_reassigned',
          jsonb_build_object('from', _old, 'to', _new_instructor_id, 'notes', _notes));
END $$;

-- 5. Tighten course RLS: instructors cannot flip to archived/suspended/published themselves
-- (enforce_course_status_transitions already blocks most; make sure archived/suspended
--  aren't reachable by instructor path)
-- The existing trigger already restricts instructor status transitions; suspended/archived
-- are only reachable through the admin RPCs above (which run as SECURITY DEFINER).


-- 1) Allow admins/staff/super_admin to update student profiles (e.g. is_active)
DROP POLICY IF EXISTS "profiles_admin_update" ON public.profiles;
CREATE POLICY "profiles_admin_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_workspace_staff_anywhere(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_workspace_staff_anywhere(auth.uid()));

-- 2) Add fields needed by enrollment dialog
ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS validity_type text,
  ADD COLUMN IF NOT EXISTS notes text;

-- 3) RPC: admin enroll a student into a course (with validation + duplicate guard)
CREATE OR REPLACE FUNCTION public.admin_enroll_student_in_course(
  _student_id uuid,
  _course_id uuid,
  _validity_type text DEFAULT 'lifetime',
  _expires_at timestamptz DEFAULT NULL,
  _source text DEFAULT 'admin_assigned',
  _notes text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ws uuid;
  _course_status text;
  _is_student boolean;
  _existing uuid;
  _new_id uuid;
BEGIN
  SELECT workspace_id, status::text INTO _ws, _course_status
  FROM public.courses WHERE id = _course_id AND deleted_at IS NULL;
  IF _ws IS NULL THEN RAISE EXCEPTION 'Course not found'; END IF;
  IF _course_status <> 'published' THEN RAISE EXCEPTION 'Only published courses can be enrolled'; END IF;

  IF NOT public.has_any_workspace_role(auth.uid(), _ws,
       ARRAY['organization_admin'::app_role,'staff'::app_role,'super_admin'::app_role,'instructor'::app_role]) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE profile_id = _student_id AND role = 'student'::app_role
  ) INTO _is_student;
  IF NOT _is_student THEN RAISE EXCEPTION 'Selected user is not a student'; END IF;

  SELECT id INTO _existing FROM public.enrollments
   WHERE student_id = _student_id AND course_id = _course_id;
  IF _existing IS NOT NULL THEN RAISE EXCEPTION 'Student is already enrolled in this course'; END IF;

  INSERT INTO public.enrollments (
    workspace_id, course_id, student_id, status,
    access_expires_at, enrollment_type, validity_type, notes
  ) VALUES (
    _ws, _course_id, _student_id, 'active'::enrollment_status,
    _expires_at, _source::enrollment_source, _validity_type, _notes
  ) RETURNING id INTO _new_id;

  RETURN _new_id;
END $$;

-- 4) RPC: admin enroll into a bundle (validates published + student + duplicates)
CREATE OR REPLACE FUNCTION public.admin_enroll_student_in_bundle(
  _student_id uuid,
  _bundle_id uuid,
  _validity_type text DEFAULT 'lifetime',
  _expires_at timestamptz DEFAULT NULL,
  _source text DEFAULT 'admin_assigned',
  _notes text DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _b public.course_bundles;
  _is_student boolean;
  _existing uuid;
  _count integer := 0;
BEGIN
  SELECT * INTO _b FROM public.course_bundles WHERE id = _bundle_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bundle not found'; END IF;
  IF _b.status <> 'published' THEN RAISE EXCEPTION 'Only published bundles can be enrolled'; END IF;

  IF NOT public.has_any_workspace_role(auth.uid(), _b.workspace_id,
       ARRAY['organization_admin'::app_role,'staff'::app_role,'super_admin'::app_role,'instructor'::app_role]) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE profile_id = _student_id AND role = 'student'::app_role
  ) INTO _is_student;
  IF NOT _is_student THEN RAISE EXCEPTION 'Selected user is not a student'; END IF;

  SELECT id INTO _existing FROM public.student_bundles
   WHERE bundle_id = _bundle_id AND student_id = _student_id AND status = 'active';
  IF _existing IS NOT NULL THEN RAISE EXCEPTION 'Student is already enrolled in this bundle'; END IF;

  INSERT INTO public.student_bundles (
    bundle_id, student_id, workspace_id, source, assigned_by, access_expires_at
  ) VALUES (
    _bundle_id, _student_id, _b.workspace_id, _source, auth.uid(), _expires_at
  ) ON CONFLICT (bundle_id, student_id) DO UPDATE
    SET status = 'active', access_expires_at = EXCLUDED.access_expires_at;

  INSERT INTO public.enrollments (
    workspace_id, course_id, student_id, status, bundle_id,
    access_expires_at, enrollment_type, validity_type, notes
  )
  SELECT _b.workspace_id, bc.course_id, _student_id, 'active'::enrollment_status, _bundle_id,
         _expires_at, _source::enrollment_source, _validity_type, _notes
  FROM public.bundle_courses bc
  WHERE bc.bundle_id = _bundle_id
  ON CONFLICT (course_id, student_id) DO UPDATE
    SET status = 'active'::enrollment_status,
        bundle_id = COALESCE(public.enrollments.bundle_id, EXCLUDED.bundle_id),
        access_expires_at = COALESCE(EXCLUDED.access_expires_at, public.enrollments.access_expires_at);

  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END $$;

GRANT EXECUTE ON FUNCTION public.admin_enroll_student_in_course(uuid,uuid,text,timestamptz,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_enroll_student_in_bundle(uuid,uuid,text,timestamptz,text,text) TO authenticated;

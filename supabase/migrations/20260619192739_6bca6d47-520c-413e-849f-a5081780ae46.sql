-- =========================================================
-- Course Bundles
-- =========================================================
CREATE TABLE IF NOT EXISTS public.course_bundles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  short_description text,
  description text,
  thumbnail_url text,
  banner_url text,
  category text,
  tags text[] NOT NULL DEFAULT '{}',
  instructor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  regular_price numeric(12,2) NOT NULL DEFAULT 0,
  sale_price numeric(12,2),
  currency text NOT NULL DEFAULT 'INR',
  access_type text NOT NULL DEFAULT 'lifetime', -- lifetime|days|months|years
  access_duration integer,
  status text NOT NULL DEFAULT 'draft', -- draft|published|private
  certificate_mode text NOT NULL DEFAULT 'individual', -- individual|bundle|both
  is_featured boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, slug)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_bundles TO authenticated;
GRANT SELECT ON public.course_bundles TO anon;
GRANT ALL ON public.course_bundles TO service_role;
ALTER TABLE public.course_bundles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "course_bundles_public_read"
  ON public.course_bundles FOR SELECT USING (status = 'published');
CREATE POLICY "course_bundles_member_read"
  ON public.course_bundles FOR SELECT
  USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "course_bundles_admin_write"
  ON public.course_bundles FOR ALL
  USING (public.has_any_workspace_role(auth.uid(), workspace_id,
         ARRAY['organization_admin'::app_role,'staff'::app_role,'super_admin'::app_role,'instructor'::app_role]))
  WITH CHECK (public.has_any_workspace_role(auth.uid(), workspace_id,
         ARRAY['organization_admin'::app_role,'staff'::app_role,'super_admin'::app_role,'instructor'::app_role]));

CREATE TRIGGER trg_course_bundles_updated
  BEFORE UPDATE ON public.course_bundles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- Bundle <-> Course
-- =========================================================
CREATE TABLE IF NOT EXISTS public.bundle_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id uuid NOT NULL REFERENCES public.course_bundles(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  is_mandatory boolean NOT NULL DEFAULT true,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bundle_id, course_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bundle_courses TO authenticated;
GRANT SELECT ON public.bundle_courses TO anon;
GRANT ALL ON public.bundle_courses TO service_role;
ALTER TABLE public.bundle_courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bundle_courses_public_read"
  ON public.bundle_courses FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.course_bundles b
                 WHERE b.id = bundle_id AND b.status = 'published'));
CREATE POLICY "bundle_courses_member_read"
  ON public.bundle_courses FOR SELECT
  USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "bundle_courses_admin_write"
  ON public.bundle_courses FOR ALL
  USING (public.has_any_workspace_role(auth.uid(), workspace_id,
         ARRAY['organization_admin'::app_role,'staff'::app_role,'super_admin'::app_role,'instructor'::app_role]))
  WITH CHECK (public.has_any_workspace_role(auth.uid(), workspace_id,
         ARRAY['organization_admin'::app_role,'staff'::app_role,'super_admin'::app_role,'instructor'::app_role]));

CREATE INDEX IF NOT EXISTS idx_bundle_courses_bundle ON public.bundle_courses(bundle_id);
CREATE INDEX IF NOT EXISTS idx_bundle_courses_course ON public.bundle_courses(course_id);

-- =========================================================
-- Student <-> Bundle assignments
-- =========================================================
CREATE TABLE IF NOT EXISTS public.student_bundles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id uuid NOT NULL REFERENCES public.course_bundles(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'manual', -- purchase|manual|bulk|institution
  payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  institution_id uuid REFERENCES public.institutions(id) ON DELETE SET NULL,
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  access_expires_at timestamptz,
  status text NOT NULL DEFAULT 'active',
  UNIQUE (bundle_id, student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_bundles TO authenticated;
GRANT ALL ON public.student_bundles TO service_role;
ALTER TABLE public.student_bundles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student_bundles_self_read"
  ON public.student_bundles FOR SELECT
  USING (student_id = auth.uid()
         OR public.has_any_workspace_role(auth.uid(), workspace_id,
              ARRAY['organization_admin'::app_role,'staff'::app_role,'super_admin'::app_role,'instructor'::app_role]));
CREATE POLICY "student_bundles_admin_write"
  ON public.student_bundles FOR ALL
  USING (public.has_any_workspace_role(auth.uid(), workspace_id,
         ARRAY['organization_admin'::app_role,'staff'::app_role,'super_admin'::app_role]))
  WITH CHECK (public.has_any_workspace_role(auth.uid(), workspace_id,
         ARRAY['organization_admin'::app_role,'staff'::app_role,'super_admin'::app_role]));

CREATE INDEX IF NOT EXISTS idx_student_bundles_student ON public.student_bundles(student_id, workspace_id);

-- =========================================================
-- Add bundle_id to payments + enrollments
-- =========================================================
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS bundle_id uuid REFERENCES public.course_bundles(id) ON DELETE SET NULL;
ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS bundle_id uuid REFERENCES public.course_bundles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_enrollments_bundle ON public.enrollments(bundle_id);

-- =========================================================
-- Helper: compute access expiry
-- =========================================================
CREATE OR REPLACE FUNCTION public.bundle_access_expiry(_bundle_id uuid)
RETURNS timestamptz LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE _b public.course_bundles;
BEGIN
  SELECT * INTO _b FROM public.course_bundles WHERE id = _bundle_id;
  IF NOT FOUND OR _b.access_type = 'lifetime' OR _b.access_duration IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN now() + (_b.access_duration ||
    CASE _b.access_type WHEN 'days' THEN ' days'
                        WHEN 'months' THEN ' months'
                        WHEN 'years' THEN ' years' ELSE ' days' END)::interval;
END $$;

-- =========================================================
-- Enroll a student in all courses of a bundle
-- =========================================================
CREATE OR REPLACE FUNCTION public.enroll_student_in_bundle(
  _student_id uuid,
  _bundle_id uuid,
  _source text DEFAULT 'manual',
  _payment_id uuid DEFAULT NULL,
  _institution_id uuid DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _b public.course_bundles;
  _expiry timestamptz;
  _count integer := 0;
BEGIN
  SELECT * INTO _b FROM public.course_bundles WHERE id = _bundle_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bundle not found'; END IF;

  -- Authorization: caller must be admin/staff/instructor in workspace, or the student themself (purchase flow)
  IF auth.uid() IS NOT NULL
     AND auth.uid() <> _student_id
     AND NOT public.has_any_workspace_role(auth.uid(), _b.workspace_id,
           ARRAY['organization_admin'::app_role,'staff'::app_role,'super_admin'::app_role,'instructor'::app_role]) THEN
    RAISE EXCEPTION 'Not authorized to assign bundle';
  END IF;

  _expiry := public.bundle_access_expiry(_bundle_id);

  INSERT INTO public.student_bundles (bundle_id, student_id, workspace_id, source, payment_id, institution_id, assigned_by, access_expires_at)
  VALUES (_bundle_id, _student_id, _b.workspace_id, _source, _payment_id, _institution_id, auth.uid(), _expiry)
  ON CONFLICT (bundle_id, student_id) DO UPDATE
    SET status = 'active',
        access_expires_at = COALESCE(EXCLUDED.access_expires_at, public.student_bundles.access_expires_at);

  INSERT INTO public.enrollments (workspace_id, course_id, student_id, status, bundle_id, access_expires_at)
  SELECT _b.workspace_id, bc.course_id, _student_id, 'active'::enrollment_status, _bundle_id, _expiry
  FROM public.bundle_courses bc
  WHERE bc.bundle_id = _bundle_id
  ON CONFLICT (course_id, student_id) DO UPDATE
    SET status = 'active'::enrollment_status,
        bundle_id = COALESCE(public.enrollments.bundle_id, EXCLUDED.bundle_id),
        access_expires_at = COALESCE(EXCLUDED.access_expires_at, public.enrollments.access_expires_at);

  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END $$;

GRANT EXECUTE ON FUNCTION public.enroll_student_in_bundle(uuid, uuid, text, uuid, uuid) TO authenticated;

-- =========================================================
-- Trigger: when bundle payment is paid, auto-enroll
-- =========================================================
CREATE OR REPLACE FUNCTION public.trg_bundle_payment_paid()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.bundle_id IS NOT NULL
     AND NEW.status = 'paid'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM public.enroll_student_in_bundle(NEW.student_id, NEW.bundle_id, 'purchase', NEW.id, NULL);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_payments_bundle_paid ON public.payments;
CREATE TRIGGER trg_payments_bundle_paid
  AFTER INSERT OR UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.trg_bundle_payment_paid();

-- =========================================================
-- Bulk-assign bundle to an institution
-- =========================================================
CREATE OR REPLACE FUNCTION public.assign_bundle_to_institution(
  _bundle_id uuid,
  _institution_id uuid,
  _program text DEFAULT NULL,
  _semester text DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _b public.course_bundles;
  _r record;
  _count integer := 0;
BEGIN
  SELECT * INTO _b FROM public.course_bundles WHERE id = _bundle_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bundle not found'; END IF;
  IF NOT public.has_any_workspace_role(auth.uid(), _b.workspace_id,
       ARRAY['organization_admin'::app_role,'staff'::app_role,'super_admin'::app_role]) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  FOR _r IN
    SELECT student_id FROM public.institution_students
    WHERE institution_id = _institution_id
      AND workspace_id = _b.workspace_id
      AND (_program IS NULL OR program = _program)
      AND (_semester IS NULL OR semester = _semester)
  LOOP
    PERFORM public.enroll_student_in_bundle(_r.student_id, _bundle_id, 'institution', NULL, _institution_id);
    _count := _count + 1;
  END LOOP;
  RETURN _count;
END $$;

GRANT EXECUTE ON FUNCTION public.assign_bundle_to_institution(uuid, uuid, text, text) TO authenticated;

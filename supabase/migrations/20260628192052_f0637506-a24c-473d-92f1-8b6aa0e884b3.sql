
-- Profiles: legal name lock
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS legal_name text,
  ADD COLUMN IF NOT EXISTS legal_name_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS legal_name_locked boolean NOT NULL DEFAULT false;

-- Courses: opt-in certificate gating
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS cert_require_full_completion boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cert_require_quiz_pass boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cert_require_assignment_completion boolean NOT NULL DEFAULT false;

-- Enrollment metadata
DO $$ BEGIN
  CREATE TYPE public.enrollment_source AS ENUM ('individual','admin_assigned','bulk_import','corporate','college');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS batch_id uuid,
  ADD COLUMN IF NOT EXISTS enrollment_type public.enrollment_source NOT NULL DEFAULT 'individual';

-- Batches
CREATE TABLE IF NOT EXISTS public.batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL,
  description text,
  coordinator_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  start_date date,
  end_date date,
  validity_type text NOT NULL DEFAULT 'year_1',
  validity_custom_end date,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT batches_code_unique UNIQUE (workspace_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.batches TO authenticated;
GRANT ALL ON public.batches TO service_role;
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "batches_read" ON public.batches FOR SELECT
  USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "batches_manage" ON public.batches FOR ALL
  USING (public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role,'staff'::app_role,'super_admin'::app_role]))
  WITH CHECK (public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role,'staff'::app_role,'super_admin'::app_role]));

CREATE OR REPLACE FUNCTION public.batches_autocode() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $f$
DECLARE cand text; tries int := 0;
BEGIN
  IF NEW.code IS NULL OR length(trim(NEW.code))=0 THEN
    LOOP
      cand := 'BATCH-' || upper(substring(replace(gen_random_uuid()::text,'-',''),1,6));
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.batches WHERE workspace_id=NEW.workspace_id AND code=cand);
      tries := tries+1; IF tries>10 THEN EXIT; END IF;
    END LOOP;
    NEW.code := cand;
  END IF;
  RETURN NEW;
END $f$;
CREATE TRIGGER trg_batches_autocode BEFORE INSERT ON public.batches FOR EACH ROW EXECUTE FUNCTION public.batches_autocode();
CREATE TRIGGER trg_batches_updated BEFORE UPDATE ON public.batches FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Batch ↔ courses
CREATE TABLE IF NOT EXISTS public.batch_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (batch_id, course_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.batch_courses TO authenticated;
GRANT ALL ON public.batch_courses TO service_role;
ALTER TABLE public.batch_courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "batch_courses_rw" ON public.batch_courses FOR ALL
  USING (EXISTS (SELECT 1 FROM public.batches b WHERE b.id=batch_id AND public.has_any_workspace_role(auth.uid(), b.workspace_id, ARRAY['organization_admin'::app_role,'staff'::app_role,'super_admin'::app_role])))
  WITH CHECK (EXISTS (SELECT 1 FROM public.batches b WHERE b.id=batch_id AND public.has_any_workspace_role(auth.uid(), b.workspace_id, ARRAY['organization_admin'::app_role,'staff'::app_role,'super_admin'::app_role])));
CREATE POLICY "batch_courses_read" ON public.batch_courses FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.batches b WHERE b.id=batch_id AND public.is_workspace_member(auth.uid(), b.workspace_id)));

-- Batch ↔ students
CREATE TABLE IF NOT EXISTS public.batch_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  institution_id uuid REFERENCES public.institutions(id) ON DELETE SET NULL,
  roll_number text,
  registration_number text,
  department text,
  semester text,
  gender text,
  admission_date date,
  notes text,
  added_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (batch_id, student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.batch_students TO authenticated;
GRANT ALL ON public.batch_students TO service_role;
ALTER TABLE public.batch_students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "batch_students_rw" ON public.batch_students FOR ALL
  USING (EXISTS (SELECT 1 FROM public.batches b WHERE b.id=batch_id AND public.has_any_workspace_role(auth.uid(), b.workspace_id, ARRAY['organization_admin'::app_role,'staff'::app_role,'super_admin'::app_role])))
  WITH CHECK (EXISTS (SELECT 1 FROM public.batches b WHERE b.id=batch_id AND public.has_any_workspace_role(auth.uid(), b.workspace_id, ARRAY['organization_admin'::app_role,'staff'::app_role,'super_admin'::app_role])));
CREATE POLICY "batch_students_self_read" ON public.batch_students FOR SELECT
  USING (student_id = auth.uid());

-- Compute expiry
CREATE OR REPLACE FUNCTION public.compute_batch_expiry(_batch_id uuid) RETURNS timestamptz
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $f$
DECLARE b public.batches;
BEGIN
  SELECT * INTO b FROM public.batches WHERE id=_batch_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN CASE b.validity_type
    WHEN 'months_3' THEN now() + interval '3 months'
    WHEN 'months_6' THEN now() + interval '6 months'
    WHEN 'year_1' THEN now() + interval '1 year'
    WHEN 'year_2' THEN now() + interval '2 years'
    WHEN 'year_3' THEN now() + interval '3 years'
    WHEN 'lifetime' THEN NULL
    WHEN 'custom' THEN b.validity_custom_end::timestamptz
    ELSE now() + interval '1 year'
  END;
END $f$;

-- Bulk enroll: fan out (batch_student × batch_course) → enrollments
CREATE OR REPLACE FUNCTION public.bulk_enroll_batch_students(_batch_id uuid) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $f$
DECLARE _ws uuid; _exp timestamptz; _cnt int;
BEGIN
  SELECT workspace_id INTO _ws FROM public.batches WHERE id=_batch_id;
  IF _ws IS NULL THEN RETURN 0; END IF;
  _exp := public.compute_batch_expiry(_batch_id);
  INSERT INTO public.enrollments (workspace_id, course_id, student_id, status, batch_id, access_expires_at, enrollment_type, institution_id)
  SELECT _ws, bc.course_id, bs.student_id, 'active'::enrollment_status, _batch_id, _exp, 'bulk_import'::enrollment_source, bs.institution_id
  FROM public.batch_courses bc CROSS JOIN public.batch_students bs
  WHERE bc.batch_id=_batch_id AND bs.batch_id=_batch_id
  ON CONFLICT (course_id, student_id) DO UPDATE
    SET status='active', batch_id=EXCLUDED.batch_id,
        access_expires_at=COALESCE(EXCLUDED.access_expires_at, public.enrollments.access_expires_at),
        enrollment_type=EXCLUDED.enrollment_type;
  GET DIAGNOSTICS _cnt = ROW_COUNT;
  RETURN _cnt;
END $f$;

-- Triggers
CREATE OR REPLACE FUNCTION public.tg_batch_student_enroll() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $f$
DECLARE _ws uuid; _exp timestamptz;
BEGIN
  SELECT workspace_id INTO _ws FROM public.batches WHERE id=NEW.batch_id;
  _exp := public.compute_batch_expiry(NEW.batch_id);
  INSERT INTO public.workspace_members (workspace_id, profile_id, role, status)
  VALUES (_ws, NEW.student_id, 'student'::app_role, 'active'::member_status)
  ON CONFLICT (workspace_id, profile_id, role) DO NOTHING;
  INSERT INTO public.enrollments (workspace_id, course_id, student_id, status, batch_id, access_expires_at, enrollment_type, institution_id)
  SELECT _ws, bc.course_id, NEW.student_id, 'active'::enrollment_status, NEW.batch_id, _exp, 'bulk_import'::enrollment_source, NEW.institution_id
  FROM public.batch_courses bc WHERE bc.batch_id=NEW.batch_id
  ON CONFLICT (course_id, student_id) DO UPDATE
    SET status='active', batch_id=EXCLUDED.batch_id,
        access_expires_at=COALESCE(EXCLUDED.access_expires_at, public.enrollments.access_expires_at);
  RETURN NEW;
END $f$;
CREATE TRIGGER trg_batch_student_enroll AFTER INSERT ON public.batch_students FOR EACH ROW EXECUTE FUNCTION public.tg_batch_student_enroll();

CREATE OR REPLACE FUNCTION public.tg_batch_course_enroll() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $f$
DECLARE _ws uuid; _exp timestamptz;
BEGIN
  SELECT workspace_id INTO _ws FROM public.batches WHERE id=NEW.batch_id;
  _exp := public.compute_batch_expiry(NEW.batch_id);
  INSERT INTO public.enrollments (workspace_id, course_id, student_id, status, batch_id, access_expires_at, enrollment_type, institution_id)
  SELECT _ws, NEW.course_id, bs.student_id, 'active'::enrollment_status, NEW.batch_id, _exp, 'bulk_import'::enrollment_source, bs.institution_id
  FROM public.batch_students bs WHERE bs.batch_id=NEW.batch_id
  ON CONFLICT (course_id, student_id) DO UPDATE
    SET status='active', batch_id=EXCLUDED.batch_id,
        access_expires_at=COALESCE(EXCLUDED.access_expires_at, public.enrollments.access_expires_at);
  RETURN NEW;
END $f$;
CREATE TRIGGER trg_batch_course_enroll AFTER INSERT ON public.batch_courses FOR EACH ROW EXECUTE FUNCTION public.tg_batch_course_enroll();

-- Lock legal name on first certificate
CREATE OR REPLACE FUNCTION public.tg_lock_legal_name_on_cert() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $f$
BEGIN
  UPDATE public.profiles SET legal_name_locked = true WHERE id = NEW.student_id;
  RETURN NEW;
END $f$;
DROP TRIGGER IF EXISTS trg_lock_legal_name ON public.certificates;
CREATE TRIGGER trg_lock_legal_name AFTER INSERT ON public.certificates FOR EACH ROW EXECUTE FUNCTION public.tg_lock_legal_name_on_cert();

-- Prevent edits to legal_name once locked (except super admin)
CREATE OR REPLACE FUNCTION public.tg_guard_legal_name() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $f$
BEGIN
  IF OLD.legal_name_locked = true AND NEW.legal_name IS DISTINCT FROM OLD.legal_name THEN
    IF NOT public.is_super_admin(auth.uid()) THEN
      RAISE EXCEPTION 'Legal name is locked after certificate issuance and can only be changed by Super Admin.';
    END IF;
  END IF;
  RETURN NEW;
END $f$;
DROP TRIGGER IF EXISTS trg_guard_legal_name ON public.profiles;
CREATE TRIGGER trg_guard_legal_name BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_guard_legal_name();

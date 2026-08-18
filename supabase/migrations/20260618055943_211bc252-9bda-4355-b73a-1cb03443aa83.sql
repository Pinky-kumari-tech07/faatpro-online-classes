
-- 1. Enum for verification status
DO $$ BEGIN
  CREATE TYPE public.instructor_verification_status AS ENUM ('pending','approved','rejected','resubmission_required');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Table
CREATE TABLE IF NOT EXISTS public.instructor_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,

  -- Academic
  board_type text,
  board_certificate_url text,
  highest_qualification text,
  highest_qualification_certificate_url text,
  additional_certifications jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- KYC
  aadhaar_number text,
  aadhaar_front_url text,
  aadhaar_back_url text,
  pan_number text,
  pan_card_url text,

  -- Banking
  account_holder_name text,
  bank_account_number text,
  ifsc_code text,
  bank_name text,
  branch_name text,
  bank_document_url text,
  upi_id text,

  -- Contact
  registration_mobile text,
  whatsapp_number text,
  alternative_contact text,
  address text,
  city text,
  state text,
  country text,
  pin_code text,

  -- Verification
  verification_status public.instructor_verification_status NOT NULL DEFAULT 'pending',
  verification_notes text,
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Grants
GRANT SELECT, INSERT, UPDATE ON public.instructor_profiles TO authenticated;
GRANT ALL ON public.instructor_profiles TO service_role;

-- 4. RLS
ALTER TABLE public.instructor_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ip_select_self_or_admin" ON public.instructor_profiles
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_super_admin(auth.uid())
  OR (workspace_id IS NOT NULL AND public.has_any_workspace_role(
    auth.uid(), workspace_id,
    ARRAY['organization_admin'::app_role,'staff'::app_role,'super_admin'::app_role]
  ))
);

CREATE POLICY "ip_insert_self" ON public.instructor_profiles
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "ip_update_self_or_admin" ON public.instructor_profiles
FOR UPDATE TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_super_admin(auth.uid())
  OR (workspace_id IS NOT NULL AND public.has_any_workspace_role(
    auth.uid(), workspace_id,
    ARRAY['organization_admin'::app_role,'staff'::app_role,'super_admin'::app_role]
  ))
)
WITH CHECK (
  user_id = auth.uid()
  OR public.is_super_admin(auth.uid())
  OR (workspace_id IS NOT NULL AND public.has_any_workspace_role(
    auth.uid(), workspace_id,
    ARRAY['organization_admin'::app_role,'staff'::app_role,'super_admin'::app_role]
  ))
);

-- 5. updated_at trigger
CREATE TRIGGER ip_set_updated_at
  BEFORE UPDATE ON public.instructor_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6. Block instructors from self-approving (only admins can change verification fields)
CREATE OR REPLACE FUNCTION public.enforce_instructor_verification_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin boolean := public.is_admin_or_staff_anywhere(auth.uid());
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT is_admin THEN
      NEW.verification_status := 'pending';
      NEW.verification_notes := NULL;
      NEW.reviewed_by := NULL;
      NEW.reviewed_at := NULL;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NOT is_admin THEN
      NEW.verification_status := OLD.verification_status;
      NEW.verification_notes := OLD.verification_notes;
      NEW.reviewed_by := OLD.reviewed_by;
      NEW.reviewed_at := OLD.reviewed_at;
    ELSE
      IF NEW.verification_status IS DISTINCT FROM OLD.verification_status THEN
        NEW.reviewed_by := COALESCE(NEW.reviewed_by, auth.uid());
        NEW.reviewed_at := now();
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER ip_enforce_verification
  BEFORE INSERT OR UPDATE ON public.instructor_profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_instructor_verification_fields();

-- 7. Helper: is instructor verified?
CREATE OR REPLACE FUNCTION public.is_instructor_verified(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.instructor_profiles
    WHERE user_id = _user_id AND verification_status = 'approved'
  );
$$;

-- 8. Extend course-status trigger to block unverified instructors from submitting for review
CREATE OR REPLACE FUNCTION public.enforce_course_status_transitions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_staff boolean := public.is_admin_or_staff_anywhere(auth.uid());
BEGIN
  IF is_staff THEN
    IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status
       AND NEW.status IN ('approved','rejected','published') THEN
      NEW.reviewed_at := COALESCE(NEW.reviewed_at, now());
      NEW.reviewed_by := COALESCE(NEW.reviewed_by, auth.uid());
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status NOT IN ('draft') THEN
      RAISE EXCEPTION 'Instructors can only create courses in draft status';
    END IF;
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (
      (OLD.status = 'draft'          AND NEW.status = 'pending_review') OR
      (OLD.status = 'rejected'       AND NEW.status = 'pending_review') OR
      (OLD.status = 'pending_review' AND NEW.status = 'draft')          OR
      (OLD.status = 'approved'       AND NEW.status = 'draft')
    ) THEN
      RAISE EXCEPTION 'Instructors cannot change status from % to %', OLD.status, NEW.status;
    END IF;
    IF NEW.status = 'pending_review' THEN
      IF NOT public.is_instructor_verified(auth.uid()) THEN
        RAISE EXCEPTION 'Your instructor profile must be approved before submitting courses for review. Please complete KYC and wait for admin approval.';
      END IF;
      NEW.submitted_for_review_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

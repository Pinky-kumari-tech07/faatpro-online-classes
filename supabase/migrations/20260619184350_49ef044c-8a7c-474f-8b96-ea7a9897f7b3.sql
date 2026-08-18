-- ======================================================================
-- INSTITUTIONS
-- ======================================================================
CREATE TABLE IF NOT EXISTS public.institutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text,
  code text,
  logo_url text,
  contact_email text,
  contact_phone text,
  address text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.institutions TO authenticated;
GRANT ALL ON public.institutions TO service_role;

ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can read institutions"
  ON public.institutions FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Admins and staff can manage institutions"
  ON public.institutions FOR ALL TO authenticated
  USING (public.has_any_workspace_role(auth.uid(), workspace_id,
         ARRAY['organization_admin'::app_role, 'staff'::app_role, 'super_admin'::app_role]))
  WITH CHECK (public.has_any_workspace_role(auth.uid(), workspace_id,
         ARRAY['organization_admin'::app_role, 'staff'::app_role, 'super_admin'::app_role]));

CREATE TRIGGER trg_institutions_updated_at
  BEFORE UPDATE ON public.institutions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_institutions_workspace ON public.institutions(workspace_id);

-- ======================================================================
-- INSTITUTION_STUDENTS (mapping)
-- ======================================================================
CREATE TABLE IF NOT EXISTS public.institution_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  registration_number text,
  program text,
  semester text,
  academic_year text,
  enrollment_date date,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, student_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.institution_students TO authenticated;
GRANT ALL ON public.institution_students TO service_role;

ALTER TABLE public.institution_students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and staff manage institution_students"
  ON public.institution_students FOR ALL TO authenticated
  USING (public.has_any_workspace_role(auth.uid(), workspace_id,
         ARRAY['organization_admin'::app_role, 'staff'::app_role, 'super_admin'::app_role, 'instructor'::app_role]))
  WITH CHECK (public.has_any_workspace_role(auth.uid(), workspace_id,
         ARRAY['organization_admin'::app_role, 'staff'::app_role, 'super_admin'::app_role]));

CREATE POLICY "Students read their own institution mapping"
  ON public.institution_students FOR SELECT TO authenticated
  USING (student_id = auth.uid());

CREATE TRIGGER trg_institution_students_updated_at
  BEFORE UPDATE ON public.institution_students
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_inst_students_institution ON public.institution_students(institution_id);
CREATE INDEX IF NOT EXISTS idx_inst_students_student ON public.institution_students(student_id);
CREATE INDEX IF NOT EXISTS idx_inst_students_workspace ON public.institution_students(workspace_id);

-- ======================================================================
-- enrollments.institution_id (denormalized for fast filtering)
-- ======================================================================
ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS institution_id uuid REFERENCES public.institutions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_enrollments_institution ON public.enrollments(institution_id);

-- Auto-stamp enrollments.institution_id from institution_students at insert time.
CREATE OR REPLACE FUNCTION public.stamp_enrollment_institution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.institution_id IS NULL THEN
    SELECT institution_id INTO NEW.institution_id
    FROM public.institution_students
    WHERE student_id = NEW.student_id
      AND workspace_id = NEW.workspace_id
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_stamp_enrollment_institution ON public.enrollments;
CREATE TRIGGER trg_stamp_enrollment_institution
  BEFORE INSERT ON public.enrollments
  FOR EACH ROW EXECUTE FUNCTION public.stamp_enrollment_institution();

-- Backfill: stamp existing enrollments where the student already belongs to an institution.
UPDATE public.enrollments e
   SET institution_id = ist.institution_id
  FROM public.institution_students ist
 WHERE e.institution_id IS NULL
   AND ist.student_id = e.student_id
   AND ist.workspace_id = e.workspace_id;
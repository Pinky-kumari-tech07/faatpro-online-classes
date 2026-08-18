
CREATE TABLE public.student_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  workspace_id uuid,
  gender text,
  date_of_birth date,
  university_name text,
  academic_session text,
  course_program text,
  branch text,
  semester text,
  roll_number text,
  registration_number text,
  whatsapp_number text,
  address text,
  city text,
  state text,
  country text,
  pin_code text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_profiles TO authenticated;
GRANT ALL ON public.student_profiles TO service_role;

ALTER TABLE public.student_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sp_select_self_or_admin"
ON public.student_profiles FOR SELECT
USING (
  user_id = auth.uid()
  OR (workspace_id IS NOT NULL AND has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role,'staff'::app_role,'super_admin'::app_role,'instructor'::app_role]))
);

CREATE POLICY "sp_insert_self"
ON public.student_profiles FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "sp_update_self"
ON public.student_profiles FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE TRIGGER sp_set_updated_at
BEFORE UPDATE ON public.student_profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

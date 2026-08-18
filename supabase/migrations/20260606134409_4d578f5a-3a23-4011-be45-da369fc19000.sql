DROP POLICY IF EXISTS courses_insert ON public.courses;
CREATE POLICY courses_insert ON public.courses
FOR INSERT TO authenticated
WITH CHECK (
  has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role, 'staff'::app_role, 'super_admin'::app_role])
);
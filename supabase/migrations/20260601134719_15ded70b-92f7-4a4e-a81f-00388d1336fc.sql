-- Drop overly-broad admin manage policy and split into granular policies
DROP POLICY IF EXISTS courses_admin_manage ON public.courses;
DROP POLICY IF EXISTS courses_instructor_update ON public.courses;
DROP POLICY IF EXISTS courses_insert ON public.courses;
DROP POLICY IF EXISTS courses_update ON public.courses;
DROP POLICY IF EXISTS courses_delete ON public.courses;

-- INSERT: org_admin, staff, super_admin can insert any; instructors only if they set themselves as instructor_id
CREATE POLICY courses_insert ON public.courses
FOR INSERT TO authenticated
WITH CHECK (
  has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role, 'staff'::app_role, 'super_admin'::app_role])
  OR (
    has_workspace_role(auth.uid(), workspace_id, 'instructor'::app_role)
    AND instructor_id = auth.uid()
  )
);

-- UPDATE: org_admin, staff, super_admin OR instructor owning the course
CREATE POLICY courses_update ON public.courses
FOR UPDATE TO authenticated
USING (
  has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role, 'staff'::app_role, 'super_admin'::app_role])
  OR instructor_id = auth.uid()
)
WITH CHECK (
  has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role, 'staff'::app_role, 'super_admin'::app_role])
  OR instructor_id = auth.uid()
);

-- DELETE: only organization_admin and super_admin
CREATE POLICY courses_delete ON public.courses
FOR DELETE TO authenticated
USING (
  has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role, 'super_admin'::app_role])
);
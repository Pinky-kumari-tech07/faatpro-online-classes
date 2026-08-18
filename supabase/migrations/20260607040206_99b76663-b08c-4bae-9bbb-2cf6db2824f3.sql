DROP POLICY IF EXISTS courses_not_deleted_select ON public.courses;
DROP POLICY IF EXISTS courses_update ON public.courses;
DROP POLICY IF EXISTS courses_delete ON public.courses;

CREATE POLICY courses_not_deleted_select
ON public.courses
AS RESTRICTIVE
FOR SELECT
TO public
USING (
  deleted_at IS NULL
  OR public.is_super_admin(auth.uid())
  OR public.has_any_workspace_role(
    auth.uid(),
    workspace_id,
    ARRAY['organization_admin'::public.app_role, 'super_admin'::public.app_role]
  )
);

CREATE POLICY courses_update
ON public.courses
FOR UPDATE
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.has_any_workspace_role(
    auth.uid(),
    workspace_id,
    ARRAY['organization_admin'::public.app_role, 'staff'::public.app_role, 'super_admin'::public.app_role]
  )
  OR instructor_id = auth.uid()
  OR public.is_course_instructor(auth.uid(), id)
)
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR public.has_any_workspace_role(
    auth.uid(),
    workspace_id,
    ARRAY['organization_admin'::public.app_role, 'staff'::public.app_role, 'super_admin'::public.app_role]
  )
  OR instructor_id = auth.uid()
  OR public.is_course_instructor(auth.uid(), id)
);

CREATE POLICY courses_delete
ON public.courses
FOR DELETE
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.has_any_workspace_role(
    auth.uid(),
    workspace_id,
    ARRAY['organization_admin'::public.app_role, 'super_admin'::public.app_role]
  )
);
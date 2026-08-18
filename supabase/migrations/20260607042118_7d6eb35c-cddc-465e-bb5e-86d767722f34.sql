CREATE OR REPLACE FUNCTION public.is_admin_anywhere(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members
    WHERE profile_id = _user_id
      AND status = 'active'
      AND role IN ('organization_admin'::public.app_role, 'super_admin'::public.app_role)
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin_anywhere(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin_or_staff_anywhere(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_workspace_staff_anywhere(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_workspace_role(uuid, uuid, public.app_role) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_any_workspace_role(uuid, uuid, public.app_role[]) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_workspace_member(uuid, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_course_instructor(uuid, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_any_course_instructor(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_enrolled(uuid, uuid) TO anon, authenticated, service_role;

DROP POLICY IF EXISTS courses_not_deleted_select ON public.courses;
CREATE POLICY courses_not_deleted_select
ON public.courses
AS RESTRICTIVE
FOR SELECT
TO public
USING (
  deleted_at IS NULL
  OR public.is_admin_anywhere(auth.uid())
);

DROP POLICY IF EXISTS courses_update ON public.courses;
CREATE POLICY courses_update
ON public.courses
FOR UPDATE
TO authenticated
USING (
  public.is_admin_anywhere(auth.uid())
  OR (
    deleted_at IS NULL
    AND (
      public.has_any_workspace_role(
        auth.uid(),
        workspace_id,
        ARRAY['organization_admin'::public.app_role, 'staff'::public.app_role, 'super_admin'::public.app_role]
      )
      OR instructor_id = auth.uid()
      OR public.is_course_instructor(auth.uid(), id)
    )
  )
)
WITH CHECK (
  public.is_admin_anywhere(auth.uid())
  OR (
    deleted_at IS NULL
    AND (
      public.has_any_workspace_role(
        auth.uid(),
        workspace_id,
        ARRAY['organization_admin'::public.app_role, 'staff'::public.app_role, 'super_admin'::public.app_role]
      )
      OR instructor_id = auth.uid()
      OR public.is_course_instructor(auth.uid(), id)
    )
  )
);

DROP POLICY IF EXISTS courses_delete ON public.courses;
CREATE POLICY courses_delete
ON public.courses
FOR DELETE
TO authenticated
USING (
  public.is_admin_anywhere(auth.uid())
);
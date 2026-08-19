DROP POLICY IF EXISTS courses_not_deleted_select ON public.courses;
DROP POLICY IF EXISTS courses_not_deleted_select_anon ON public.courses;
DROP POLICY IF EXISTS courses_not_deleted_select_authenticated ON public.courses;
DROP POLICY IF EXISTS courses_read_workspace ON public.courses;

CREATE POLICY courses_not_deleted_select_anon
ON public.courses
AS RESTRICTIVE
FOR SELECT
TO anon
USING (deleted_at IS NULL);

CREATE POLICY courses_not_deleted_select_authenticated
ON public.courses
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (
  deleted_at IS NULL
  OR public.is_admin_anywhere(auth.uid())
);

CREATE POLICY courses_read_workspace
ON public.courses
FOR SELECT
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.is_workspace_member(auth.uid(), workspace_id)
);

REVOKE EXECUTE ON FUNCTION public.is_admin_anywhere(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_staff_anywhere(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_workspace_staff_anywhere(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_workspace_role(uuid, uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_any_workspace_role(uuid, uuid, public.app_role[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_workspace_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_course_instructor(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_any_course_instructor(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_enrolled(uuid, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_admin_anywhere(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin_or_staff_anywhere(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_workspace_staff_anywhere(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_workspace_role(uuid, uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_any_workspace_role(uuid, uuid, public.app_role[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_workspace_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_course_instructor(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_any_course_instructor(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_enrolled(uuid, uuid) TO authenticated, service_role;
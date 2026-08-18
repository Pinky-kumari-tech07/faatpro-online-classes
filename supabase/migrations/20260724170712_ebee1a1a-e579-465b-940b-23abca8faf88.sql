DROP POLICY IF EXISTS ip_select_self_or_admin ON public.instructor_profiles;
CREATE POLICY ip_select_self_or_admin ON public.instructor_profiles
FOR SELECT USING (
  user_id = auth.uid()
  OR public.is_super_admin(auth.uid())
  OR public.is_admin_anywhere(auth.uid())
  OR (workspace_id IS NOT NULL AND public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role,'staff'::app_role,'super_admin'::app_role]))
);

DROP POLICY IF EXISTS ip_update_self_or_admin ON public.instructor_profiles;
CREATE POLICY ip_update_self_or_admin ON public.instructor_profiles
FOR UPDATE USING (
  user_id = auth.uid()
  OR public.is_super_admin(auth.uid())
  OR public.is_admin_anywhere(auth.uid())
  OR (workspace_id IS NOT NULL AND public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role,'staff'::app_role,'super_admin'::app_role]))
);
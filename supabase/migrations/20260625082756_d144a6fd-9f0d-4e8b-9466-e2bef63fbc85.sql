-- Allow workspace admins/staff to read instructor_profiles of any instructor who is
-- a member of a workspace they administer (instructor_profiles.workspace_id is the
-- instructor's personal workspace, not the org workspace).
DROP POLICY IF EXISTS "ip_select_self_or_admin" ON public.instructor_profiles;
CREATE POLICY "ip_select_self_or_admin" ON public.instructor_profiles
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_super_admin(auth.uid())
    OR (workspace_id IS NOT NULL AND public.has_any_workspace_role(
          auth.uid(), workspace_id,
          ARRAY['organization_admin'::app_role,'staff'::app_role,'super_admin'::app_role]))
    OR EXISTS (
      SELECT 1 FROM public.workspace_members wm_inst
      JOIN public.workspace_members wm_admin
        ON wm_admin.workspace_id = wm_inst.workspace_id
       AND wm_admin.profile_id = auth.uid()
       AND wm_admin.status = 'active'
       AND wm_admin.role IN ('organization_admin'::app_role,'staff'::app_role,'super_admin'::app_role)
      WHERE wm_inst.profile_id = instructor_profiles.user_id
        AND wm_inst.status = 'active'
    )
  );

DROP POLICY IF EXISTS "ip_update_self_or_admin" ON public.instructor_profiles;
CREATE POLICY "ip_update_self_or_admin" ON public.instructor_profiles
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_super_admin(auth.uid())
    OR (workspace_id IS NOT NULL AND public.has_any_workspace_role(
          auth.uid(), workspace_id,
          ARRAY['organization_admin'::app_role,'staff'::app_role,'super_admin'::app_role]))
    OR EXISTS (
      SELECT 1 FROM public.workspace_members wm_inst
      JOIN public.workspace_members wm_admin
        ON wm_admin.workspace_id = wm_inst.workspace_id
       AND wm_admin.profile_id = auth.uid()
       AND wm_admin.status = 'active'
       AND wm_admin.role IN ('organization_admin'::app_role,'staff'::app_role,'super_admin'::app_role)
      WHERE wm_inst.profile_id = instructor_profiles.user_id
        AND wm_inst.status = 'active'
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR public.is_super_admin(auth.uid())
    OR (workspace_id IS NOT NULL AND public.has_any_workspace_role(
          auth.uid(), workspace_id,
          ARRAY['organization_admin'::app_role,'staff'::app_role,'super_admin'::app_role]))
    OR EXISTS (
      SELECT 1 FROM public.workspace_members wm_inst
      JOIN public.workspace_members wm_admin
        ON wm_admin.workspace_id = wm_inst.workspace_id
       AND wm_admin.profile_id = auth.uid()
       AND wm_admin.status = 'active'
       AND wm_admin.role IN ('organization_admin'::app_role,'staff'::app_role,'super_admin'::app_role)
      WHERE wm_inst.profile_id = instructor_profiles.user_id
        AND wm_inst.status = 'active'
    )
  );
DROP POLICY IF EXISTS profiles_read_self ON public.profiles;

CREATE POLICY profiles_read_self ON public.profiles
FOR SELECT USING (
  id = auth.uid()
  OR public.is_super_admin(auth.uid())
  OR public.is_workspace_staff_anywhere(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.workspace_members wm1
    JOIN public.workspace_members wm2 ON wm1.workspace_id = wm2.workspace_id
    WHERE wm1.profile_id = auth.uid() AND wm2.profile_id = profiles.id
  )
);
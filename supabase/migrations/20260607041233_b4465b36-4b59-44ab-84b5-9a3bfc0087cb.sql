
-- Helper: any admin/staff/super_admin across any workspace
CREATE OR REPLACE FUNCTION public.is_admin_or_staff_anywhere(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE profile_id = _user_id
      AND status = 'active'
      AND role IN ('organization_admin'::app_role, 'staff'::app_role, 'super_admin'::app_role)
  );
$$;

DROP POLICY IF EXISTS courses_update ON public.courses;
CREATE POLICY courses_update ON public.courses
FOR UPDATE TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.is_admin_or_staff_anywhere(auth.uid())
  OR has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role, 'super_admin'::app_role, 'staff'::app_role])
  OR (deleted_at IS NULL AND (instructor_id = auth.uid() OR public.is_course_instructor(auth.uid(), id)))
)
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR public.is_admin_or_staff_anywhere(auth.uid())
  OR has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role, 'super_admin'::app_role, 'staff'::app_role])
  OR (instructor_id = auth.uid() OR public.is_course_instructor(auth.uid(), id))
);

DROP POLICY IF EXISTS courses_delete ON public.courses;
CREATE POLICY courses_delete ON public.courses
FOR DELETE TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.is_admin_or_staff_anywhere(auth.uid())
  OR has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role, 'super_admin'::app_role])
);

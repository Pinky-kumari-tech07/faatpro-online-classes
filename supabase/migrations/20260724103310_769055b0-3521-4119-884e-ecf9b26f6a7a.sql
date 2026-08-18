-- Staff RBAC lockdown: backend enforcement for destructive/direct writes

-- 1) Student profile destructive updates: admins only, self-update remains covered by profiles_update_self.
DROP POLICY IF EXISTS profiles_admin_update ON public.profiles;
CREATE POLICY profiles_admin_update
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  is_admin_anywhere(auth.uid())
  AND (id = auth.uid() OR NOT is_platform_owner(id))
)
WITH CHECK (
  is_admin_anywhere(auth.uid())
  AND (id = auth.uid() OR NOT is_platform_owner(id))
);

-- 2) Enrollments: staff can assign/create enrollments, but not update or delete existing ones.
DROP POLICY IF EXISTS enroll_admin_delete ON public.enrollments;
DROP POLICY IF EXISTS enroll_admin_manage ON public.enrollments;

CREATE POLICY enroll_admin_update
ON public.enrollments
FOR UPDATE
TO authenticated
USING (
  student_id = auth.uid()
  OR has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role, 'super_admin'::app_role])
)
WITH CHECK (
  student_id = auth.uid()
  OR has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role, 'super_admin'::app_role])
);

CREATE POLICY enroll_admin_delete
ON public.enrollments
FOR DELETE
TO authenticated
USING (
  has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role, 'super_admin'::app_role])
);

-- Keep explicit staff create/enroll permission.
DROP POLICY IF EXISTS enroll_student_insert ON public.enrollments;
CREATE POLICY enroll_student_insert
ON public.enrollments
FOR INSERT
TO authenticated
WITH CHECK (
  student_id = auth.uid()
  OR has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role, 'staff'::app_role, 'super_admin'::app_role])
);

-- 3) Student bundles: staff can assign bundles, but cannot update/delete existing assignments.
DROP POLICY IF EXISTS student_bundles_admin_write ON public.student_bundles;

CREATE POLICY student_bundles_staff_insert
ON public.student_bundles
FOR INSERT
TO authenticated
WITH CHECK (
  has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role, 'staff'::app_role, 'super_admin'::app_role])
);

CREATE POLICY student_bundles_admin_update
ON public.student_bundles
FOR UPDATE
TO authenticated
USING (
  has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role, 'super_admin'::app_role])
)
WITH CHECK (
  has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role, 'super_admin'::app_role])
);

CREATE POLICY student_bundles_admin_delete
ON public.student_bundles
FOR DELETE
TO authenticated
USING (
  has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role, 'super_admin'::app_role])
);

-- 4) Course category management: no staff direct writes.
DROP POLICY IF EXISTS cc_admin_manage ON public.course_categories;
CREATE POLICY cc_admin_manage
ON public.course_categories
FOR ALL
TO authenticated
USING (
  has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role, 'super_admin'::app_role])
)
WITH CHECK (
  has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role, 'super_admin'::app_role])
);

-- 5) Course instructor assignment/transfer: no staff direct writes.
DROP POLICY IF EXISTS ci_manage ON public.course_instructors;
CREATE POLICY ci_manage
ON public.course_instructors
FOR ALL
TO authenticated
USING (
  has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role, 'super_admin'::app_role])
)
WITH CHECK (
  has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role, 'super_admin'::app_role])
);
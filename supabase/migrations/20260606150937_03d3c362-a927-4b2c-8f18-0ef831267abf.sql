DROP POLICY IF EXISTS "lessons_manage" ON public.lessons;
CREATE POLICY "lessons_manage"
ON public.lessons
FOR ALL
TO authenticated
USING (
  public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role, 'staff'::app_role, 'super_admin'::app_role, 'instructor'::app_role])
)
WITH CHECK (
  public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role, 'staff'::app_role, 'super_admin'::app_role, 'instructor'::app_role])
);

DROP POLICY IF EXISTS "quizzes_manage" ON public.quizzes;
CREATE POLICY "quizzes_manage"
ON public.quizzes
FOR ALL
TO authenticated
USING (
  public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role, 'staff'::app_role, 'super_admin'::app_role, 'instructor'::app_role])
)
WITH CHECK (
  public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role, 'staff'::app_role, 'super_admin'::app_role, 'instructor'::app_role])
);

DROP POLICY IF EXISTS "assignments_manage" ON public.assignments;
CREATE POLICY "assignments_manage"
ON public.assignments
FOR ALL
TO authenticated
USING (
  public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role, 'staff'::app_role, 'super_admin'::app_role, 'instructor'::app_role])
)
WITH CHECK (
  public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role, 'staff'::app_role, 'super_admin'::app_role, 'instructor'::app_role])
);

DROP POLICY IF EXISTS "live_classes_manage" ON public.live_classes;
CREATE POLICY "live_classes_manage"
ON public.live_classes
FOR ALL
TO authenticated
USING (
  public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role, 'staff'::app_role, 'super_admin'::app_role, 'instructor'::app_role])
)
WITH CHECK (
  public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role, 'staff'::app_role, 'super_admin'::app_role, 'instructor'::app_role])
);

DROP POLICY IF EXISTS "ann_manage" ON public.announcements;
CREATE POLICY "ann_manage"
ON public.announcements
FOR ALL
TO authenticated
USING (
  public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role, 'staff'::app_role, 'super_admin'::app_role, 'instructor'::app_role])
)
WITH CHECK (
  public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role, 'staff'::app_role, 'super_admin'::app_role, 'instructor'::app_role])
);

DROP POLICY IF EXISTS "disc_insert" ON public.discussions;
CREATE POLICY "disc_insert"
ON public.discussions
FOR INSERT
TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role, 'staff'::app_role, 'super_admin'::app_role, 'instructor'::app_role, 'student'::app_role])
);
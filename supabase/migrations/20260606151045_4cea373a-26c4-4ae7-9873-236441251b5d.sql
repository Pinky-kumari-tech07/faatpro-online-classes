DROP POLICY IF EXISTS "lessons_manage" ON public.lessons;
CREATE POLICY "lessons_manage"
ON public.lessons
FOR ALL
TO authenticated
USING (public.is_workspace_staff_anywhere(auth.uid()))
WITH CHECK (public.is_workspace_staff_anywhere(auth.uid()));

DROP POLICY IF EXISTS "quizzes_manage" ON public.quizzes;
CREATE POLICY "quizzes_manage"
ON public.quizzes
FOR ALL
TO authenticated
USING (public.is_workspace_staff_anywhere(auth.uid()))
WITH CHECK (public.is_workspace_staff_anywhere(auth.uid()));

DROP POLICY IF EXISTS "assignments_manage" ON public.assignments;
CREATE POLICY "assignments_manage"
ON public.assignments
FOR ALL
TO authenticated
USING (public.is_workspace_staff_anywhere(auth.uid()))
WITH CHECK (public.is_workspace_staff_anywhere(auth.uid()));

DROP POLICY IF EXISTS "live_classes_manage" ON public.live_classes;
CREATE POLICY "live_classes_manage"
ON public.live_classes
FOR ALL
TO authenticated
USING (public.is_workspace_staff_anywhere(auth.uid()))
WITH CHECK (public.is_workspace_staff_anywhere(auth.uid()));

DROP POLICY IF EXISTS "ann_manage" ON public.announcements;
CREATE POLICY "ann_manage"
ON public.announcements
FOR ALL
TO authenticated
USING (public.is_workspace_staff_anywhere(auth.uid()))
WITH CHECK (public.is_workspace_staff_anywhere(auth.uid()));

DROP POLICY IF EXISTS "disc_insert" ON public.discussions;
CREATE POLICY "disc_insert"
ON public.discussions
FOR INSERT
TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND (
    public.is_workspace_staff_anywhere(auth.uid())
    OR public.is_workspace_member(auth.uid(), workspace_id)
  )
);

DROP POLICY IF EXISTS disc_insert ON public.discussions;
CREATE POLICY disc_insert ON public.discussions
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND (
      public.is_workspace_staff_anywhere(auth.uid())
      OR public.is_workspace_member(auth.uid(), workspace_id)
      OR (course_id IS NOT NULL AND public.is_course_instructor(auth.uid(), course_id))
      OR (course_id IS NOT NULL AND public.is_enrolled(auth.uid(), course_id))
    )
  );

DROP POLICY IF EXISTS disc_read ON public.discussions;
CREATE POLICY disc_read ON public.discussions
  FOR SELECT TO authenticated
  USING (
    public.is_workspace_member(auth.uid(), workspace_id)
    OR public.is_workspace_staff_anywhere(auth.uid())
    OR (course_id IS NOT NULL AND public.is_course_instructor(auth.uid(), course_id))
    OR (course_id IS NOT NULL AND public.is_enrolled(auth.uid(), course_id))
  );

DROP POLICY IF EXISTS dr_insert ON public.discussion_replies;
CREATE POLICY dr_insert ON public.discussion_replies
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.discussions d
      WHERE d.id = discussion_replies.discussion_id
        AND (
          public.is_workspace_member(auth.uid(), d.workspace_id)
          OR public.is_workspace_staff_anywhere(auth.uid())
          OR (d.course_id IS NOT NULL AND public.is_course_instructor(auth.uid(), d.course_id))
          OR (d.course_id IS NOT NULL AND public.is_enrolled(auth.uid(), d.course_id))
        )
    )
  );

DROP POLICY IF EXISTS dr_read ON public.discussion_replies;
CREATE POLICY dr_read ON public.discussion_replies
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.discussions d
      WHERE d.id = discussion_replies.discussion_id
        AND (
          public.is_workspace_member(auth.uid(), d.workspace_id)
          OR public.is_workspace_staff_anywhere(auth.uid())
          OR (d.course_id IS NOT NULL AND public.is_course_instructor(auth.uid(), d.course_id))
          OR (d.course_id IS NOT NULL AND public.is_enrolled(auth.uid(), d.course_id))
        )
    )
  );

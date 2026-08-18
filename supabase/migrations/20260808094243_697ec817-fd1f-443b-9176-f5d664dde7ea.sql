
DROP POLICY IF EXISTS ann_read ON public.announcements;
CREATE POLICY ann_read ON public.announcements
  FOR SELECT TO authenticated
  USING (
    public.is_workspace_member(auth.uid(), workspace_id)
    OR public.is_workspace_staff_anywhere(auth.uid())
    OR created_by = auth.uid()
    OR (
      target_type = 'course'
      AND target_id IS NOT NULL
      AND (
        public.is_course_instructor(auth.uid(), target_id)
        OR public.is_enrolled(auth.uid(), target_id)
      )
    )
  );

CREATE POLICY ann_instructor_insert ON public.announcements
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND target_type = 'course'
    AND target_id IS NOT NULL
    AND public.is_course_instructor(auth.uid(), target_id)
  );

CREATE POLICY ann_instructor_update ON public.announcements
  FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    AND target_type = 'course'
    AND target_id IS NOT NULL
    AND public.is_course_instructor(auth.uid(), target_id)
  )
  WITH CHECK (
    created_by = auth.uid()
    AND target_type = 'course'
    AND target_id IS NOT NULL
    AND public.is_course_instructor(auth.uid(), target_id)
  );

CREATE POLICY ann_instructor_delete ON public.announcements
  FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    AND target_type = 'course'
    AND target_id IS NOT NULL
    AND public.is_course_instructor(auth.uid(), target_id)
  );

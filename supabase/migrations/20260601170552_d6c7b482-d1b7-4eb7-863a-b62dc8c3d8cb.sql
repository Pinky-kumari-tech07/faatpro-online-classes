
-- Align quiz_questions manage policy with quizzes_manage:
-- allow course instructors (is_course_instructor) in addition to workspace admins/staff/instructors.
DROP POLICY IF EXISTS qq_manage ON public.quiz_questions;

CREATE POLICY qq_manage ON public.quiz_questions
FOR ALL
TO authenticated
USING (
  has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role, 'staff'::app_role, 'super_admin'::app_role, 'instructor'::app_role])
  OR EXISTS (
    SELECT 1 FROM public.quizzes q
    WHERE q.id = quiz_questions.quiz_id
      AND public.is_course_instructor(auth.uid(), q.course_id)
  )
)
WITH CHECK (
  has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role, 'staff'::app_role, 'super_admin'::app_role, 'instructor'::app_role])
  OR EXISTS (
    SELECT 1 FROM public.quizzes q
    WHERE q.id = quiz_questions.quiz_id
      AND public.is_course_instructor(auth.uid(), q.course_id)
  )
);

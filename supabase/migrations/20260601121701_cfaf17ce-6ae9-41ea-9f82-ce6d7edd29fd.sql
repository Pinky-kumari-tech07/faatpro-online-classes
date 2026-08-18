DROP POLICY IF EXISTS quizzes_read ON public.quizzes;
CREATE POLICY quizzes_read
ON public.quizzes
FOR SELECT
TO authenticated
USING (
  is_workspace_member(auth.uid(), workspace_id)
  OR (status = 'published'::quiz_status AND is_enrolled(auth.uid(), course_id))
);

DROP POLICY IF EXISTS assignments_read ON public.assignments;
CREATE POLICY assignments_read
ON public.assignments
FOR SELECT
TO authenticated
USING (
  is_workspace_member(auth.uid(), workspace_id)
  OR (status = 'published'::assignment_status AND is_enrolled(auth.uid(), course_id))
);

DROP POLICY IF EXISTS qq_read ON public.quiz_questions;
CREATE POLICY qq_read
ON public.quiz_questions
FOR SELECT
TO authenticated
USING (
  is_workspace_member(auth.uid(), workspace_id)
  OR EXISTS (
    SELECT 1
    FROM public.quizzes q
    WHERE q.id = quiz_questions.quiz_id
      AND q.status = 'published'::quiz_status
      AND is_enrolled(auth.uid(), q.course_id)
  )
);

DROP POLICY IF EXISTS qa_student_insert ON public.quiz_attempts;
CREATE POLICY qa_student_insert
ON public.quiz_attempts
FOR INSERT
TO authenticated
WITH CHECK (
  student_id = auth.uid()
  AND (
    is_workspace_member(auth.uid(), workspace_id)
    OR EXISTS (
      SELECT 1
      FROM public.quizzes q
      WHERE q.id = quiz_attempts.quiz_id
        AND q.status = 'published'::quiz_status
        AND is_enrolled(auth.uid(), q.course_id)
    )
  )
);

DROP POLICY IF EXISTS asub_student_write ON public.assignment_submissions;
CREATE POLICY asub_student_write
ON public.assignment_submissions
FOR INSERT
TO authenticated
WITH CHECK (
  student_id = auth.uid()
  AND (
    is_workspace_member(auth.uid(), workspace_id)
    OR EXISTS (
      SELECT 1
      FROM public.assignments a
      WHERE a.id = assignment_submissions.assignment_id
        AND a.status = 'published'::assignment_status
        AND is_enrolled(auth.uid(), a.course_id)
    )
  )
);
CREATE OR REPLACE FUNCTION public.course_completion_status(_student uuid, _course uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  total_lessons int := 0; done_lessons int := 0;
  total_quizzes int := 0; passed_quizzes int := 0;
  total_assignments int := 0; passed_assignments int := 0;
  total_items int := 0; done_items int := 0;
  pct numeric := 0;
BEGIN
  SELECT count(*) INTO total_lessons FROM public.lessons WHERE course_id = _course;
  IF total_lessons > 0 THEN
    SELECT count(DISTINCT lp.lesson_id) INTO done_lessons
      FROM public.lesson_progress lp
      JOIN public.lessons l ON l.id = lp.lesson_id
      WHERE l.course_id = _course AND lp.student_id = _student AND lp.is_completed = true;
  END IF;

  SELECT count(*) INTO total_quizzes
    FROM public.quizzes WHERE course_id = _course AND status = 'published';
  IF total_quizzes > 0 THEN
    -- A quiz counts as done when the student passed it, or when an attempt
    -- exists but no pass/fail result has been recorded (manually graded quiz).
    SELECT count(*) INTO passed_quizzes
      FROM public.quizzes q
      WHERE q.course_id = _course AND q.status = 'published'
        AND EXISTS (SELECT 1 FROM public.quiz_attempts qa
                     WHERE qa.quiz_id = q.id AND qa.student_id = _student)
        AND NOT EXISTS (SELECT 1 FROM public.quiz_attempts qa
                         WHERE qa.quiz_id = q.id AND qa.student_id = _student
                           AND qa.passed = true)
        = false
      OR (q.course_id = _course AND q.status = 'published'
          AND EXISTS (SELECT 1 FROM public.quiz_attempts qa
                       WHERE qa.quiz_id = q.id AND qa.student_id = _student
                         AND qa.passed IS NULL)
          AND NOT EXISTS (SELECT 1 FROM public.quiz_attempts qa
                           WHERE qa.quiz_id = q.id AND qa.student_id = _student
                             AND qa.passed = false));
  END IF;

  SELECT count(*) INTO total_assignments
    FROM public.assignments WHERE course_id = _course AND status = 'published';
  IF total_assignments > 0 THEN
    -- An assignment counts as done when a non-draft submission exists and it
    -- was not explicitly failed during grading.
    SELECT count(*) INTO passed_assignments
      FROM public.assignments a
      WHERE a.course_id = _course AND a.status = 'published'
        AND EXISTS (
          SELECT 1 FROM public.assignment_submissions s
           WHERE s.assignment_id = a.id AND s.student_id = _student
             AND COALESCE(s.is_draft, false) = false
             AND COALESCE(s.passed, true) = true
        );
  END IF;

  total_items := total_lessons + total_quizzes + total_assignments;
  done_items := LEAST(done_lessons, total_lessons)
              + LEAST(passed_quizzes, total_quizzes)
              + LEAST(passed_assignments, total_assignments);

  IF total_items > 0 THEN
    pct := round((done_items::numeric / total_items::numeric) * 100, 2);
  END IF;

  RETURN jsonb_build_object(
    'total_lessons', total_lessons,
    'completed_lessons', done_lessons,
    'total_quizzes', total_quizzes,
    'passed_quizzes', passed_quizzes,
    'total_assignments', total_assignments,
    'passed_assignments', passed_assignments,
    'total_items', total_items,
    'completed_items', done_items,
    'completion_percentage', pct,
    'is_complete', (
      total_items > 0
      AND done_lessons >= total_lessons
      AND passed_quizzes >= total_quizzes
      AND passed_assignments >= total_assignments
    )
  );
END $function$;
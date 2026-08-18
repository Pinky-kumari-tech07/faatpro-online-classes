ALTER TABLE public.quiz_attempts
  ADD COLUMN IF NOT EXISTS review_data jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.assignment_submissions
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'submitted',
  ADD COLUMN IF NOT EXISTS review_comments text;

CREATE INDEX IF NOT EXISTS idx_quizzes_course_status ON public.quizzes(course_id, status);
CREATE INDEX IF NOT EXISTS idx_quizzes_lesson ON public.quizzes(lesson_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz_position ON public.quiz_questions(quiz_id, position);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_student_quiz ON public.quiz_attempts(student_id, quiz_id);
CREATE INDEX IF NOT EXISTS idx_assignments_course_status ON public.assignments(course_id, status);
CREATE INDEX IF NOT EXISTS idx_assignments_lesson ON public.assignments(lesson_id);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_student_assignment ON public.assignment_submissions(student_id, assignment_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quizzes_course_id_fkey') THEN
    ALTER TABLE public.quizzes
      ADD CONSTRAINT quizzes_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quizzes_lesson_id_fkey') THEN
    ALTER TABLE public.quizzes
      ADD CONSTRAINT quizzes_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES public.lessons(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quiz_questions_quiz_id_fkey') THEN
    ALTER TABLE public.quiz_questions
      ADD CONSTRAINT quiz_questions_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES public.quizzes(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quiz_attempts_quiz_id_fkey') THEN
    ALTER TABLE public.quiz_attempts
      ADD CONSTRAINT quiz_attempts_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES public.quizzes(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'assignments_course_id_fkey') THEN
    ALTER TABLE public.assignments
      ADD CONSTRAINT assignments_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'assignments_lesson_id_fkey') THEN
    ALTER TABLE public.assignments
      ADD CONSTRAINT assignments_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES public.lessons(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'assignment_submissions_assignment_id_fkey') THEN
    ALTER TABLE public.assignment_submissions
      ADD CONSTRAINT assignment_submissions_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES public.assignments(id) ON DELETE CASCADE;
  END IF;
END $$;

UPDATE public.assignment_submissions
SET status = CASE WHEN graded_at IS NOT NULL THEN 'graded' ELSE 'submitted' END
WHERE status IS NULL OR status = 'submitted';
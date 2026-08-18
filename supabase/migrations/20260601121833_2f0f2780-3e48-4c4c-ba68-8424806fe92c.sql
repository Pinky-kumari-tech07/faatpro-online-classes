ALTER TABLE public.quizzes
  ADD COLUMN IF NOT EXISTS position integer NOT NULL DEFAULT 0;

ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS position integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_quizzes_course_position ON public.quizzes(course_id, position, created_at);
CREATE INDEX IF NOT EXISTS idx_assignments_course_position ON public.assignments(course_id, position, created_at);
ALTER TABLE public.quiz_questions ADD COLUMN IF NOT EXISTS explanation text;
ALTER TABLE public.quizzes ADD COLUMN IF NOT EXISTS allow_retake boolean NOT NULL DEFAULT true;
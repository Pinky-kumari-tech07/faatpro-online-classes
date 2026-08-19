
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS learning_outcomes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS target_audience jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS materials_included jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS requirements jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS total_duration_minutes integer,
  ADD COLUMN IF NOT EXISTS intro_video_url text,
  ADD COLUMN IF NOT EXISTS intro_video_provider text,
  ADD COLUMN IF NOT EXISTS level text NOT NULL DEFAULT 'all_levels',
  ADD COLUMN IF NOT EXISTS subcategory text,
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_preview boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS enable_discussion boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS enable_certificates boolean NOT NULL DEFAULT true;

ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS featured_image_url text,
  ADD COLUMN IF NOT EXISTS video_provider text;

ALTER TABLE public.quizzes
  ADD COLUMN IF NOT EXISTS passing_percentage integer NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS max_attempts integer,
  ADD COLUMN IF NOT EXISTS shuffle_questions boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS random_pick integer,
  ADD COLUMN IF NOT EXISTS auto_evaluate boolean NOT NULL DEFAULT true;

ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS allowed_file_types jsonb NOT NULL DEFAULT '["pdf","doc","docx","zip"]'::jsonb,
  ADD COLUMN IF NOT EXISTS max_file_size_mb integer NOT NULL DEFAULT 25,
  ADD COLUMN IF NOT EXISTS late_policy text NOT NULL DEFAULT 'allow_with_penalty';

ALTER TABLE public.live_classes
  ADD COLUMN IF NOT EXISTS meeting_password text,
  ADD COLUMN IF NOT EXISTS notify_students boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS attendance_tracking boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS duration_minutes integer;

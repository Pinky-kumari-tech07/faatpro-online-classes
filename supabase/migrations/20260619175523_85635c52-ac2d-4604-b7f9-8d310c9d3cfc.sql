-- 3-level categories + multi-language/board support
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS child_category text,
  ADD COLUMN IF NOT EXISTS languages text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS boards text[] NOT NULL DEFAULT '{}'::text[];

-- Backfill languages from legacy single-language column
UPDATE public.courses
SET languages = ARRAY[language]
WHERE (languages IS NULL OR cardinality(languages) = 0)
  AND language IS NOT NULL AND language <> '';

CREATE INDEX IF NOT EXISTS idx_courses_languages ON public.courses USING gin (languages);
CREATE INDEX IF NOT EXISTS idx_courses_boards ON public.courses USING gin (boards);
CREATE INDEX IF NOT EXISTS idx_courses_child_category ON public.courses (child_category);
CREATE INDEX IF NOT EXISTS idx_course_categories_parent_id ON public.course_categories (parent_id);
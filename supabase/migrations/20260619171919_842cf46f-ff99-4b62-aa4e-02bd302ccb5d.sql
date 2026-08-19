
-- Enum additions
ALTER TYPE public.course_status ADD VALUE IF NOT EXISTS 'upcoming';
ALTER TYPE public.course_status ADD VALUE IF NOT EXISTS 'scheduled';
ALTER TYPE public.course_visibility ADD VALUE IF NOT EXISTS 'password_protected';

-- Courses: new columns
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS course_password text,
  ADD COLUMN IF NOT EXISTS enrollment_type text NOT NULL DEFAULT 'lifetime',
  ADD COLUMN IF NOT EXISTS access_duration integer,
  ADD COLUMN IF NOT EXISTS access_duration_type text NOT NULL DEFAULT 'days',
  ADD COLUMN IF NOT EXISTS enrollment_start_at timestamptz,
  ADD COLUMN IF NOT EXISTS enrollment_end_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_enrollment_paused boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS launch_at timestamptz,
  ADD COLUMN IF NOT EXISTS coming_soon_thumbnail_url text,
  ADD COLUMN IF NOT EXISTS seo_focus_keyword text,
  ADD COLUMN IF NOT EXISTS og_image_url text,
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'English',
  ADD COLUMN IF NOT EXISTS difficulty text NOT NULL DEFAULT 'beginner',
  ADD COLUMN IF NOT EXISTS preview_mode text NOT NULL DEFAULT 'selected_lessons',
  ADD COLUMN IF NOT EXISTS badges jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS discussion_settings jsonb NOT NULL DEFAULT
    '{"enabled":true,"instructor_moderation":true,"student_replies":true,"anonymous_questions":false}'::jsonb,
  ADD COLUMN IF NOT EXISTS certificate_eligibility_type text NOT NULL DEFAULT 'complete_100',
  ADD COLUMN IF NOT EXISTS certificate_eligibility_threshold numeric,
  ADD COLUMN IF NOT EXISTS estimated_completion_minutes integer;

ALTER TABLE public.courses
  DROP CONSTRAINT IF EXISTS courses_enrollment_type_chk;
ALTER TABLE public.courses
  ADD CONSTRAINT courses_enrollment_type_chk
  CHECK (enrollment_type IN ('lifetime','fixed'));

ALTER TABLE public.courses
  DROP CONSTRAINT IF EXISTS courses_access_duration_type_chk;
ALTER TABLE public.courses
  ADD CONSTRAINT courses_access_duration_type_chk
  CHECK (access_duration_type IN ('days','months','years'));

ALTER TABLE public.courses
  DROP CONSTRAINT IF EXISTS courses_difficulty_chk;
ALTER TABLE public.courses
  ADD CONSTRAINT courses_difficulty_chk
  CHECK (difficulty IN ('beginner','intermediate','advanced','expert','all_levels'));

ALTER TABLE public.courses
  DROP CONSTRAINT IF EXISTS courses_preview_mode_chk;
ALTER TABLE public.courses
  ADD CONSTRAINT courses_preview_mode_chk
  CHECK (preview_mode IN ('full','selected_lessons','none'));

ALTER TABLE public.courses
  DROP CONSTRAINT IF EXISTS courses_cert_eligibility_chk;
ALTER TABLE public.courses
  ADD CONSTRAINT courses_cert_eligibility_chk
  CHECK (certificate_eligibility_type IN ('complete_100','complete_percentage','quiz_threshold'));

-- Categories: nesting
ALTER TABLE public.course_categories
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.course_categories(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_course_categories_parent ON public.course_categories(parent_id);

-- Enrollments: time-limited access
ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS access_expires_at timestamptz;

-- Prerequisites
CREATE TABLE IF NOT EXISTS public.course_prerequisites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  prerequisite_course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, prerequisite_course_id),
  CHECK (course_id <> prerequisite_course_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_prerequisites TO authenticated;
GRANT ALL ON public.course_prerequisites TO service_role;
GRANT SELECT ON public.course_prerequisites TO anon;
ALTER TABLE public.course_prerequisites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cp_read" ON public.course_prerequisites
  FOR SELECT USING (true);
CREATE POLICY "cp_manage" ON public.course_prerequisites
  FOR ALL TO authenticated
  USING (
    public.is_admin_or_staff_anywhere(auth.uid())
    OR public.is_course_instructor(auth.uid(), course_id)
  )
  WITH CHECK (
    public.is_admin_or_staff_anywhere(auth.uid())
    OR public.is_course_instructor(auth.uid(), course_id)
  );

CREATE INDEX IF NOT EXISTS idx_course_prereq_course ON public.course_prerequisites(course_id);
CREATE INDEX IF NOT EXISTS idx_course_prereq_workspace ON public.course_prerequisites(workspace_id);

-- Notify Me subscribers for upcoming courses
CREATE TABLE IF NOT EXISTS public.course_launch_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  email text NOT NULL,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, email)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_launch_subscribers TO authenticated;
GRANT INSERT ON public.course_launch_subscribers TO anon;
GRANT ALL ON public.course_launch_subscribers TO service_role;
ALTER TABLE public.course_launch_subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cls_insert_anyone" ON public.course_launch_subscribers
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);
CREATE POLICY "cls_read_staff" ON public.course_launch_subscribers
  FOR SELECT TO authenticated
  USING (
    public.is_admin_or_staff_anywhere(auth.uid())
    OR public.is_course_instructor(auth.uid(), course_id)
  );
CREATE POLICY "cls_manage_staff" ON public.course_launch_subscribers
  FOR UPDATE TO authenticated
  USING (
    public.is_admin_or_staff_anywhere(auth.uid())
    OR public.is_course_instructor(auth.uid(), course_id)
  );
CREATE POLICY "cls_delete_staff" ON public.course_launch_subscribers
  FOR DELETE TO authenticated
  USING (
    public.is_admin_or_staff_anywhere(auth.uid())
    OR public.is_course_instructor(auth.uid(), course_id)
  );

CREATE INDEX IF NOT EXISTS idx_cls_course ON public.course_launch_subscribers(course_id);

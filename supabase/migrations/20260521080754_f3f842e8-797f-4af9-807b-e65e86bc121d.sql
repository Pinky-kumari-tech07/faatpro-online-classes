
-- =========================================================================
-- ENUMS
-- =========================================================================
CREATE TYPE public.app_role AS ENUM (
  'super_admin', 'organization_admin', 'instructor', 'student', 'staff', 'parent'
);
CREATE TYPE public.course_status AS ENUM ('draft', 'published', 'archived');
CREATE TYPE public.course_visibility AS ENUM ('public', 'private');
CREATE TYPE public.lesson_type AS ENUM ('video', 'pdf', 'text', 'embed');
CREATE TYPE public.enrollment_status AS ENUM ('active', 'completed', 'expired');
CREATE TYPE public.quiz_status AS ENUM ('draft', 'published');
CREATE TYPE public.question_type AS ENUM ('mcq', 'multi_select', 'true_false');
CREATE TYPE public.assignment_status AS ENUM ('draft', 'published');
CREATE TYPE public.member_status AS ENUM ('active', 'invited', 'suspended');

-- =========================================================================
-- TABLES
-- =========================================================================
CREATE TABLE public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  logo_url text,
  brand_color text,
  tagline text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  avatar_url text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'student',
  status public.member_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, profile_id, role)
);
CREATE INDEX idx_wm_profile ON public.workspace_members(profile_id);
CREATE INDEX idx_wm_workspace ON public.workspace_members(workspace_id);

CREATE TABLE public.courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title text NOT NULL,
  slug text NOT NULL,
  description text,
  summary text,
  thumbnail_url text,
  status public.course_status NOT NULL DEFAULT 'draft',
  visibility public.course_visibility NOT NULL DEFAULT 'private',
  category text,
  tags text[] DEFAULT '{}',
  seo_title text,
  seo_description text,
  instructor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, slug)
);
CREATE INDEX idx_courses_workspace ON public.courses(workspace_id);
CREATE INDEX idx_courses_instructor ON public.courses(instructor_id);

CREATE TABLE public.course_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sections_course ON public.course_sections(course_id);

CREATE TABLE public.lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  section_id uuid REFERENCES public.course_sections(id) ON DELETE SET NULL,
  title text NOT NULL,
  lesson_type public.lesson_type NOT NULL DEFAULT 'text',
  content text,
  asset_url text,
  duration_seconds int DEFAULT 0,
  position int NOT NULL DEFAULT 0,
  is_preview boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_lessons_course ON public.lessons(course_id);
CREATE INDEX idx_lessons_section ON public.lessons(section_id);

CREATE TABLE public.lesson_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  asset_type text NOT NULL,
  storage_path text,
  public_url text,
  title text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status public.enrollment_status NOT NULL DEFAULT 'active',
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (course_id, student_id)
);
CREATE INDEX idx_enroll_student ON public.enrollments(student_id);
CREATE INDEX idx_enroll_course ON public.enrollments(course_id);

CREATE TABLE public.lesson_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  enrollment_id uuid NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  progress_seconds int NOT NULL DEFAULT 0,
  is_completed boolean NOT NULL DEFAULT false,
  last_viewed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (enrollment_id, lesson_id)
);
CREATE INDEX idx_prog_student ON public.lesson_progress(student_id);

CREATE TABLE public.quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  lesson_id uuid REFERENCES public.lessons(id) ON DELETE SET NULL,
  title text NOT NULL,
  instructions text,
  time_limit_minutes int,
  status public.quiz_status NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  question_type public.question_type NOT NULL,
  prompt text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]',
  correct_answers jsonb NOT NULL DEFAULT '[]',
  points int NOT NULL DEFAULT 1,
  position int NOT NULL DEFAULT 0
);

CREATE TABLE public.quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  answers jsonb NOT NULL DEFAULT '{}',
  score numeric NOT NULL DEFAULT 0,
  max_score numeric NOT NULL DEFAULT 0,
  submitted_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  lesson_id uuid REFERENCES public.lessons(id) ON DELETE SET NULL,
  title text NOT NULL,
  instructions text,
  due_at timestamptz,
  max_points int NOT NULL DEFAULT 100,
  allow_file_upload boolean NOT NULL DEFAULT true,
  status public.assignment_status NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.assignment_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  assignment_id uuid NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  submission_text text,
  file_path text,
  grade numeric,
  feedback text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  graded_at timestamptz,
  UNIQUE (assignment_id, student_id)
);

CREATE TABLE public.student_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  lesson_id uuid REFERENCES public.lessons(id) ON DELETE CASCADE,
  timestamp_seconds int DEFAULT 0,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'in_app',
  event_type text NOT NULL,
  title text NOT NULL,
  body text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================================
-- HELPER FUNCTIONS (security definer, no RLS recursion)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.is_workspace_member(_user_id uuid, _workspace_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE profile_id = _user_id AND workspace_id = _workspace_id AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.has_workspace_role(_user_id uuid, _workspace_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE profile_id = _user_id AND workspace_id = _workspace_id AND role = _role AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.has_any_workspace_role(_user_id uuid, _workspace_id uuid, _roles public.app_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE profile_id = _user_id AND workspace_id = _workspace_id AND role = ANY(_roles) AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE profile_id = _user_id AND role = 'super_admin' AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_enrolled(_user_id uuid, _course_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.enrollments
    WHERE student_id = _user_id AND course_id = _course_id AND status <> 'expired'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_course_instructor(_user_id uuid, _course_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.courses WHERE id = _course_id AND instructor_id = _user_id
  );
$$;

-- =========================================================================
-- TRIGGERS
-- =========================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_workspace_id uuid;
  base_slug text;
  final_slug text;
  counter int := 0;
  display_name text;
BEGIN
  display_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));

  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (NEW.id, display_name, NEW.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (id) DO NOTHING;

  base_slug := lower(regexp_replace(coalesce(display_name, 'workspace'), '[^a-zA-Z0-9]+', '-', 'g'));
  base_slug := trim(both '-' from base_slug);
  IF base_slug = '' THEN base_slug := 'workspace'; END IF;
  final_slug := base_slug;
  WHILE EXISTS (SELECT 1 FROM public.workspaces WHERE slug = final_slug) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter::text;
  END LOOP;

  INSERT INTO public.workspaces (name, slug)
  VALUES (display_name || '''s Workspace', final_slug)
  RETURNING id INTO new_workspace_id;

  INSERT INTO public.workspace_members (workspace_id, profile_id, role, status)
  VALUES (new_workspace_id, NEW.id, 'organization_admin', 'active');

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER courses_updated BEFORE UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================================
-- ENABLE RLS
-- =========================================================================
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- POLICIES
-- =========================================================================

-- WORKSPACES
CREATE POLICY "workspaces_read_members" ON public.workspaces
  FOR SELECT USING (public.is_super_admin(auth.uid()) OR public.is_workspace_member(auth.uid(), id));
CREATE POLICY "workspaces_admin_update" ON public.workspaces
  FOR UPDATE USING (public.has_workspace_role(auth.uid(), id, 'organization_admin'));
CREATE POLICY "workspaces_insert_auth" ON public.workspaces
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- PROFILES
CREATE POLICY "profiles_read_self" ON public.profiles
  FOR SELECT USING (
    id = auth.uid()
    OR public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.workspace_members wm1
      JOIN public.workspace_members wm2 ON wm1.workspace_id = wm2.workspace_id
      WHERE wm1.profile_id = auth.uid() AND wm2.profile_id = public.profiles.id
    )
  );
CREATE POLICY "profiles_update_self" ON public.profiles
  FOR UPDATE USING (id = auth.uid());
CREATE POLICY "profiles_insert_self" ON public.profiles
  FOR INSERT WITH CHECK (id = auth.uid());

-- WORKSPACE_MEMBERS
CREATE POLICY "wm_read_same_workspace" ON public.workspace_members
  FOR SELECT USING (
    profile_id = auth.uid()
    OR public.is_super_admin(auth.uid())
    OR public.is_workspace_member(auth.uid(), workspace_id)
  );
CREATE POLICY "wm_admin_manage" ON public.workspace_members
  FOR ALL USING (public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin','super_admin']::public.app_role[]))
  WITH CHECK (public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin','super_admin']::public.app_role[]));

-- COURSES
CREATE POLICY "courses_read_workspace" ON public.courses
  FOR SELECT USING (
    public.is_super_admin(auth.uid())
    OR public.is_workspace_member(auth.uid(), workspace_id)
  );
CREATE POLICY "courses_admin_manage" ON public.courses
  FOR ALL USING (
    public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin','staff','super_admin']::public.app_role[])
  ) WITH CHECK (
    public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin','staff','super_admin']::public.app_role[])
  );
CREATE POLICY "courses_instructor_update" ON public.courses
  FOR UPDATE USING (instructor_id = auth.uid())
  WITH CHECK (instructor_id = auth.uid());

-- COURSE_SECTIONS
CREATE POLICY "sections_read" ON public.course_sections
  FOR SELECT USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "sections_manage" ON public.course_sections
  FOR ALL USING (
    public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin','staff','super_admin']::public.app_role[])
    OR public.is_course_instructor(auth.uid(), course_id)
  ) WITH CHECK (
    public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin','staff','super_admin']::public.app_role[])
    OR public.is_course_instructor(auth.uid(), course_id)
  );

-- LESSONS
CREATE POLICY "lessons_read" ON public.lessons
  FOR SELECT USING (
    public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin','staff','super_admin','instructor']::public.app_role[])
    OR is_preview
    OR public.is_enrolled(auth.uid(), course_id)
  );
CREATE POLICY "lessons_manage" ON public.lessons
  FOR ALL USING (
    public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin','staff','super_admin']::public.app_role[])
    OR public.is_course_instructor(auth.uid(), course_id)
  ) WITH CHECK (
    public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin','staff','super_admin']::public.app_role[])
    OR public.is_course_instructor(auth.uid(), course_id)
  );

-- LESSON_ASSETS
CREATE POLICY "lesson_assets_read" ON public.lesson_assets
  FOR SELECT USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "lesson_assets_manage" ON public.lesson_assets
  FOR ALL USING (
    public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin','staff','super_admin','instructor']::public.app_role[])
  ) WITH CHECK (
    public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin','staff','super_admin','instructor']::public.app_role[])
  );

-- ENROLLMENTS
CREATE POLICY "enroll_read" ON public.enrollments
  FOR SELECT USING (
    student_id = auth.uid()
    OR public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin','staff','super_admin','instructor']::public.app_role[])
  );
CREATE POLICY "enroll_student_insert" ON public.enrollments
  FOR INSERT WITH CHECK (
    (student_id = auth.uid() AND public.is_workspace_member(auth.uid(), workspace_id))
    OR public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin','staff','super_admin']::public.app_role[])
  );
CREATE POLICY "enroll_admin_manage" ON public.enrollments
  FOR UPDATE USING (
    student_id = auth.uid()
    OR public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin','staff','super_admin']::public.app_role[])
  );
CREATE POLICY "enroll_admin_delete" ON public.enrollments
  FOR DELETE USING (
    public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin','staff','super_admin']::public.app_role[])
  );

-- LESSON_PROGRESS
CREATE POLICY "progress_read" ON public.lesson_progress
  FOR SELECT USING (
    student_id = auth.uid()
    OR public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin','staff','super_admin','instructor']::public.app_role[])
  );
CREATE POLICY "progress_student_write" ON public.lesson_progress
  FOR ALL USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid() AND public.is_workspace_member(auth.uid(), workspace_id));

-- QUIZZES
CREATE POLICY "quizzes_read" ON public.quizzes
  FOR SELECT USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "quizzes_manage" ON public.quizzes
  FOR ALL USING (
    public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin','staff','super_admin']::public.app_role[])
    OR public.is_course_instructor(auth.uid(), course_id)
  ) WITH CHECK (
    public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin','staff','super_admin']::public.app_role[])
    OR public.is_course_instructor(auth.uid(), course_id)
  );

-- QUIZ_QUESTIONS
CREATE POLICY "qq_read" ON public.quiz_questions
  FOR SELECT USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "qq_manage" ON public.quiz_questions
  FOR ALL USING (
    public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin','staff','super_admin','instructor']::public.app_role[])
  ) WITH CHECK (
    public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin','staff','super_admin','instructor']::public.app_role[])
  );

-- QUIZ_ATTEMPTS
CREATE POLICY "qa_read" ON public.quiz_attempts
  FOR SELECT USING (
    student_id = auth.uid()
    OR public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin','staff','super_admin','instructor']::public.app_role[])
  );
CREATE POLICY "qa_student_insert" ON public.quiz_attempts
  FOR INSERT WITH CHECK (student_id = auth.uid() AND public.is_workspace_member(auth.uid(), workspace_id));

-- ASSIGNMENTS
CREATE POLICY "assignments_read" ON public.assignments
  FOR SELECT USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "assignments_manage" ON public.assignments
  FOR ALL USING (
    public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin','staff','super_admin']::public.app_role[])
    OR public.is_course_instructor(auth.uid(), course_id)
  ) WITH CHECK (
    public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin','staff','super_admin']::public.app_role[])
    OR public.is_course_instructor(auth.uid(), course_id)
  );

-- ASSIGNMENT_SUBMISSIONS
CREATE POLICY "asub_read" ON public.assignment_submissions
  FOR SELECT USING (
    student_id = auth.uid()
    OR public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin','staff','super_admin','instructor']::public.app_role[])
  );
CREATE POLICY "asub_student_write" ON public.assignment_submissions
  FOR INSERT WITH CHECK (student_id = auth.uid() AND public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "asub_student_update" ON public.assignment_submissions
  FOR UPDATE USING (
    student_id = auth.uid()
    OR public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin','staff','super_admin','instructor']::public.app_role[])
  );

-- STUDENT_NOTES
CREATE POLICY "notes_owner_all" ON public.student_notes
  FOR ALL USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid() AND public.is_workspace_member(auth.uid(), workspace_id));

-- NOTIFICATIONS
CREATE POLICY "notif_read_self" ON public.notifications
  FOR SELECT USING (profile_id = auth.uid());
CREATE POLICY "notif_update_self" ON public.notifications
  FOR UPDATE USING (profile_id = auth.uid());

-- =========================================================================
-- STORAGE BUCKETS
-- =========================================================================
INSERT INTO storage.buckets (id, name, public) VALUES
  ('course-thumbnails', 'course-thumbnails', true),
  ('lesson-assets', 'lesson-assets', false),
  ('submissions', 'submissions', false)
ON CONFLICT (id) DO NOTHING;

-- Path convention: <workspace_id>/<...> — first folder must match a workspace the user belongs to

-- course-thumbnails: public read, workspace staff upload
CREATE POLICY "thumbs_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'course-thumbnails');
CREATE POLICY "thumbs_staff_write" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'course-thumbnails'
    AND public.has_any_workspace_role(auth.uid(), ((storage.foldername(name))[1])::uuid,
      ARRAY['organization_admin','staff','super_admin','instructor']::public.app_role[])
  );
CREATE POLICY "thumbs_staff_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'course-thumbnails'
    AND public.has_any_workspace_role(auth.uid(), ((storage.foldername(name))[1])::uuid,
      ARRAY['organization_admin','staff','super_admin','instructor']::public.app_role[])
  );
CREATE POLICY "thumbs_staff_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'course-thumbnails'
    AND public.has_any_workspace_role(auth.uid(), ((storage.foldername(name))[1])::uuid,
      ARRAY['organization_admin','staff','super_admin']::public.app_role[])
  );

-- lesson-assets: workspace members read
CREATE POLICY "lesson_assets_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'lesson-assets'
    AND public.is_workspace_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );
CREATE POLICY "lesson_assets_staff_write" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'lesson-assets'
    AND public.has_any_workspace_role(auth.uid(), ((storage.foldername(name))[1])::uuid,
      ARRAY['organization_admin','staff','super_admin','instructor']::public.app_role[])
  );
CREATE POLICY "lesson_assets_staff_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'lesson-assets'
    AND public.has_any_workspace_role(auth.uid(), ((storage.foldername(name))[1])::uuid,
      ARRAY['organization_admin','staff','super_admin','instructor']::public.app_role[])
  );

-- submissions: student writes own, instructor/admin read all in workspace
-- Path convention: <workspace_id>/<student_id>/<filename>
CREATE POLICY "subs_read_own_or_staff" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'submissions' AND (
      (storage.foldername(name))[2] = auth.uid()::text
      OR public.has_any_workspace_role(auth.uid(), ((storage.foldername(name))[1])::uuid,
        ARRAY['organization_admin','staff','super_admin','instructor']::public.app_role[])
    )
  );
CREATE POLICY "subs_student_write" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'submissions'
    AND (storage.foldername(name))[2] = auth.uid()::text
    AND public.is_workspace_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );
CREATE POLICY "subs_student_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'submissions' AND (storage.foldername(name))[2] = auth.uid()::text
  );

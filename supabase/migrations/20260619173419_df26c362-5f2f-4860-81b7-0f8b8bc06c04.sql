
-- Enums
ALTER TYPE public.question_type ADD VALUE IF NOT EXISTS 'short_answer';
ALTER TYPE public.question_type ADD VALUE IF NOT EXISTS 'long_answer';
ALTER TYPE public.question_type ADD VALUE IF NOT EXISTS 'fill_blank';
ALTER TYPE public.question_type ADD VALUE IF NOT EXISTS 'matching';
ALTER TYPE public.question_type ADD VALUE IF NOT EXISTS 'ordering';
ALTER TYPE public.question_type ADD VALUE IF NOT EXISTS 'numeric';
ALTER TYPE public.question_type ADD VALUE IF NOT EXISTS 'image_choice';
ALTER TYPE public.question_type ADD VALUE IF NOT EXISTS 'file_upload';

ALTER TYPE public.quiz_status ADD VALUE IF NOT EXISTS 'scheduled';
ALTER TYPE public.quiz_status ADD VALUE IF NOT EXISTS 'archived';

-- Quizzes: comprehensive settings
ALTER TABLE public.quizzes
  ADD COLUMN IF NOT EXISTS feedback_mode text NOT NULL DEFAULT 'after_submission',
  ADD COLUMN IF NOT EXISTS question_layout text NOT NULL DEFAULT 'single_per_page',
  ADD COLUMN IF NOT EXISTS question_order text NOT NULL DEFAULT 'sequential',
  ADD COLUMN IF NOT EXISTS shuffle_answers boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_question_number boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_back_navigation boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS require_sequential_answering boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_result_immediately boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_score boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_correct_answers boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_detailed_feedback boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_question_explanation boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS hide_timer boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_start boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS time_limit_unit text NOT NULL DEFAULT 'minutes',
  ADD COLUMN IF NOT EXISTS passing_marks integer,
  ADD COLUMN IF NOT EXISTS max_questions integer,
  ADD COLUMN IF NOT EXISTS security_settings jsonb NOT NULL DEFAULT
    '{"full_screen":false,"prevent_tab_switching":false,"disable_copy_paste":false,"disable_right_click":false,"disable_text_selection":false,"flag_suspicious_activity":false,"track_focus_loss":false}'::jsonb,
  ADD COLUMN IF NOT EXISTS available_from timestamptz,
  ADD COLUMN IF NOT EXISTS available_until timestamptz,
  ADD COLUMN IF NOT EXISTS access_rules jsonb NOT NULL DEFAULT
    '{"only_enrolled":true,"prerequisite_course_id":null,"minimum_progress_pct":null}'::jsonb,
  ADD COLUMN IF NOT EXISTS proctoring_settings jsonb NOT NULL DEFAULT
    '{"webcam":false,"screen_recording":false,"ai_proctoring":false}'::jsonb;

ALTER TABLE public.quizzes
  DROP CONSTRAINT IF EXISTS quizzes_feedback_mode_chk;
ALTER TABLE public.quizzes
  ADD CONSTRAINT quizzes_feedback_mode_chk
  CHECK (feedback_mode IN ('immediate','retry','review','after_submission','after_quiz_ends','manual'));

ALTER TABLE public.quizzes
  DROP CONSTRAINT IF EXISTS quizzes_question_layout_chk;
ALTER TABLE public.quizzes
  ADD CONSTRAINT quizzes_question_layout_chk
  CHECK (question_layout IN ('single_per_page','multiple_per_page','all_on_one_page'));

ALTER TABLE public.quizzes
  DROP CONSTRAINT IF EXISTS quizzes_question_order_chk;
ALTER TABLE public.quizzes
  ADD CONSTRAINT quizzes_question_order_chk
  CHECK (question_order IN ('sequential','random','shuffle'));

ALTER TABLE public.quizzes
  DROP CONSTRAINT IF EXISTS quizzes_time_limit_unit_chk;
ALTER TABLE public.quizzes
  ADD CONSTRAINT quizzes_time_limit_unit_chk
  CHECK (time_limit_unit IN ('minutes','hours','days'));

-- Quiz questions: extra metadata
ALTER TABLE public.quiz_questions
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS media_type text,
  ADD COLUMN IF NOT EXISTS hint text,
  ADD COLUMN IF NOT EXISTS difficulty text NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS bank_question_id uuid;

ALTER TABLE public.quiz_questions
  DROP CONSTRAINT IF EXISTS quiz_questions_difficulty_chk;
ALTER TABLE public.quiz_questions
  ADD CONSTRAINT quiz_questions_difficulty_chk
  CHECK (difficulty IN ('easy','medium','hard','expert'));

-- Quiz attempts: review/security data
ALTER TABLE public.quiz_attempts
  ADD COLUMN IF NOT EXISTS time_spent_seconds integer,
  ADD COLUMN IF NOT EXISTS flagged_activity_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS manual_review_pending boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS instructor_feedback text,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

-- Question categories
CREATE TABLE IF NOT EXISTS public.question_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.question_categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  slug text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, slug)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_categories TO authenticated;
GRANT ALL ON public.question_categories TO service_role;
ALTER TABLE public.question_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qc_read" ON public.question_categories
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "qc_manage" ON public.question_categories
  FOR ALL TO authenticated
  USING (public.has_any_workspace_role(auth.uid(), workspace_id,
    ARRAY['organization_admin'::app_role,'staff'::app_role,'super_admin'::app_role,'instructor'::app_role]))
  WITH CHECK (public.has_any_workspace_role(auth.uid(), workspace_id,
    ARRAY['organization_admin'::app_role,'staff'::app_role,'super_admin'::app_role,'instructor'::app_role]));

-- Question bank
CREATE TABLE IF NOT EXISTS public.question_bank (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.question_categories(id) ON DELETE SET NULL,
  question_type question_type NOT NULL,
  prompt text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  points integer NOT NULL DEFAULT 1,
  explanation text,
  hint text,
  media_url text,
  media_type text,
  difficulty text NOT NULL DEFAULT 'medium',
  tags text[] NOT NULL DEFAULT '{}'::text[],
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_bank TO authenticated;
GRANT ALL ON public.question_bank TO service_role;
ALTER TABLE public.question_bank ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.question_bank
  DROP CONSTRAINT IF EXISTS question_bank_difficulty_chk;
ALTER TABLE public.question_bank
  ADD CONSTRAINT question_bank_difficulty_chk
  CHECK (difficulty IN ('easy','medium','hard','expert'));

CREATE POLICY "qb_read" ON public.question_bank
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "qb_manage" ON public.question_bank
  FOR ALL TO authenticated
  USING (public.has_any_workspace_role(auth.uid(), workspace_id,
    ARRAY['organization_admin'::app_role,'staff'::app_role,'super_admin'::app_role,'instructor'::app_role]))
  WITH CHECK (public.has_any_workspace_role(auth.uid(), workspace_id,
    ARRAY['organization_admin'::app_role,'staff'::app_role,'super_admin'::app_role,'instructor'::app_role]));

CREATE INDEX IF NOT EXISTS idx_qb_workspace_category ON public.question_bank(workspace_id, category_id);
CREATE INDEX IF NOT EXISTS idx_qb_tags ON public.question_bank USING GIN (tags);

-- updated_at trigger for question_bank
CREATE TRIGGER trg_qb_updated_at
  BEFORE UPDATE ON public.question_bank
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

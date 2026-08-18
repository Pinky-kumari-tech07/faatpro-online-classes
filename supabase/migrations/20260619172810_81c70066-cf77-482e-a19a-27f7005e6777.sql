
-- Enum: scheduled
ALTER TYPE public.assignment_status ADD VALUE IF NOT EXISTS 'scheduled';

-- assignments: extended fields
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS submission_type text NOT NULL DEFAULT 'both',
  ADD COLUMN IF NOT EXISTS submission_guidelines text,
  ADD COLUMN IF NOT EXISTS evaluation_criteria text,
  ADD COLUMN IF NOT EXISTS additional_notes text,
  ADD COLUMN IF NOT EXISTS time_limit integer,
  ADD COLUMN IF NOT EXISTS time_limit_unit text NOT NULL DEFAULT 'minutes',
  ADD COLUMN IF NOT EXISTS start_at timestamptz,
  ADD COLUMN IF NOT EXISTS late_penalty_pct numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS passing_marks integer,
  ADD COLUMN IF NOT EXISTS grading_type text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS rubric jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS max_files integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS allow_resubmission boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_resubmissions integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS scheduled_publish_at timestamptz,
  ADD COLUMN IF NOT EXISTS notify_settings jsonb NOT NULL DEFAULT
    '{"on_publish":true,"on_deadline_approaching":true,"on_graded":true,"on_feedback_added":true}'::jsonb,
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.assignments
  DROP CONSTRAINT IF EXISTS assignments_submission_type_chk;
ALTER TABLE public.assignments
  ADD CONSTRAINT assignments_submission_type_chk
  CHECK (submission_type IN ('file','text','both'));

ALTER TABLE public.assignments
  DROP CONSTRAINT IF EXISTS assignments_time_limit_unit_chk;
ALTER TABLE public.assignments
  ADD CONSTRAINT assignments_time_limit_unit_chk
  CHECK (time_limit_unit IN ('minutes','hours','days','weeks'));

ALTER TABLE public.assignments
  DROP CONSTRAINT IF EXISTS assignments_grading_type_chk;
ALTER TABLE public.assignments
  ADD CONSTRAINT assignments_grading_type_chk
  CHECK (grading_type IN ('manual','automatic','rubric'));

-- assignment_submissions: extended fields
ALTER TABLE public.assignment_submissions
  ADD COLUMN IF NOT EXISTS attempt_number integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS file_paths jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_draft boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS public_feedback text,
  ADD COLUMN IF NOT EXISTS private_feedback text,
  ADD COLUMN IF NOT EXISTS feedback_file_path text,
  ADD COLUMN IF NOT EXISTS returned_for_revision_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_late boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rubric_scores jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS passed boolean;

-- Migrate legacy single file_path into file_paths array
UPDATE public.assignment_submissions
   SET file_paths = jsonb_build_array(file_path)
 WHERE file_path IS NOT NULL
   AND (file_paths IS NULL OR jsonb_array_length(file_paths) = 0);

-- History snapshots
CREATE TABLE IF NOT EXISTS public.assignment_submission_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  submission_id uuid NOT NULL REFERENCES public.assignment_submissions(id) ON DELETE CASCADE,
  assignment_id uuid NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  attempt_number integer NOT NULL,
  submission_text text,
  file_paths jsonb NOT NULL DEFAULT '[]'::jsonb,
  grade numeric,
  public_feedback text,
  private_feedback text,
  status text,
  snapshot_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.assignment_submission_history TO authenticated;
GRANT ALL ON public.assignment_submission_history TO service_role;
ALTER TABLE public.assignment_submission_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ash_read" ON public.assignment_submission_history
  FOR SELECT TO authenticated
  USING (
    student_id = auth.uid()
    OR public.has_any_workspace_role(auth.uid(), workspace_id,
        ARRAY['organization_admin'::app_role,'staff'::app_role,'super_admin'::app_role,'instructor'::app_role])
  );
CREATE POLICY "ash_insert" ON public.assignment_submission_history
  FOR INSERT TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    OR public.has_any_workspace_role(auth.uid(), workspace_id,
        ARRAY['organization_admin'::app_role,'staff'::app_role,'super_admin'::app_role,'instructor'::app_role])
  );

CREATE INDEX IF NOT EXISTS idx_ash_submission ON public.assignment_submission_history(submission_id);
CREATE INDEX IF NOT EXISTS idx_ash_assignment ON public.assignment_submission_history(assignment_id);
CREATE INDEX IF NOT EXISTS idx_ash_student ON public.assignment_submission_history(student_id);


CREATE TABLE public.quiz_import_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  quiz_id UUID REFERENCES public.quizzes(id) ON DELETE SET NULL,
  course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  imported_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  file_name TEXT,
  total_rows INTEGER NOT NULL DEFAULT 0,
  imported_rows INTEGER NOT NULL DEFAULT 0,
  skipped_rows INTEGER NOT NULL DEFAULT 0,
  error_rows INTEGER NOT NULL DEFAULT 0,
  saved_to_bank BOOLEAN NOT NULL DEFAULT false,
  ip_address TEXT,
  user_agent TEXT,
  errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.quiz_import_log TO authenticated;
GRANT ALL ON public.quiz_import_log TO service_role;

ALTER TABLE public.quiz_import_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qil_own_insert" ON public.quiz_import_log
  FOR INSERT TO authenticated
  WITH CHECK (imported_by = auth.uid() AND is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "qil_read_own_or_admin" ON public.quiz_import_log
  FOR SELECT TO authenticated
  USING (
    imported_by = auth.uid()
    OR has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role,'staff'::app_role,'super_admin'::app_role])
  );

CREATE INDEX idx_qil_workspace_created ON public.quiz_import_log(workspace_id, created_at DESC);
CREATE INDEX idx_qil_quiz ON public.quiz_import_log(quiz_id);

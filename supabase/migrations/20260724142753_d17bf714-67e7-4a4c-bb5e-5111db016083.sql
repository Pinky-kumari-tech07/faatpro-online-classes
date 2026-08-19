
CREATE TABLE IF NOT EXISTS public.course_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  file_name text NOT NULL,
  storage_path text,
  public_url text NOT NULL,
  mime_type text,
  file_size bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_assets TO authenticated;
GRANT ALL ON public.course_assets TO service_role;

ALTER TABLE public.course_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "course_assets_read"
  ON public.course_assets FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "course_assets_admin_manage"
  ON public.course_assets FOR ALL TO authenticated
  USING (public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role, 'super_admin'::app_role]))
  WITH CHECK (public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role, 'super_admin'::app_role]));

CREATE POLICY "course_assets_instructor_manage"
  ON public.course_assets FOR ALL TO authenticated
  USING (public.has_workspace_role(auth.uid(), workspace_id, 'instructor'::app_role))
  WITH CHECK (public.has_workspace_role(auth.uid(), workspace_id, 'instructor'::app_role));

CREATE INDEX IF NOT EXISTS course_assets_course_idx ON public.course_assets(course_id);

CREATE TABLE IF NOT EXISTS public.course_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  icon text,
  description text,
  status text NOT NULL DEFAULT 'active',
  is_trending boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  course_count integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_course_categories_ws ON public.course_categories(workspace_id);
CREATE INDEX IF NOT EXISTS idx_course_categories_trending ON public.course_categories(workspace_id, is_trending, sort_order) WHERE status = 'active';

ALTER TABLE public.course_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY cc_public_read_trending ON public.course_categories
  FOR SELECT TO anon, authenticated
  USING (status = 'active' AND is_trending = true);

CREATE POLICY cc_member_read ON public.course_categories
  FOR SELECT TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY cc_admin_manage ON public.course_categories
  FOR ALL TO authenticated
  USING (has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role, 'super_admin'::app_role, 'staff'::app_role]))
  WITH CHECK (has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role, 'super_admin'::app_role, 'staff'::app_role]));

CREATE TRIGGER course_categories_set_updated_at
  BEFORE UPDATE ON public.course_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
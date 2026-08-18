
CREATE TABLE public.student_notices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL,
  title TEXT NOT NULL,
  link_url TEXT,
  link_label TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_notices TO authenticated;
GRANT ALL ON public.student_notices TO service_role;

ALTER TABLE public.student_notices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notices_read" ON public.student_notices
FOR SELECT TO authenticated
USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "notices_manage" ON public.student_notices
FOR ALL TO authenticated
USING (public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role, 'staff'::app_role, 'super_admin'::app_role]))
WITH CHECK (public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role, 'staff'::app_role, 'super_admin'::app_role]));

CREATE TRIGGER set_student_notices_updated_at
BEFORE UPDATE ON public.student_notices
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_student_notices_ws_active ON public.student_notices(workspace_id, is_active, sort_order);

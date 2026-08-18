
CREATE TABLE public.workspace_integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL,
  provider TEXT NOT NULL,
  category TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  mode TEXT,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, provider)
);

ALTER TABLE public.workspace_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wi_admin_manage" ON public.workspace_integrations
  FOR ALL
  USING (public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role, 'super_admin'::app_role]))
  WITH CHECK (public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role, 'super_admin'::app_role]));

CREATE TRIGGER trg_wi_updated_at
  BEFORE UPDATE ON public.workspace_integrations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

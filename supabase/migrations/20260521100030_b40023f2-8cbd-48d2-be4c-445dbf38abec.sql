
CREATE TABLE IF NOT EXISTS public.contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NULL,
  name text NOT NULL,
  email text NOT NULL,
  phone text NULL,
  subject text NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contact_public_insert" ON public.contact_messages
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "contact_admin_read" ON public.contact_messages
  FOR SELECT TO authenticated
  USING (
    workspace_id IS NULL
    OR public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role,'staff'::app_role,'super_admin'::app_role])
  );

CREATE POLICY "contact_admin_update" ON public.contact_messages
  FOR UPDATE TO authenticated
  USING (
    workspace_id IS NULL
    OR public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role,'staff'::app_role,'super_admin'::app_role])
  );

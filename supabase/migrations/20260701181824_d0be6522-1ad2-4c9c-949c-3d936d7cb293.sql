
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS ip_address text,
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.support_tickets ALTER COLUMN user_id DROP NOT NULL;

-- Allow staff to view website tickets (user_id may be NULL)
DROP POLICY IF EXISTS tickets_select_owner_or_staff ON public.support_tickets;
CREATE POLICY tickets_select_owner_or_staff ON public.support_tickets
FOR SELECT TO authenticated
USING (
  (user_id IS NOT NULL AND user_id = auth.uid())
  OR (workspace_id IS NOT NULL AND has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role,'staff'::app_role,'super_admin'::app_role,'instructor'::app_role]))
  OR is_super_admin(auth.uid())
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_type ON public.support_tickets(type);

-- Public RPC to submit a website inquiry
CREATE OR REPLACE FUNCTION public.submit_website_inquiry(
  p_name text,
  p_email text,
  p_phone text,
  p_subject text,
  p_message text,
  p_user_agent text DEFAULT NULL,
  p_ip text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_ws uuid;
  ticket_id uuid;
  num text;
  clean_name text := nullif(btrim(p_name), '');
  clean_email text := lower(nullif(btrim(p_email), ''));
  clean_subject text := nullif(btrim(p_subject), '');
  clean_message text := nullif(btrim(p_message), '');
BEGIN
  IF clean_name IS NULL OR clean_email IS NULL OR clean_message IS NULL THEN
    RAISE EXCEPTION 'Name, email and message are required';
  END IF;
  IF clean_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Invalid email format';
  END IF;
  IF length(clean_message) < 5 OR length(clean_message) > 4000 THEN
    RAISE EXCEPTION 'Message must be between 5 and 4000 characters';
  END IF;

  -- Save to contact_messages
  INSERT INTO public.contact_messages (name, email, phone, subject, message)
  VALUES (left(clean_name,120), left(clean_email,255), left(coalesce(p_phone,''),40),
          left(coalesce(clean_subject,'Website Inquiry'),200), left(clean_message,4000));

  -- Pick a workspace with an organization_admin
  SELECT a.workspace_id INTO target_ws
  FROM workspace_members a
  WHERE a.status = 'active' AND a.role = 'organization_admin'
  ORDER BY a.created_at ASC NULLS LAST
  LIMIT 1;

  IF target_ws IS NULL THEN
    -- No admin workspace; still record contact_message success
    RETURN NULL;
  END IF;

  num := 'WEB-' || lpad(nextval('public.support_ticket_seq')::text, 4, '0');

  INSERT INTO public.support_tickets (
    workspace_id, ticket_number, user_id, user_role, user_name, user_email,
    phone, topic, subject, status, type, source, priority, ip_address, user_agent, metadata
  ) VALUES (
    target_ws, num, NULL, 'visitor', left(clean_name,120), left(clean_email,255),
    left(coalesce(p_phone,''),40), 'Website Inquiry',
    left(coalesce(clean_subject,'Website Inquiry'),200),
    'open'::support_status, 'website', 'contact_form', 'normal',
    left(coalesce(p_ip,''),64), left(coalesce(p_user_agent,''),512),
    jsonb_build_object('assigned_to','unassigned')
  ) RETURNING id INTO ticket_id;

  INSERT INTO public.support_messages (ticket_id, sender_id, sender_role, message)
  VALUES (ticket_id, NULL, 'visitor', clean_message);

  RETURN ticket_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_website_inquiry(text,text,text,text,text,text,text) TO anon, authenticated;

-- Allow NULL sender in support_messages for visitor messages
ALTER TABLE public.support_messages ALTER COLUMN sender_id DROP NOT NULL;

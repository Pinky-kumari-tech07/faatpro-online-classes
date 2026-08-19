
-- Ticket number sequence
CREATE SEQUENCE IF NOT EXISTS public.support_ticket_seq START 1;

-- Status enum
DO $$ BEGIN
  CREATE TYPE public.support_status AS ENUM ('open','pending','resolved','closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid,
  ticket_number text NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  user_role text NOT NULL DEFAULT 'student',
  user_name text,
  user_email text,
  topic text NOT NULL DEFAULT 'Other',
  subject text NOT NULL,
  status public.support_status NOT NULL DEFAULT 'open',
  assigned_to uuid,
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_support_tickets_user ON public.support_tickets(user_id);
CREATE INDEX idx_support_tickets_ws ON public.support_tickets(workspace_id);
CREATE INDEX idx_support_tickets_status ON public.support_tickets(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
GRANT USAGE ON SEQUENCE public.support_ticket_seq TO authenticated, service_role;

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tickets_select_owner_or_staff" ON public.support_tickets FOR SELECT
TO authenticated USING (
  user_id = auth.uid()
  OR (workspace_id IS NOT NULL AND public.has_any_workspace_role(auth.uid(), workspace_id,
      ARRAY['organization_admin'::app_role,'staff'::app_role,'super_admin'::app_role,'instructor'::app_role]))
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "tickets_insert_self" ON public.support_tickets FOR INSERT
TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "tickets_update_owner_or_staff" ON public.support_tickets FOR UPDATE
TO authenticated USING (
  user_id = auth.uid()
  OR (workspace_id IS NOT NULL AND public.has_any_workspace_role(auth.uid(), workspace_id,
      ARRAY['organization_admin'::app_role,'staff'::app_role,'super_admin'::app_role]))
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "tickets_delete_staff" ON public.support_tickets FOR DELETE
TO authenticated USING (
  (workspace_id IS NOT NULL AND public.has_any_workspace_role(auth.uid(), workspace_id,
      ARRAY['organization_admin'::app_role,'super_admin'::app_role]))
  OR public.is_super_admin(auth.uid())
);

-- Messages
CREATE TABLE public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  sender_role text NOT NULL DEFAULT 'student',
  message text NOT NULL,
  attachment_url text,
  is_internal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_support_messages_ticket ON public.support_messages(ticket_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_messages TO authenticated;
GRANT ALL ON public.support_messages TO service_role;

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "msgs_select" ON public.support_messages FOR SELECT
TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.support_tickets t
    WHERE t.id = ticket_id AND (
      (t.user_id = auth.uid() AND is_internal = false)
      OR (t.workspace_id IS NOT NULL AND public.has_any_workspace_role(auth.uid(), t.workspace_id,
            ARRAY['organization_admin'::app_role,'staff'::app_role,'super_admin'::app_role,'instructor'::app_role]))
      OR public.is_super_admin(auth.uid())
    )
  )
);

CREATE POLICY "msgs_insert" ON public.support_messages FOR INSERT
TO authenticated WITH CHECK (
  sender_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.support_tickets t
    WHERE t.id = ticket_id AND (
      t.user_id = auth.uid()
      OR (t.workspace_id IS NOT NULL AND public.has_any_workspace_role(auth.uid(), t.workspace_id,
            ARRAY['organization_admin'::app_role,'staff'::app_role,'super_admin'::app_role,'instructor'::app_role]))
      OR public.is_super_admin(auth.uid())
    )
  )
);

-- Trigger to update last_activity_at on new message
CREATE OR REPLACE FUNCTION public.support_msg_touch_ticket()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  UPDATE public.support_tickets SET last_activity_at = now(), updated_at = now()
  WHERE id = NEW.ticket_id;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_support_msg_touch AFTER INSERT ON public.support_messages
FOR EACH ROW EXECUTE FUNCTION public.support_msg_touch_ticket();

CREATE TRIGGER trg_support_tickets_updated BEFORE UPDATE ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RPC: create ticket
CREATE OR REPLACE FUNCTION public.create_support_ticket(
  p_topic text, p_subject text, p_message text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  uid uuid := auth.uid();
  target_ws uuid;
  ticket_id uuid;
  num text;
  uname text;
  uemail text;
  urole text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- Find a workspace with admins where user is a member
  SELECT wm.workspace_id INTO target_ws
  FROM workspace_members wm
  WHERE wm.profile_id = uid AND wm.status='active'
    AND EXISTS (SELECT 1 FROM workspace_members a WHERE a.workspace_id=wm.workspace_id
                AND a.status='active' AND a.role IN ('organization_admin','staff','super_admin')
                AND a.profile_id <> uid)
  ORDER BY wm.workspace_id LIMIT 1;

  IF target_ws IS NULL THEN
    SELECT a.workspace_id INTO target_ws FROM workspace_members a
    WHERE a.status='active' AND a.role='organization_admin' LIMIT 1;
  END IF;

  SELECT full_name, email INTO uname, uemail FROM profiles WHERE id = uid;

  SELECT role::text INTO urole FROM workspace_members
  WHERE profile_id=uid AND status='active'
  ORDER BY CASE role::text
    WHEN 'student' THEN 1 WHEN 'instructor' THEN 2
    WHEN 'staff' THEN 3 WHEN 'organization_admin' THEN 4 ELSE 5 END
  LIMIT 1;
  urole := COALESCE(urole,'student');

  num := 'SUP-' || lpad(nextval('public.support_ticket_seq')::text, 4, '0');

  INSERT INTO support_tickets (workspace_id, ticket_number, user_id, user_role, user_name, user_email, topic, subject)
  VALUES (target_ws, num, uid, urole, uname, uemail, COALESCE(p_topic,'Other'), p_subject)
  RETURNING id INTO ticket_id;

  INSERT INTO support_messages (ticket_id, sender_id, sender_role, message)
  VALUES (ticket_id, uid, urole, p_message);

  RETURN ticket_id;
END $$;

GRANT EXECUTE ON FUNCTION public.create_support_ticket(text,text,text) TO authenticated;

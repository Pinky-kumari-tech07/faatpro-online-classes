
-- ============ ENUMS ============
DO $$ BEGIN
  CREATE TYPE public.attendance_status AS ENUM ('present','absent','late','excused');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.announcement_target AS ENUM ('workspace','course','role');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.announcement_status AS ENUM ('draft','scheduled','published','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.invoice_status AS ENUM ('draft','issued','paid','void','refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ ATTENDANCE ============
CREATE TABLE IF NOT EXISTS public.attendance_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  course_id uuid NOT NULL,
  live_class_id uuid,
  title text NOT NULL,
  session_date timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "att_sessions_read" ON public.attendance_sessions FOR SELECT
  USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "att_sessions_manage" ON public.attendance_sessions FOR ALL
  USING (public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin','staff','super_admin','instructor']::app_role[]))
  WITH CHECK (public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin','staff','super_admin','instructor']::app_role[]));

CREATE TABLE IF NOT EXISTS public.attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  session_id uuid NOT NULL,
  student_id uuid NOT NULL,
  status public.attendance_status NOT NULL DEFAULT 'present',
  notes text,
  marked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, student_id)
);
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "att_records_read" ON public.attendance_records FOR SELECT
  USING (student_id = auth.uid() OR public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin','staff','super_admin','instructor']::app_role[]));
CREATE POLICY "att_records_manage" ON public.attendance_records FOR ALL
  USING (public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin','staff','super_admin','instructor']::app_role[]))
  WITH CHECK (public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin','staff','super_admin','instructor']::app_role[]));

-- ============ ANNOUNCEMENTS ============
CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  title text NOT NULL,
  body text,
  target_type public.announcement_target NOT NULL DEFAULT 'workspace',
  target_id uuid,
  target_role app_role,
  publish_at timestamptz,
  status public.announcement_status NOT NULL DEFAULT 'draft',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ann_read" ON public.announcements FOR SELECT
  USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "ann_manage" ON public.announcements FOR ALL
  USING (public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin','staff','super_admin','instructor']::app_role[]))
  WITH CHECK (public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin','staff','super_admin','instructor']::app_role[]));

-- ============ MESSAGING ============
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  title text,
  is_group boolean NOT NULL DEFAULT false,
  created_by uuid,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.conversation_participants (
  conversation_id uuid NOT NULL,
  profile_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  last_read_at timestamptz,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, profile_id)
);
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_conversation_participant(_user_id uuid, _conversation_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.conversation_participants WHERE conversation_id = _conversation_id AND profile_id = _user_id);
$$;

CREATE POLICY "conv_read" ON public.conversations FOR SELECT
  USING (public.is_conversation_participant(auth.uid(), id));
CREATE POLICY "conv_insert" ON public.conversations FOR INSERT
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "conv_update" ON public.conversations FOR UPDATE
  USING (public.is_conversation_participant(auth.uid(), id));

CREATE POLICY "cp_read" ON public.conversation_participants FOR SELECT
  USING (profile_id = auth.uid() OR public.is_conversation_participant(auth.uid(), conversation_id));
CREATE POLICY "cp_insert" ON public.conversation_participants FOR INSERT
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "cp_update" ON public.conversation_participants FOR UPDATE
  USING (profile_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  conversation_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "msg_read" ON public.messages FOR SELECT
  USING (public.is_conversation_participant(auth.uid(), conversation_id));
CREATE POLICY "msg_insert" ON public.messages FOR INSERT
  WITH CHECK (sender_id = auth.uid() AND public.is_conversation_participant(auth.uid(), conversation_id));

-- ============ DISCUSSIONS ============
CREATE TABLE IF NOT EXISTS public.discussions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  course_id uuid NOT NULL,
  lesson_id uuid,
  author_id uuid NOT NULL,
  title text NOT NULL,
  body text,
  is_pinned boolean NOT NULL DEFAULT false,
  is_locked boolean NOT NULL DEFAULT false,
  reply_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.discussions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "disc_read" ON public.discussions FOR SELECT
  USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "disc_insert" ON public.discussions FOR INSERT
  WITH CHECK (author_id = auth.uid() AND public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "disc_update" ON public.discussions FOR UPDATE
  USING (author_id = auth.uid() OR public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin','staff','super_admin','instructor']::app_role[]));
CREATE POLICY "disc_delete" ON public.discussions FOR DELETE
  USING (author_id = auth.uid() OR public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin','staff','super_admin','instructor']::app_role[]));

CREATE TABLE IF NOT EXISTS public.discussion_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  discussion_id uuid NOT NULL,
  author_id uuid NOT NULL,
  body text NOT NULL,
  is_instructor_answer boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.discussion_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dr_read" ON public.discussion_replies FOR SELECT
  USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "dr_insert" ON public.discussion_replies FOR INSERT
  WITH CHECK (author_id = auth.uid() AND public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "dr_update" ON public.discussion_replies FOR UPDATE
  USING (author_id = auth.uid() OR public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin','staff','super_admin','instructor']::app_role[]));
CREATE POLICY "dr_delete" ON public.discussion_replies FOR DELETE
  USING (author_id = auth.uid() OR public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin','staff','super_admin','instructor']::app_role[]));

-- ============ INVOICES ============
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  payment_id uuid,
  student_id uuid NOT NULL,
  course_id uuid,
  invoice_number text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  tax numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  gst_number text,
  status public.invoice_status NOT NULL DEFAULT 'issued',
  issued_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, invoice_number)
);
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inv_read" ON public.invoices FOR SELECT
  USING (student_id = auth.uid() OR public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin','staff','super_admin']::app_role[]));
CREATE POLICY "inv_manage" ON public.invoices FOR ALL
  USING (public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin','staff','super_admin']::app_role[]))
  WITH CHECK (public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin','staff','super_admin']::app_role[]));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_att_sessions_workspace_course ON public.attendance_sessions (workspace_id, course_id);
CREATE INDEX IF NOT EXISTS idx_att_records_session ON public.attendance_records (session_id);
CREATE INDEX IF NOT EXISTS idx_announcements_workspace ON public.announcements (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages (conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_discussions_workspace_course ON public.discussions (workspace_id, course_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_discussion_replies_disc ON public.discussion_replies (discussion_id, created_at);
CREATE INDEX IF NOT EXISTS idx_invoices_workspace ON public.invoices (workspace_id, issued_at DESC);

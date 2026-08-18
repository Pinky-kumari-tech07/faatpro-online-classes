
-- Conversations
DROP POLICY IF EXISTS conv_insert ON public.conversations;
DROP POLICY IF EXISTS conv_read ON public.conversations;
DROP POLICY IF EXISTS conv_update ON public.conversations;

CREATE POLICY conv_insert ON public.conversations
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND created_by = auth.uid()
    AND public.is_workspace_member(auth.uid(), workspace_id)
  );

CREATE POLICY conv_read ON public.conversations
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR public.is_conversation_participant(auth.uid(), id)
  );

CREATE POLICY conv_update ON public.conversations
  FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR public.is_conversation_participant(auth.uid(), id)
  );

-- Conversation participants
DROP POLICY IF EXISTS cp_insert ON public.conversation_participants;
DROP POLICY IF EXISTS cp_read ON public.conversation_participants;
DROP POLICY IF EXISTS cp_update ON public.conversation_participants;

CREATE POLICY cp_insert ON public.conversation_participants
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND public.is_workspace_member(auth.uid(), workspace_id)
    AND (
      profile_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.id = conversation_id AND c.created_by = auth.uid()
      )
    )
  );

CREATE POLICY cp_read ON public.conversation_participants
  FOR SELECT TO authenticated
  USING (
    profile_id = auth.uid()
    OR public.is_conversation_participant(auth.uid(), conversation_id)
  );

CREATE POLICY cp_update ON public.conversation_participants
  FOR UPDATE TO authenticated
  USING (profile_id = auth.uid());

-- Messages
DROP POLICY IF EXISTS msg_insert ON public.messages;
DROP POLICY IF EXISTS msg_read ON public.messages;

CREATE POLICY msg_insert ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND sender_id = auth.uid()
    AND public.is_conversation_participant(auth.uid(), conversation_id)
  );

CREATE POLICY msg_read ON public.messages
  FOR SELECT TO authenticated
  USING (public.is_conversation_participant(auth.uid(), conversation_id));


-- 1) Merge existing duplicate 1:1 conversations (keep earliest)
DO $$
DECLARE r RECORD; keeper uuid; dup uuid;
BEGIN
  FOR r IN
    SELECT workspace_id, u1, u2, array_agg(cid ORDER BY created_at) AS cids
    FROM (
      SELECT c.id AS cid, c.workspace_id, c.created_at,
             LEAST((array_agg(cp.profile_id ORDER BY cp.profile_id))[1],
                   (array_agg(cp.profile_id ORDER BY cp.profile_id))[2]) AS u1,
             GREATEST((array_agg(cp.profile_id ORDER BY cp.profile_id))[1],
                      (array_agg(cp.profile_id ORDER BY cp.profile_id))[2]) AS u2,
             count(cp.*) AS n
      FROM public.conversations c
      JOIN public.conversation_participants cp ON cp.conversation_id = c.id
      WHERE c.is_group = false
      GROUP BY c.id
      HAVING count(cp.*) = 2
    ) t
    GROUP BY workspace_id, u1, u2
    HAVING count(*) > 1
  LOOP
    keeper := r.cids[1];
    FOREACH dup IN ARRAY r.cids[2:] LOOP
      UPDATE public.messages SET conversation_id = keeper WHERE conversation_id = dup;
      UPDATE public.notifications SET source_id = keeper WHERE source_id = dup AND event_type = 'admin_message';
      DELETE FROM public.conversation_participants WHERE conversation_id = dup;
      DELETE FROM public.conversations WHERE id = dup;
    END LOOP;
    UPDATE public.conversations SET last_message_at = COALESCE(
      (SELECT max(created_at) FROM public.messages WHERE conversation_id = keeper),
      last_message_at
    ) WHERE id = keeper;
  END LOOP;
END $$;

-- 2) Uniqueness table for direct conversations
CREATE TABLE IF NOT EXISTS public.direct_conversation_keys (
  workspace_id uuid NOT NULL,
  user_a uuid NOT NULL,
  user_b uuid NOT NULL,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  PRIMARY KEY (workspace_id, user_a, user_b),
  CHECK (user_a < user_b)
);
GRANT SELECT ON public.direct_conversation_keys TO authenticated;
GRANT ALL ON public.direct_conversation_keys TO service_role;
ALTER TABLE public.direct_conversation_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dck_read" ON public.direct_conversation_keys
  FOR SELECT TO authenticated
  USING (user_a = auth.uid() OR user_b = auth.uid());

-- Backfill from existing 1:1 conversations
INSERT INTO public.direct_conversation_keys (workspace_id, user_a, user_b, conversation_id)
SELECT c.workspace_id,
       LEAST(x.a, x.b), GREATEST(x.a, x.b), c.id
FROM public.conversations c
JOIN LATERAL (
  SELECT (array_agg(profile_id ORDER BY profile_id))[1] AS a,
         (array_agg(profile_id ORDER BY profile_id))[2] AS b,
         count(*) AS n
  FROM public.conversation_participants
  WHERE conversation_id = c.id
) x ON true
WHERE c.is_group = false AND x.n = 2
ON CONFLICT DO NOTHING;

-- 3) Atomic find-or-create RPC
CREATE OR REPLACE FUNCTION public.get_or_create_direct_conversation(_workspace_id uuid, _other_user uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  ua uuid; ub uuid;
  conv uuid;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _other_user IS NULL OR me = _other_user THEN RAISE EXCEPTION 'invalid recipient'; END IF;
  ua := LEAST(me, _other_user);
  ub := GREATEST(me, _other_user);

  -- Serialize concurrent callers for the same pair+workspace
  PERFORM pg_advisory_xact_lock(hashtextextended(_workspace_id::text || ua::text || ub::text, 0));

  SELECT conversation_id INTO conv
  FROM public.direct_conversation_keys
  WHERE workspace_id = _workspace_id AND user_a = ua AND user_b = ub;
  IF conv IS NOT NULL THEN RETURN conv; END IF;

  INSERT INTO public.conversations (workspace_id, is_group, created_by)
  VALUES (_workspace_id, false, me)
  RETURNING id INTO conv;

  INSERT INTO public.conversation_participants (conversation_id, profile_id, workspace_id)
  VALUES (conv, me, _workspace_id), (conv, _other_user, _workspace_id);

  INSERT INTO public.direct_conversation_keys (workspace_id, user_a, user_b, conversation_id)
  VALUES (_workspace_id, ua, ub, conv);

  RETURN conv;
END $$;

GRANT EXECUTE ON FUNCTION public.get_or_create_direct_conversation(uuid, uuid) TO authenticated;


CREATE OR REPLACE FUNCTION public.submit_student_support(p_subject text, p_message text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  target_ws uuid;
  conv_id uuid;
  admin_ids uuid[];
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- Prefer a workspace where the student is already a member AND admins exist
  SELECT wm.workspace_id INTO target_ws
  FROM workspace_members wm
  WHERE wm.profile_id = uid AND wm.status = 'active'
    AND EXISTS (
      SELECT 1 FROM workspace_members a
      WHERE a.workspace_id = wm.workspace_id
        AND a.status = 'active'
        AND a.role IN ('organization_admin','staff','super_admin')
        AND a.profile_id <> uid
    )
  ORDER BY wm.workspace_id
  LIMIT 1;

  -- Else, pick any workspace that has an organization_admin
  IF target_ws IS NULL THEN
    SELECT a.workspace_id INTO target_ws
    FROM workspace_members a
    WHERE a.status = 'active' AND a.role = 'organization_admin'
    ORDER BY a.created_at ASC NULLS LAST
    LIMIT 1;
  END IF;

  IF target_ws IS NULL THEN RAISE EXCEPTION 'No admin workspace available'; END IF;

  -- Ensure student is a member of target workspace
  INSERT INTO workspace_members (workspace_id, profile_id, role, status)
  VALUES (target_ws, uid, 'student'::app_role, 'active'::member_status)
  ON CONFLICT (workspace_id, profile_id, role) DO NOTHING;

  -- Gather admin ids in that workspace
  SELECT array_agg(DISTINCT profile_id) INTO admin_ids
  FROM workspace_members
  WHERE workspace_id = target_ws
    AND status = 'active'
    AND role IN ('organization_admin','staff','super_admin')
    AND profile_id <> uid;

  IF admin_ids IS NULL OR array_length(admin_ids,1) = 0 THEN
    RAISE EXCEPTION 'No admins to deliver to';
  END IF;

  INSERT INTO conversations (workspace_id, created_by, is_group, title, last_message_at)
  VALUES (target_ws, uid, array_length(admin_ids,1) > 1, left('Support: ' || p_subject, 200), now())
  RETURNING id INTO conv_id;

  INSERT INTO conversation_participants (conversation_id, profile_id, workspace_id)
  VALUES (conv_id, uid, target_ws);

  INSERT INTO conversation_participants (conversation_id, profile_id, workspace_id)
  SELECT conv_id, a, target_ws FROM unnest(admin_ids) AS a
  ON CONFLICT DO NOTHING;

  INSERT INTO messages (workspace_id, conversation_id, sender_id, body)
  VALUES (target_ws, conv_id, uid, p_message);

  RETURN conv_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_student_support(text, text) TO authenticated;

-- ============ Tables ============

CREATE TABLE IF NOT EXISTS public.workspace_security_settings (
  workspace_id uuid PRIMARY KEY,
  max_devices integer NOT NULL DEFAULT 3,
  session_expiry_days integer NOT NULL DEFAULT 30,
  allow_multi_device boolean NOT NULL DEFAULT true,
  auto_logout_oldest boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.workspace_security_settings TO authenticated;
GRANT ALL ON public.workspace_security_settings TO service_role;

ALTER TABLE public.workspace_security_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY wss_read ON public.workspace_security_settings
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY wss_admin_manage ON public.workspace_security_settings
  FOR ALL TO authenticated
  USING (public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role, 'staff'::app_role, 'super_admin'::app_role]))
  WITH CHECK (public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role, 'staff'::app_role, 'super_admin'::app_role]));

CREATE TRIGGER wss_set_updated_at
  BEFORE UPDATE ON public.workspace_security_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


CREATE TABLE IF NOT EXISTS public.user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  workspace_id uuid,
  session_token text NOT NULL UNIQUE,
  device_name text,
  device_type text,
  browser text,
  operating_system text,
  ip_address text,
  location text,
  user_agent text,
  login_time timestamptz NOT NULL DEFAULT now(),
  last_active timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  revoked_at timestamptz,
  revoked_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON public.user_sessions(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_user_sessions_workspace ON public.user_sessions(workspace_id, is_active);

GRANT SELECT, INSERT, UPDATE ON public.user_sessions TO authenticated;
GRANT ALL ON public.user_sessions TO service_role;

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Owner can read own sessions; workspace admins can read sessions in their workspace
CREATE POLICY us_read ON public.user_sessions
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (workspace_id IS NOT NULL AND public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role, 'staff'::app_role, 'super_admin'::app_role]))
  );

-- Owners insert/update only their own sessions
CREATE POLICY us_insert_self ON public.user_sessions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY us_update_self_or_admin ON public.user_sessions
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR (workspace_id IS NOT NULL AND public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role, 'staff'::app_role, 'super_admin'::app_role]))
  )
  WITH CHECK (
    user_id = auth.uid()
    OR (workspace_id IS NOT NULL AND public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role, 'staff'::app_role, 'super_admin'::app_role]))
  );


-- ============ Functions ============

-- Get or create security settings for a workspace
CREATE OR REPLACE FUNCTION public.get_security_settings(_workspace_id uuid)
RETURNS public.workspace_security_settings
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.workspace_security_settings;
BEGIN
  SELECT * INTO s FROM public.workspace_security_settings WHERE workspace_id = _workspace_id;
  IF NOT FOUND THEN
    -- Return defaults (don't insert here; insert is admin-driven)
    s.workspace_id := _workspace_id;
    s.max_devices := 3;
    s.session_expiry_days := 30;
    s.allow_multi_device := true;
    s.auto_logout_oldest := true;
  END IF;
  RETURN s;
END;
$$;

-- Register a new session, enforce device limit
CREATE OR REPLACE FUNCTION public.register_user_session(
  p_token text,
  p_workspace_id uuid,
  p_device_name text,
  p_device_type text,
  p_browser text,
  p_os text,
  p_ip text,
  p_location text,
  p_user_agent text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.workspace_security_settings;
  uid uuid := auth.uid();
  active_count int;
  session_row public.user_sessions;
  expiry timestamptz;
  oldest_id uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- If token already exists for this user, treat as heartbeat
  UPDATE public.user_sessions
     SET last_active = now(),
         ip_address = COALESCE(p_ip, ip_address),
         location   = COALESCE(p_location, location),
         is_active  = true,
         revoked_at = NULL,
         revoked_reason = NULL
   WHERE session_token = p_token AND user_id = uid
   RETURNING * INTO session_row;
  IF FOUND THEN
    RETURN jsonb_build_object('status', 'ok', 'session_id', session_row.id);
  END IF;

  -- Resolve settings
  IF p_workspace_id IS NOT NULL THEN
    s := public.get_security_settings(p_workspace_id);
  ELSE
    s.max_devices := 3;
    s.session_expiry_days := 30;
    s.allow_multi_device := true;
    s.auto_logout_oldest := true;
  END IF;

  expiry := now() + (s.session_expiry_days || ' days')::interval;

  -- Count active sessions for this user (across workspaces)
  SELECT count(*) INTO active_count
    FROM public.user_sessions
   WHERE user_id = uid AND is_active = true
     AND (expires_at IS NULL OR expires_at > now());

  IF s.allow_multi_device = false AND active_count >= 1 THEN
    IF s.auto_logout_oldest THEN
      UPDATE public.user_sessions
         SET is_active = false, revoked_at = now(), revoked_reason = 'replaced_by_new_login'
       WHERE user_id = uid AND is_active = true;
    ELSE
      RETURN jsonb_build_object('status', 'limit_exceeded', 'max_devices', 1, 'active', active_count);
    END IF;
  ELSIF active_count >= s.max_devices THEN
    IF s.auto_logout_oldest THEN
      -- revoke oldest until we have room
      WHILE active_count >= s.max_devices LOOP
        SELECT id INTO oldest_id
          FROM public.user_sessions
         WHERE user_id = uid AND is_active = true
         ORDER BY last_active ASC
         LIMIT 1;
        EXIT WHEN oldest_id IS NULL;
        UPDATE public.user_sessions
           SET is_active = false, revoked_at = now(), revoked_reason = 'replaced_by_new_login'
         WHERE id = oldest_id;
        active_count := active_count - 1;
      END LOOP;
    ELSE
      RETURN jsonb_build_object('status', 'limit_exceeded', 'max_devices', s.max_devices, 'active', active_count);
    END IF;
  END IF;

  INSERT INTO public.user_sessions (
    user_id, workspace_id, session_token, device_name, device_type,
    browser, operating_system, ip_address, location, user_agent,
    expires_at, is_active
  ) VALUES (
    uid, p_workspace_id, p_token, p_device_name, p_device_type,
    p_browser, p_os, p_ip, p_location, p_user_agent,
    expiry, true
  ) RETURNING * INTO session_row;

  RETURN jsonb_build_object('status', 'ok', 'session_id', session_row.id);
END;
$$;

-- Revoke a single session (owner or workspace admin)
CREATE OR REPLACE FUNCTION public.revoke_user_session(p_session_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.user_sessions;
BEGIN
  SELECT * INTO s FROM public.user_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN RETURN false; END IF;
  IF s.user_id <> auth.uid()
     AND NOT (s.workspace_id IS NOT NULL AND public.has_any_workspace_role(auth.uid(), s.workspace_id, ARRAY['organization_admin'::app_role, 'staff'::app_role, 'super_admin'::app_role])) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  UPDATE public.user_sessions
     SET is_active = false, revoked_at = now(), revoked_reason = COALESCE(revoked_reason, 'manual_revoke')
   WHERE id = p_session_id;
  RETURN true;
END;
$$;

-- Revoke all sessions for a user (self, or admin for a workspace user)
CREATE OR REPLACE FUNCTION public.revoke_all_user_sessions(p_user_id uuid, p_workspace_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected int;
BEGIN
  IF p_user_id <> auth.uid()
     AND NOT (p_workspace_id IS NOT NULL AND public.has_any_workspace_role(auth.uid(), p_workspace_id, ARRAY['organization_admin'::app_role, 'staff'::app_role, 'super_admin'::app_role])) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  UPDATE public.user_sessions
     SET is_active = false, revoked_at = now(), revoked_reason = 'force_logout_all'
   WHERE user_id = p_user_id AND is_active = true;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_security_settings(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_user_session(text,uuid,text,text,text,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_user_session(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_all_user_sessions(uuid,uuid) TO authenticated;
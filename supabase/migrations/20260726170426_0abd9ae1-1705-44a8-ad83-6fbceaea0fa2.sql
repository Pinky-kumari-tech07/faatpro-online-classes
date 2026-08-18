
ALTER TABLE public.user_sessions
  ADD COLUMN IF NOT EXISTS login_method text,
  ADD COLUMN IF NOT EXISTS logout_reason text,
  ADD COLUMN IF NOT EXISTS duration_seconds integer;

CREATE INDEX IF NOT EXISTS idx_user_sessions_login_time ON public.user_sessions(login_time DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_workspace ON public.user_sessions(workspace_id, login_time DESC);

-- Extend register_user_session to accept login method
CREATE OR REPLACE FUNCTION public.register_user_session(
  p_token text, p_workspace_id uuid, p_device_name text, p_device_type text,
  p_browser text, p_os text, p_ip text, p_location text, p_user_agent text,
  p_login_method text DEFAULT 'email'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  s public.workspace_security_settings;
  uid uuid := auth.uid();
  active_count int;
  session_row public.user_sessions;
  expiry timestamptz;
  oldest_id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  UPDATE public.user_sessions
     SET last_active = now(),
         ip_address = COALESCE(p_ip, ip_address),
         location   = COALESCE(p_location, location),
         is_active  = true,
         revoked_at = NULL,
         revoked_reason = NULL,
         login_method = COALESCE(p_login_method, login_method)
   WHERE session_token = p_token AND user_id = uid
   RETURNING * INTO session_row;
  IF FOUND THEN
    RETURN jsonb_build_object('status', 'ok', 'session_id', session_row.id);
  END IF;

  IF p_workspace_id IS NOT NULL THEN
    s := public.get_security_settings(p_workspace_id);
  ELSE
    s.max_devices := 3;
    s.session_expiry_days := 30;
    s.allow_multi_device := true;
    s.auto_logout_oldest := true;
  END IF;

  expiry := now() + (s.session_expiry_days || ' days')::interval;

  SELECT count(*) INTO active_count
    FROM public.user_sessions
   WHERE user_id = uid AND is_active = true
     AND (expires_at IS NULL OR expires_at > now());

  IF s.allow_multi_device = false AND active_count >= 1 THEN
    IF s.auto_logout_oldest THEN
      UPDATE public.user_sessions
         SET is_active = false, revoked_at = now(),
             revoked_reason = 'replaced_by_new_login',
             logout_reason = 'replaced_by_new_login',
             duration_seconds = GREATEST(0, EXTRACT(EPOCH FROM (now() - login_time))::int)
       WHERE user_id = uid AND is_active = true;
    ELSE
      RETURN jsonb_build_object('status', 'limit_exceeded', 'max_devices', 1, 'active', active_count);
    END IF;
  ELSIF active_count >= s.max_devices THEN
    IF s.auto_logout_oldest THEN
      WHILE active_count >= s.max_devices LOOP
        SELECT id INTO oldest_id FROM public.user_sessions
         WHERE user_id = uid AND is_active = true
         ORDER BY last_active ASC LIMIT 1;
        EXIT WHEN oldest_id IS NULL;
        UPDATE public.user_sessions
           SET is_active = false, revoked_at = now(),
               revoked_reason = 'replaced_by_new_login',
               logout_reason = 'replaced_by_new_login',
               duration_seconds = GREATEST(0, EXTRACT(EPOCH FROM (now() - login_time))::int)
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
    expires_at, is_active, login_method
  ) VALUES (
    uid, p_workspace_id, p_token, p_device_name, p_device_type,
    p_browser, p_os, p_ip, p_location, p_user_agent,
    expiry, true, COALESCE(p_login_method, 'email')
  ) RETURNING * INTO session_row;

  RETURN jsonb_build_object('status', 'ok', 'session_id', session_row.id);
END;
$function$;

-- Close current session by token with a reason
CREATE OR REPLACE FUNCTION public.close_user_session(p_token text, p_reason text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  n int;
BEGIN
  IF uid IS NULL THEN RETURN false; END IF;
  UPDATE public.user_sessions
     SET is_active = false,
         revoked_at = now(),
         revoked_reason = COALESCE(p_reason, 'manual_logout'),
         logout_reason = COALESCE(p_reason, 'manual_logout'),
         duration_seconds = GREATEST(0, EXTRACT(EPOCH FROM (now() - login_time))::int)
   WHERE session_token = p_token AND user_id = uid AND is_active = true;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n > 0;
END;
$$;

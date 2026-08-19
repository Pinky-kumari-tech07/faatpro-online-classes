
CREATE TABLE IF NOT EXISTS public.video_security_settings (
  workspace_id uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  disable_downloads boolean NOT NULL DEFAULT true,
  signed_urls boolean NOT NULL DEFAULT false,
  dynamic_watermark boolean NOT NULL DEFAULT true,
  hls_streaming boolean NOT NULL DEFAULT false,
  session_validation boolean NOT NULL DEFAULT true,
  device_limit boolean NOT NULL DEFAULT true,
  concurrent_login_protection boolean NOT NULL DEFAULT true,
  screen_record_deterrence boolean NOT NULL DEFAULT true,
  youtube_nocookie boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_security_settings TO authenticated;
GRANT ALL ON public.video_security_settings TO service_role;

ALTER TABLE public.video_security_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_read_video_security_settings"
  ON public.video_security_settings FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "admins_write_video_security_settings"
  ON public.video_security_settings FOR ALL TO authenticated
  USING (public.has_any_workspace_role(auth.uid(), workspace_id,
    ARRAY['organization_admin'::app_role,'staff'::app_role,'super_admin'::app_role]))
  WITH CHECK (public.has_any_workspace_role(auth.uid(), workspace_id,
    ARRAY['organization_admin'::app_role,'staff'::app_role,'super_admin'::app_role]));

CREATE TRIGGER trg_video_security_settings_updated
  BEFORE UPDATE ON public.video_security_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


CREATE TABLE IF NOT EXISTS public.video_access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  course_id uuid,
  lesson_id uuid,
  event_type text NOT NULL CHECK (event_type IN (
    'video_start','video_complete','video_blocked','screen_record_attempt',
    'printscreen_attempt','context_menu_blocked','download_blocked'
  )),
  user_agent text,
  ip_address text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_video_access_logs_ws_created
  ON public.video_access_logs (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_access_logs_user
  ON public.video_access_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_access_logs_lesson
  ON public.video_access_logs (lesson_id, created_at DESC);

GRANT SELECT, INSERT ON public.video_access_logs TO authenticated;
GRANT ALL ON public.video_access_logs TO service_role;

ALTER TABLE public.video_access_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_insert_own_video_logs"
  ON public.video_access_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users_read_own_video_logs"
  ON public.video_access_logs FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "admins_read_workspace_video_logs"
  ON public.video_access_logs FOR SELECT TO authenticated
  USING (workspace_id IS NOT NULL AND public.has_any_workspace_role(auth.uid(), workspace_id,
    ARRAY['organization_admin'::app_role,'staff'::app_role,'super_admin'::app_role]));

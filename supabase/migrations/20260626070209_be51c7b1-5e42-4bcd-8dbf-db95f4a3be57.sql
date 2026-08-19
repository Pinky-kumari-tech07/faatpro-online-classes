
CREATE TABLE IF NOT EXISTS public.content_protection_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL UNIQUE REFERENCES public.workspaces(id) ON DELETE CASCADE,
  disable_right_click BOOLEAN NOT NULL DEFAULT true,
  disable_keyboard_shortcuts BOOLEAN NOT NULL DEFAULT true,
  disable_copy BOOLEAN NOT NULL DEFAULT true,
  disable_text_selection BOOLEAN NOT NULL DEFAULT true,
  disable_image_drag BOOLEAN NOT NULL DEFAULT true,
  disable_print BOOLEAN NOT NULL DEFAULT true,
  devtools_detection BOOLEAN NOT NULL DEFAULT true,
  dynamic_watermark BOOLEAN NOT NULL DEFAULT true,
  video_watermark BOOLEAN NOT NULL DEFAULT true,
  pdf_protection BOOLEAN NOT NULL DEFAULT true,
  screenshot_deterrence BOOLEAN NOT NULL DEFAULT true,
  apply_on_public_site BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.content_protection_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_protection_settings TO authenticated;
GRANT ALL ON public.content_protection_settings TO service_role;

ALTER TABLE public.content_protection_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read content protection settings"
  ON public.content_protection_settings FOR SELECT
  USING (true);

CREATE POLICY "Admins manage content protection settings"
  ON public.content_protection_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = content_protection_settings.workspace_id
        AND wm.profile_id = auth.uid()
        AND wm.role IN ('organization_admin','super_admin','staff')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = content_protection_settings.workspace_id
        AND wm.profile_id = auth.uid()
        AND wm.role IN ('organization_admin','super_admin','staff')
    )
  );

CREATE OR REPLACE FUNCTION public.set_content_protection_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_content_protection_updated_at ON public.content_protection_settings;
CREATE TRIGGER trg_content_protection_updated_at
  BEFORE UPDATE ON public.content_protection_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_content_protection_updated_at();

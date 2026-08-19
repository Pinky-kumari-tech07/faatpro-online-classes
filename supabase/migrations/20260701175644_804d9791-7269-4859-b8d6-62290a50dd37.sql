-- Fix certificate snapshotting to always freeze a template, even when the issuer
-- omits template_id. Falls back to the workspace's default template.
CREATE OR REPLACE FUNCTION public.certificates_snapshot_template()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  t public.certificate_templates%ROWTYPE;
  resolved_template_id uuid;
BEGIN
  -- Already snapshotted (e.g. re-issue) — leave as-is.
  IF NEW.template_snapshot IS NOT NULL AND NEW.template_snapshot <> '{}'::jsonb THEN
    RETURN NEW;
  END IF;

  resolved_template_id := NEW.template_id;

  -- Fall back to the workspace's default template when none was supplied.
  IF resolved_template_id IS NULL THEN
    SELECT id INTO resolved_template_id
    FROM public.certificate_templates
    WHERE workspace_id = NEW.workspace_id AND is_default = TRUE
    LIMIT 1;
  END IF;

  -- Final fallback: any template in the workspace.
  IF resolved_template_id IS NULL THEN
    SELECT id INTO resolved_template_id
    FROM public.certificate_templates
    WHERE workspace_id = NEW.workspace_id
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  IF resolved_template_id IS NULL THEN
    RETURN NEW; -- No templates exist at all; leave snapshot null.
  END IF;

  SELECT * INTO t FROM public.certificate_templates WHERE id = resolved_template_id;
  IF FOUND THEN
    NEW.template_id := t.id;
    NEW.template_snapshot := jsonb_build_object(
      'template_id', t.id,
      'name', t.name,
      'design_json', t.design_json,
      'accent_color', t.accent_color,
      'title', t.title,
      'body_template', t.body_template,
      'background_style', t.background_style,
      'layout_style', t.layout_style,
      'signature_image_url', t.signature_image_url,
      'show_qr', t.show_qr,
      'show_percentage', t.show_percentage,
      'show_completion_date', t.show_completion_date,
      'show_certificate_number', t.show_certificate_number
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- Backfill every certificate that is still missing a snapshot.
WITH resolved AS (
  SELECT c.id AS cert_id,
         COALESCE(
           c.template_id,
           (SELECT id FROM public.certificate_templates
             WHERE workspace_id = c.workspace_id AND is_default = TRUE
             LIMIT 1),
           (SELECT id FROM public.certificate_templates
             WHERE workspace_id = c.workspace_id
             ORDER BY created_at ASC
             LIMIT 1)
         ) AS tpl_id
  FROM public.certificates c
  WHERE c.template_snapshot IS NULL OR c.template_snapshot = '{}'::jsonb
)
UPDATE public.certificates c
SET template_id = t.id,
    template_snapshot = jsonb_build_object(
      'template_id', t.id,
      'name', t.name,
      'design_json', t.design_json,
      'accent_color', t.accent_color,
      'title', t.title,
      'body_template', t.body_template,
      'background_style', t.background_style,
      'layout_style', t.layout_style,
      'signature_image_url', t.signature_image_url,
      'show_qr', t.show_qr,
      'show_percentage', t.show_percentage,
      'show_completion_date', t.show_completion_date,
      'show_certificate_number', t.show_certificate_number
    )
FROM resolved r
JOIN public.certificate_templates t ON t.id = r.tpl_id
WHERE c.id = r.cert_id;
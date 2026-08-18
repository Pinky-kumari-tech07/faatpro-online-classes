
-- 1) Snapshot column
ALTER TABLE public.certificates
  ADD COLUMN IF NOT EXISTS template_snapshot jsonb;

-- 2) Backfill from current template design_json
UPDATE public.certificates c
SET template_snapshot = jsonb_build_object(
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
FROM public.certificate_templates t
WHERE c.template_id = t.id
  AND (c.template_snapshot IS NULL OR c.template_snapshot = '{}'::jsonb);

-- 3) Auto-snapshot trigger on insert
CREATE OR REPLACE FUNCTION public.certificates_snapshot_template()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t public.certificate_templates%ROWTYPE;
BEGIN
  IF NEW.template_snapshot IS NOT NULL AND NEW.template_snapshot <> '{}'::jsonb THEN
    RETURN NEW;
  END IF;
  IF NEW.template_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT * INTO t FROM public.certificate_templates WHERE id = NEW.template_id;
  IF FOUND THEN
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
$$;

DROP TRIGGER IF EXISTS trg_certificates_snapshot_template ON public.certificates;
CREATE TRIGGER trg_certificates_snapshot_template
BEFORE INSERT ON public.certificates
FOR EACH ROW EXECUTE FUNCTION public.certificates_snapshot_template();

-- 4) Extend verify_certificate to return snapshot + pdf_url + template_id
DROP FUNCTION IF EXISTS public.verify_certificate(text);

CREATE FUNCTION public.verify_certificate(_code text)
RETURNS TABLE(
  certificate_number text,
  issued_at timestamp with time zone,
  student_name text,
  course_title text,
  workspace_name text,
  completion_percentage numeric,
  completion_date timestamp with time zone,
  verification_code text,
  accent_color text,
  revoked_at timestamp with time zone,
  template_id uuid,
  template_snapshot jsonb,
  pdf_url text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.certificate_number, c.issued_at,
         p.full_name, co.title, w.name,
         c.completion_percentage, c.completion_date,
         c.verification_code,
         COALESCE((c.template_snapshot->>'accent_color'), t.accent_color, '#6366f1'),
         c.revoked_at,
         c.template_id,
         c.template_snapshot,
         c.pdf_url
  FROM public.certificates c
  LEFT JOIN public.profiles p ON p.id = c.student_id
  LEFT JOIN public.courses co ON co.id = c.course_id
  LEFT JOIN public.workspaces w ON w.id = c.workspace_id
  LEFT JOIN public.certificate_templates t ON t.id = c.template_id
  WHERE c.verification_code = _code
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.verify_certificate(text) TO anon, authenticated;

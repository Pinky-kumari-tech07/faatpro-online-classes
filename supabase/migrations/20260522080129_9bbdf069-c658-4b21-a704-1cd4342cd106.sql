
ALTER TABLE public.certificate_templates
  ADD COLUMN IF NOT EXISTS background_style text NOT NULL DEFAULT 'modern_vertical',
  ADD COLUMN IF NOT EXISTS accent_color text NOT NULL DEFAULT '#6366f1',
  ADD COLUMN IF NOT EXISTS signature_image_url text,
  ADD COLUMN IF NOT EXISTS layout_style text NOT NULL DEFAULT 'modern_vertical',
  ADD COLUMN IF NOT EXISTS show_qr boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_percentage boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_completion_date boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_certificate_number boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS trg_cert_templates_updated_at ON public.certificate_templates;
CREATE TRIGGER trg_cert_templates_updated_at
BEFORE UPDATE ON public.certificate_templates
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.certificates
  ADD COLUMN IF NOT EXISTS completion_percentage numeric,
  ADD COLUMN IF NOT EXISTS completion_date timestamptz,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz;

DROP TRIGGER IF EXISTS trg_certificates_updated_at ON public.certificates;
CREATE TRIGGER trg_certificates_updated_at
BEFORE UPDATE ON public.certificates
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

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
   revoked_at timestamp with time zone
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT c.certificate_number, c.issued_at,
         p.full_name, co.title, w.name,
         c.completion_percentage, c.completion_date,
         c.verification_code,
         COALESCE(t.accent_color, '#6366f1'),
         c.revoked_at
  FROM public.certificates c
  LEFT JOIN public.profiles p ON p.id = c.student_id
  LEFT JOIN public.courses co ON co.id = c.course_id
  LEFT JOIN public.workspaces w ON w.id = c.workspace_id
  LEFT JOIN public.certificate_templates t ON t.id = c.template_id
  WHERE c.verification_code = _code
  LIMIT 1;
$function$;

INSERT INTO storage.buckets (id, name, public)
VALUES ('certificate-assets', 'certificate-assets', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "cert_assets_public_read" ON storage.objects;
CREATE POLICY "cert_assets_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'certificate-assets');

DROP POLICY IF EXISTS "cert_assets_admin_write" ON storage.objects;
CREATE POLICY "cert_assets_admin_write"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'certificate-assets'
  AND public.has_any_workspace_role(
    auth.uid(),
    ((storage.foldername(name))[1])::uuid,
    ARRAY['organization_admin'::app_role, 'staff'::app_role, 'super_admin'::app_role, 'instructor'::app_role]
  )
);

DROP POLICY IF EXISTS "cert_assets_admin_update" ON storage.objects;
CREATE POLICY "cert_assets_admin_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'certificate-assets'
  AND public.has_any_workspace_role(
    auth.uid(),
    ((storage.foldername(name))[1])::uuid,
    ARRAY['organization_admin'::app_role, 'staff'::app_role, 'super_admin'::app_role, 'instructor'::app_role]
  )
);

DROP POLICY IF EXISTS "cert_assets_admin_delete" ON storage.objects;
CREATE POLICY "cert_assets_admin_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'certificate-assets'
  AND public.has_any_workspace_role(
    auth.uid(),
    ((storage.foldername(name))[1])::uuid,
    ARRAY['organization_admin'::app_role, 'staff'::app_role, 'super_admin'::app_role, 'instructor'::app_role]
  )
);

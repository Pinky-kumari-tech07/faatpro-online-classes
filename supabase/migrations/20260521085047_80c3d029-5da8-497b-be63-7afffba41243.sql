
-- Enums
DO $$ BEGIN CREATE TYPE public.live_class_provider AS ENUM ('zoom','google_meet','jitsi','custom'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.live_class_status AS ENUM ('scheduled','live','completed','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.payment_status AS ENUM ('pending','succeeded','failed','refunded'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.coupon_discount_type AS ENUM ('percent','fixed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.coupon_status AS ENUM ('active','expired','disabled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.provider_connection_status AS ENUM ('not_connected','pending','connected','disabled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- live_classes
CREATE TABLE public.live_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  course_id uuid NOT NULL,
  instructor_id uuid,
  title text NOT NULL,
  description text,
  provider public.live_class_provider NOT NULL DEFAULT 'custom',
  meeting_url text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  timezone text DEFAULT 'UTC',
  status public.live_class_status NOT NULL DEFAULT 'scheduled',
  recording_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_live_classes_ws_start ON public.live_classes(workspace_id, starts_at DESC);
CREATE INDEX idx_live_classes_course ON public.live_classes(course_id);
ALTER TABLE public.live_classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY live_classes_read ON public.live_classes FOR SELECT USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY live_classes_manage ON public.live_classes FOR ALL
  USING (has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin','staff','super_admin']::app_role[]) OR is_course_instructor(auth.uid(), course_id))
  WITH CHECK (has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin','staff','super_admin']::app_role[]) OR is_course_instructor(auth.uid(), course_id));

-- certificate_templates
CREATE TABLE public.certificate_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  name text NOT NULL,
  title text NOT NULL DEFAULT 'Certificate of Completion',
  body_template text NOT NULL DEFAULT 'This is to certify that {{student_name}} has successfully completed {{course_title}}.',
  signature_name text,
  logo_url text,
  background_url text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.certificate_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY cert_tpl_read ON public.certificate_templates FOR SELECT USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY cert_tpl_manage ON public.certificate_templates FOR ALL
  USING (has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin','staff','super_admin']::app_role[]))
  WITH CHECK (has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin','staff','super_admin']::app_role[]));

-- certificates
CREATE TABLE public.certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  course_id uuid NOT NULL,
  student_id uuid NOT NULL,
  template_id uuid,
  certificate_number text NOT NULL,
  verification_code text NOT NULL UNIQUE,
  pdf_url text,
  issued_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_certs_ws ON public.certificates(workspace_id);
CREATE INDEX idx_certs_student ON public.certificates(student_id);
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
CREATE POLICY certificates_read ON public.certificates FOR SELECT
  USING (student_id = auth.uid() OR has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin','staff','super_admin','instructor']::app_role[]));
CREATE POLICY certificates_manage ON public.certificates FOR ALL
  USING (has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin','staff','super_admin','instructor']::app_role[]))
  WITH CHECK (has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin','staff','super_admin','instructor']::app_role[]));

-- Public verification function
CREATE OR REPLACE FUNCTION public.verify_certificate(_code text)
RETURNS TABLE (
  certificate_number text, issued_at timestamptz,
  student_name text, course_title text, workspace_name text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT c.certificate_number, c.issued_at,
         p.full_name, co.title, w.name
  FROM public.certificates c
  LEFT JOIN public.profiles p ON p.id = c.student_id
  LEFT JOIN public.courses co ON co.id = c.course_id
  LEFT JOIN public.workspaces w ON w.id = c.workspace_id
  WHERE c.verification_code = _code
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.verify_certificate(text) TO anon, authenticated;

-- workspace_settings
CREATE TABLE public.workspace_settings (
  workspace_id uuid PRIMARY KEY,
  contact_email text,
  timezone text DEFAULT 'UTC',
  primary_color text DEFAULT '#5b5bf5',
  accent_color text DEFAULT '#2ec5b8',
  logo_url text,
  certificate_signature_name text,
  certificate_signature_url text,
  default_course_visibility course_visibility NOT NULL DEFAULT 'private',
  auto_issue_certificates boolean NOT NULL DEFAULT false,
  completion_threshold int NOT NULL DEFAULT 80,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.workspace_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY ws_settings_read ON public.workspace_settings FOR SELECT USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY ws_settings_manage ON public.workspace_settings FOR ALL
  USING (has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin','super_admin']::app_role[]))
  WITH CHECK (has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin','super_admin']::app_role[]));
CREATE TRIGGER trg_ws_settings_updated BEFORE UPDATE ON public.workspace_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- payment_providers
CREATE TABLE public.payment_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  provider text NOT NULL,
  status public.provider_connection_status NOT NULL DEFAULT 'not_connected',
  config_public jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, provider)
);
ALTER TABLE public.payment_providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY pp_read ON public.payment_providers FOR SELECT USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY pp_manage ON public.payment_providers FOR ALL
  USING (has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin','super_admin']::app_role[]))
  WITH CHECK (has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin','super_admin']::app_role[]));

-- payments
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  student_id uuid NOT NULL,
  course_id uuid,
  provider text NOT NULL,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  status public.payment_status NOT NULL DEFAULT 'pending',
  external_payment_id text,
  invoice_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_payments_ws ON public.payments(workspace_id);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY payments_read ON public.payments FOR SELECT
  USING (student_id = auth.uid() OR has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin','staff','super_admin']::app_role[]));
CREATE POLICY payments_manage ON public.payments FOR ALL
  USING (has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin','staff','super_admin']::app_role[]))
  WITH CHECK (has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin','staff','super_admin']::app_role[]));

-- coupons
CREATE TABLE public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  code text NOT NULL,
  discount_type public.coupon_discount_type NOT NULL DEFAULT 'percent',
  discount_value numeric(10,2) NOT NULL DEFAULT 0,
  starts_at timestamptz,
  ends_at timestamptz,
  max_redemptions int,
  status public.coupon_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, code)
);
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY coupons_read ON public.coupons FOR SELECT USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY coupons_manage ON public.coupons FOR ALL
  USING (has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin','staff','super_admin']::app_role[]))
  WITH CHECK (has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin','staff','super_admin']::app_role[]));

-- Courses: pricing & cert
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS price_amount numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS auto_issue_certificate boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS certificate_template_id uuid;

-- Notifications: allow inserts/deletes
CREATE POLICY notif_admin_insert ON public.notifications FOR INSERT
  WITH CHECK (
    profile_id = auth.uid()
    OR has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin','staff','super_admin','instructor']::app_role[])
  );
CREATE POLICY notif_delete_self ON public.notifications FOR DELETE USING (profile_id = auth.uid());


-- ============ ENUMS ============
DO $$ BEGIN
  CREATE TYPE public.earning_status AS ENUM ('active','refunded','adjusted','reversed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payout_status AS ENUM ('requested','approved','paid','rejected','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.adjustment_kind AS ENUM ('credit','debit');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ commission_settings ============
CREATE TABLE IF NOT EXISTS public.commission_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  scope text NOT NULL CHECK (scope IN ('global','instructor','course')),
  instructor_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE,
  commission_percentage numeric(5,2) NOT NULL CHECK (commission_percentage >= 0 AND commission_percentage <= 100),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commission_scope_check CHECK (
    (scope = 'global'     AND instructor_id IS NULL AND course_id IS NULL) OR
    (scope = 'instructor' AND instructor_id IS NOT NULL AND course_id IS NULL) OR
    (scope = 'course'     AND course_id IS NOT NULL)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS commission_global_uq ON public.commission_settings(workspace_id) WHERE scope='global';
CREATE UNIQUE INDEX IF NOT EXISTS commission_instructor_uq ON public.commission_settings(workspace_id, instructor_id) WHERE scope='instructor';
CREATE UNIQUE INDEX IF NOT EXISTS commission_course_uq ON public.commission_settings(workspace_id, course_id) WHERE scope='course';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.commission_settings TO authenticated;
GRANT ALL ON public.commission_settings TO service_role;
ALTER TABLE public.commission_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "commission_read" ON public.commission_settings FOR SELECT TO authenticated
  USING (
    public.is_workspace_member(auth.uid(), workspace_id)
  );
CREATE POLICY "commission_admin_manage" ON public.commission_settings FOR ALL TO authenticated
  USING (public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role,'staff'::app_role,'super_admin'::app_role]))
  WITH CHECK (public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role,'staff'::app_role,'super_admin'::app_role]));

CREATE TRIGGER trg_commission_settings_updated_at BEFORE UPDATE ON public.commission_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ instructor_earnings ============
CREATE TABLE IF NOT EXISTS public.instructor_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  instructor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  student_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  gross_amount numeric(12,2) NOT NULL DEFAULT 0,
  commission_percentage numeric(5,2) NOT NULL DEFAULT 0,
  commission_amount numeric(12,2) NOT NULL DEFAULT 0,
  net_earning numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'INR',
  status public.earning_status NOT NULL DEFAULT 'active',
  earned_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (payment_id)
);
CREATE INDEX IF NOT EXISTS idx_earnings_instructor ON public.instructor_earnings(instructor_id, earned_at DESC);
CREATE INDEX IF NOT EXISTS idx_earnings_course ON public.instructor_earnings(course_id, earned_at DESC);
CREATE INDEX IF NOT EXISTS idx_earnings_ws ON public.instructor_earnings(workspace_id, earned_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.instructor_earnings TO authenticated;
GRANT ALL ON public.instructor_earnings TO service_role;
ALTER TABLE public.instructor_earnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "earnings_read" ON public.instructor_earnings FOR SELECT TO authenticated
  USING (
    instructor_id = auth.uid()
    OR public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role,'staff'::app_role,'super_admin'::app_role])
  );
CREATE POLICY "earnings_admin_manage" ON public.instructor_earnings FOR ALL TO authenticated
  USING (public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role,'staff'::app_role,'super_admin'::app_role]))
  WITH CHECK (public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role,'staff'::app_role,'super_admin'::app_role]));

CREATE TRIGGER trg_earnings_updated_at BEFORE UPDATE ON public.instructor_earnings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ earning_adjustments ============
CREATE TABLE IF NOT EXISTS public.earning_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  instructor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  kind public.adjustment_kind NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'INR',
  reason text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_adjustments_instructor ON public.earning_adjustments(instructor_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.earning_adjustments TO authenticated;
GRANT ALL ON public.earning_adjustments TO service_role;
ALTER TABLE public.earning_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "adjustments_read" ON public.earning_adjustments FOR SELECT TO authenticated
  USING (
    instructor_id = auth.uid()
    OR public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role,'staff'::app_role,'super_admin'::app_role])
  );
CREATE POLICY "adjustments_admin_manage" ON public.earning_adjustments FOR ALL TO authenticated
  USING (public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role,'staff'::app_role,'super_admin'::app_role]))
  WITH CHECK (public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role,'staff'::app_role,'super_admin'::app_role]));

CREATE TRIGGER trg_adjustments_updated_at BEFORE UPDATE ON public.earning_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ refunds ============
CREATE TABLE IF NOT EXISTS public.refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  student_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'INR',
  reason text,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('pending','completed','rejected')),
  processed_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_refunds_payment ON public.refunds(payment_id);
CREATE INDEX IF NOT EXISTS idx_refunds_course ON public.refunds(course_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.refunds TO authenticated;
GRANT ALL ON public.refunds TO service_role;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "refunds_read" ON public.refunds FOR SELECT TO authenticated
  USING (
    student_id = auth.uid()
    OR public.is_course_instructor(auth.uid(), course_id)
    OR public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role,'staff'::app_role,'super_admin'::app_role])
  );
CREATE POLICY "refunds_admin_manage" ON public.refunds FOR ALL TO authenticated
  USING (public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role,'staff'::app_role,'super_admin'::app_role]))
  WITH CHECK (public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role,'staff'::app_role,'super_admin'::app_role]));

CREATE TRIGGER trg_refunds_updated_at BEFORE UPDATE ON public.refunds
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ payout_requests ============
CREATE TABLE IF NOT EXISTS public.payout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  instructor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'INR',
  status public.payout_status NOT NULL DEFAULT 'requested',
  notes text,
  reviewed_by uuid REFERENCES public.profiles(id),
  reviewed_at timestamptz,
  paid_at timestamptz,
  payment_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payouts_instructor ON public.payout_requests(instructor_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payout_requests TO authenticated;
GRANT ALL ON public.payout_requests TO service_role;
ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payouts_read" ON public.payout_requests FOR SELECT TO authenticated
  USING (
    instructor_id = auth.uid()
    OR public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role,'staff'::app_role,'super_admin'::app_role])
  );
CREATE POLICY "payouts_instructor_insert" ON public.payout_requests FOR INSERT TO authenticated
  WITH CHECK (instructor_id = auth.uid() AND status = 'requested');
CREATE POLICY "payouts_instructor_cancel" ON public.payout_requests FOR UPDATE TO authenticated
  USING (instructor_id = auth.uid() AND status = 'requested')
  WITH CHECK (instructor_id = auth.uid() AND status IN ('requested','cancelled'));
CREATE POLICY "payouts_admin_manage" ON public.payout_requests FOR ALL TO authenticated
  USING (public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role,'staff'::app_role,'super_admin'::app_role]))
  WITH CHECK (public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role,'staff'::app_role,'super_admin'::app_role]));

CREATE TRIGGER trg_payouts_updated_at BEFORE UPDATE ON public.payout_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ commission resolver ============
CREATE OR REPLACE FUNCTION public.resolve_commission_percentage(_workspace_id uuid, _instructor_id uuid, _course_id uuid)
RETURNS numeric
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE _pct numeric;
BEGIN
  SELECT commission_percentage INTO _pct
    FROM public.commission_settings
    WHERE workspace_id = _workspace_id AND scope = 'course' AND course_id = _course_id
    LIMIT 1;
  IF _pct IS NOT NULL THEN RETURN _pct; END IF;

  SELECT commission_percentage INTO _pct
    FROM public.commission_settings
    WHERE workspace_id = _workspace_id AND scope = 'instructor' AND instructor_id = _instructor_id
    LIMIT 1;
  IF _pct IS NOT NULL THEN RETURN _pct; END IF;

  SELECT commission_percentage INTO _pct
    FROM public.commission_settings
    WHERE workspace_id = _workspace_id AND scope = 'global'
    LIMIT 1;
  RETURN COALESCE(_pct, 20.00);
END $$;

-- ============ earning auto-create trigger ============
CREATE OR REPLACE FUNCTION public.create_earning_from_payment()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _instructor uuid;
  _gross numeric(12,2);
  _pct numeric;
  _commission numeric(12,2);
  _currency text;
BEGIN
  IF NEW.status <> 'succeeded' OR NEW.course_id IS NULL THEN RETURN NEW; END IF;

  SELECT instructor_id, currency INTO _instructor, _currency
    FROM public.courses WHERE id = NEW.course_id;
  IF _instructor IS NULL THEN RETURN NEW; END IF;

  IF EXISTS (SELECT 1 FROM public.instructor_earnings WHERE payment_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  _gross := COALESCE(NEW.total_amount, NEW.amount, 0);
  _pct := public.resolve_commission_percentage(NEW.workspace_id, _instructor, NEW.course_id);
  _commission := ROUND(_gross * _pct / 100.0, 2);

  INSERT INTO public.instructor_earnings (
    workspace_id, instructor_id, course_id, student_id, payment_id,
    gross_amount, commission_percentage, commission_amount, net_earning, currency,
    status, earned_at
  ) VALUES (
    NEW.workspace_id, _instructor, NEW.course_id, NEW.student_id, NEW.id,
    _gross, _pct, _commission, _gross - _commission, COALESCE(NEW.currency, _currency, 'INR'),
    'active', COALESCE(NEW.updated_at, NEW.created_at, now())
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_payment_create_earning ON public.payments;
CREATE TRIGGER trg_payment_create_earning
  AFTER INSERT OR UPDATE OF status ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.create_earning_from_payment();

-- ============ refund reverses earning ============
CREATE OR REPLACE FUNCTION public.apply_refund_to_earning()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' THEN
    UPDATE public.instructor_earnings
       SET status = 'refunded',
           net_earning = 0,
           updated_at = now()
     WHERE payment_id = NEW.payment_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_refund_apply ON public.refunds;
CREATE TRIGGER trg_refund_apply
  AFTER INSERT OR UPDATE OF status ON public.refunds
  FOR EACH ROW EXECUTE FUNCTION public.apply_refund_to_earning();

-- ============ Backfill earnings for existing succeeded payments ============
INSERT INTO public.instructor_earnings (
  workspace_id, instructor_id, course_id, student_id, payment_id,
  gross_amount, commission_percentage, commission_amount, net_earning, currency, status, earned_at
)
SELECT
  p.workspace_id,
  c.instructor_id,
  p.course_id,
  p.student_id,
  p.id,
  COALESCE(p.total_amount, p.amount, 0) AS gross,
  public.resolve_commission_percentage(p.workspace_id, c.instructor_id, p.course_id) AS pct,
  ROUND(COALESCE(p.total_amount, p.amount, 0) * public.resolve_commission_percentage(p.workspace_id, c.instructor_id, p.course_id) / 100.0, 2) AS commission,
  COALESCE(p.total_amount, p.amount, 0) - ROUND(COALESCE(p.total_amount, p.amount, 0) * public.resolve_commission_percentage(p.workspace_id, c.instructor_id, p.course_id) / 100.0, 2) AS net,
  COALESCE(p.currency, c.currency, 'INR'),
  'active'::public.earning_status,
  COALESCE(p.updated_at, p.created_at, now())
FROM public.payments p
JOIN public.courses c ON c.id = p.course_id
WHERE p.status = 'succeeded'
  AND p.course_id IS NOT NULL
  AND c.instructor_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.instructor_earnings e WHERE e.payment_id = p.id);

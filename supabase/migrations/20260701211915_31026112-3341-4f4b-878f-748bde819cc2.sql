
-- ============================================================
-- 1) Enums
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.course_revenue_type AS ENUM
    ('revenue_share','custom_share','instructor_fixed','per_student_fixed','one_time_contract','no_share');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.settlement_frequency AS ENUM
    ('instant','weekly','monthly','quarterly','manual','one_time');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.earning_settlement_status AS ENUM
    ('pending','requested','approved','paid','on_hold','reversed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.settlement_payment_mode AS ENUM
    ('bank_transfer','upi','neft','rtgs','imps','cash','cheque','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- 2) Extend courses with revenue model
-- ============================================================
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS revenue_model public.course_revenue_type NOT NULL DEFAULT 'revenue_share',
  ADD COLUMN IF NOT EXISTS revenue_platform_pct numeric(5,2) DEFAULT 50.00,
  ADD COLUMN IF NOT EXISTS revenue_instructor_pct numeric(5,2) DEFAULT 50.00,
  ADD COLUMN IF NOT EXISTS revenue_fixed_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS revenue_per_student_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS revenue_one_time_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS revenue_one_time_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS revenue_min_settlement numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS revenue_max_settlement numeric(12,2),
  ADD COLUMN IF NOT EXISTS settlement_frequency public.settlement_frequency NOT NULL DEFAULT 'monthly';

-- ============================================================
-- 3) Extend instructor_earnings
-- ============================================================
ALTER TABLE public.instructor_earnings
  ADD COLUMN IF NOT EXISTS settlement_status public.earning_settlement_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS settlement_request_id uuid REFERENCES public.payout_requests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS revenue_model public.course_revenue_type,
  ADD COLUMN IF NOT EXISTS discount_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refunded_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_revenue_base numeric(12,2),
  ADD COLUMN IF NOT EXISTS settled_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes text;

CREATE INDEX IF NOT EXISTS idx_earnings_status ON public.instructor_earnings(instructor_id, settlement_status);
CREATE INDEX IF NOT EXISTS idx_earnings_request ON public.instructor_earnings(settlement_request_id);

-- ============================================================
-- 4) Extend payout_requests (used as settlement requests)
-- ============================================================
ALTER TABLE public.payout_requests
  ADD COLUMN IF NOT EXISTS settlement_number text,
  ADD COLUMN IF NOT EXISTS paid_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS remarks text,
  ADD COLUMN IF NOT EXISTS earnings_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bank_snapshot jsonb;

-- ============================================================
-- 5) Bank verification on instructor profiles
-- ============================================================
ALTER TABLE public.instructor_profiles
  ADD COLUMN IF NOT EXISTS bank_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bank_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS bank_verified_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- ============================================================
-- 6) Settlement transactions (supports partial payments)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.settlement_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  settlement_request_id uuid NOT NULL REFERENCES public.payout_requests(id) ON DELETE CASCADE,
  instructor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  payment_mode public.settlement_payment_mode NOT NULL DEFAULT 'bank_transfer',
  transaction_reference text,
  notes text,
  paid_at timestamptz NOT NULL DEFAULT now(),
  paid_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settlement_transactions TO authenticated;
GRANT ALL ON public.settlement_transactions TO service_role;
ALTER TABLE public.settlement_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stx_read" ON public.settlement_transactions FOR SELECT TO authenticated
USING (
  instructor_id = auth.uid()
  OR public.has_any_workspace_role(auth.uid(), workspace_id,
      ARRAY['organization_admin','staff','super_admin']::app_role[])
);

CREATE POLICY "stx_admin_write" ON public.settlement_transactions FOR ALL TO authenticated
USING (public.has_any_workspace_role(auth.uid(), workspace_id,
        ARRAY['organization_admin','staff','super_admin']::app_role[]))
WITH CHECK (public.has_any_workspace_role(auth.uid(), workspace_id,
        ARRAY['organization_admin','staff','super_admin']::app_role[]));

CREATE INDEX IF NOT EXISTS idx_stx_request ON public.settlement_transactions(settlement_request_id);
CREATE INDEX IF NOT EXISTS idx_stx_instructor ON public.settlement_transactions(instructor_id);

-- ============================================================
-- 7) Settlement audit log
-- ============================================================
CREATE TABLE IF NOT EXISTS public.settlement_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  settlement_request_id uuid REFERENCES public.payout_requests(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  old_status text,
  new_status text,
  old_amount numeric(12,2),
  new_amount numeric(12,2),
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.settlement_audit_log TO authenticated;
GRANT ALL ON public.settlement_audit_log TO service_role;
ALTER TABLE public.settlement_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sal_read" ON public.settlement_audit_log FOR SELECT TO authenticated
USING (
  public.has_any_workspace_role(auth.uid(), workspace_id,
    ARRAY['organization_admin','staff','super_admin']::app_role[])
  OR EXISTS (SELECT 1 FROM public.payout_requests pr
             WHERE pr.id = settlement_audit_log.settlement_request_id AND pr.instructor_id = auth.uid())
);

CREATE POLICY "sal_insert_admin" ON public.settlement_audit_log FOR INSERT TO authenticated
WITH CHECK (public.has_any_workspace_role(auth.uid(), workspace_id,
        ARRAY['organization_admin','staff','super_admin']::app_role[]));

CREATE INDEX IF NOT EXISTS idx_sal_request ON public.settlement_audit_log(settlement_request_id);

-- ============================================================
-- 8) Trigger: create earnings using course revenue model
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_earning_from_payment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _course public.courses;
  _instructor uuid;
  _gross numeric(12,2);
  _tax numeric(12,2);
  _discount numeric(12,2);
  _base numeric(12,2);
  _instr_share numeric(12,2) := 0;
  _plat_share numeric(12,2) := 0;
  _pct numeric := 0;
  _currency text;
  _model public.course_revenue_type;
BEGIN
  IF NEW.status <> 'succeeded' OR NEW.course_id IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO _course FROM public.courses WHERE id = NEW.course_id;
  _instructor := _course.instructor_id;
  _currency := COALESCE(NEW.currency, _course.currency, 'INR');
  IF _instructor IS NULL THEN RETURN NEW; END IF;

  IF EXISTS (SELECT 1 FROM public.instructor_earnings WHERE payment_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  _gross    := COALESCE(NEW.total_amount, NEW.amount, 0);
  _tax      := COALESCE(NEW.tax_amount, 0);
  _discount := GREATEST(COALESCE(NEW.total_amount,0) - COALESCE(NEW.amount,0), 0);
  _base     := GREATEST(_gross - _tax - _discount, 0);
  _model    := COALESCE(_course.revenue_model, 'revenue_share');

  CASE _model
    WHEN 'no_share' THEN
      _instr_share := 0; _plat_share := _base; _pct := 0;

    WHEN 'per_student_fixed' THEN
      _instr_share := LEAST(COALESCE(_course.revenue_per_student_amount,0), _base);
      _plat_share  := _base - _instr_share;
      _pct := CASE WHEN _base > 0 THEN ROUND(_instr_share * 100.0 / _base, 2) ELSE 0 END;

    WHEN 'instructor_fixed' THEN
      _instr_share := LEAST(COALESCE(_course.revenue_fixed_amount,0), _base);
      _plat_share  := _base - _instr_share;
      _pct := CASE WHEN _base > 0 THEN ROUND(_instr_share * 100.0 / _base, 2) ELSE 0 END;

    WHEN 'one_time_contract' THEN
      -- Contract is a lump sum tracked once. Enrollments after the contract is
      -- marked paid generate zero instructor share (but are still logged).
      IF _course.revenue_one_time_paid_at IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM public.instructor_earnings ie
           WHERE ie.course_id = _course.id
             AND ie.revenue_model = 'one_time_contract'
             AND ie.instructor_share > 0
         ) THEN
        _instr_share := LEAST(COALESCE(_course.revenue_one_time_amount, 0), COALESCE(_course.revenue_one_time_amount, 0));
      ELSE
        _instr_share := 0;
      END IF;
      _plat_share := GREATEST(_base - _instr_share, 0);
      _pct := 0;

    ELSE
      -- revenue_share / custom_share: use instructor_percentage
      _pct := COALESCE(_course.revenue_instructor_pct, 50);
      -- Fallback to commission_settings when the course was created before this feature
      IF _pct IS NULL OR _pct = 0 THEN
        _pct := public.resolve_commission_percentage(NEW.workspace_id, _instructor, NEW.course_id);
      END IF;
      _instr_share := ROUND(_base * _pct / 100.0, 2);
      _plat_share  := _base - _instr_share;
  END CASE;

  INSERT INTO public.instructor_earnings (
    workspace_id, instructor_id, course_id, student_id, payment_id,
    gross_amount, tax_amount, discount_amount, net_revenue_base,
    commission_percentage, commission_amount, net_earning,
    revenue_model, currency, status, settlement_status, earned_at
  ) VALUES (
    NEW.workspace_id, _instructor, NEW.course_id, NEW.student_id, NEW.id,
    _gross, _tax, _discount, _base,
    _pct, _plat_share, _instr_share,
    _model, _currency, 'active', 'pending',
    COALESCE(NEW.updated_at, NEW.created_at, now())
  );

  -- For one-time contracts, mark the course paid-out once the lump sum is booked
  IF _model = 'one_time_contract' AND _instr_share > 0 AND _course.revenue_one_time_paid_at IS NULL THEN
    UPDATE public.courses SET revenue_one_time_paid_at = now() WHERE id = _course.id;
  END IF;

  RETURN NEW;
END $function$;

-- ============================================================
-- 9) Trigger: refund reverses instructor earning
-- ============================================================
CREATE OR REPLACE FUNCTION public.apply_refund_to_earning()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _e public.instructor_earnings;
BEGIN
  IF NEW.status <> 'completed' THEN RETURN NEW; END IF;

  SELECT * INTO _e FROM public.instructor_earnings WHERE payment_id = NEW.payment_id LIMIT 1;
  IF NOT FOUND THEN RETURN NEW; END IF;

  UPDATE public.instructor_earnings
     SET status = 'refunded',
         settlement_status = CASE
           WHEN settlement_status = 'paid' THEN 'reversed'::public.earning_settlement_status
           ELSE settlement_status
         END,
         refunded_amount = COALESCE(net_earning, 0),
         net_earning = 0,
         updated_at = now()
   WHERE id = _e.id;
  RETURN NEW;
END $function$;

-- ============================================================
-- 10) RPC: instructor requests a settlement
-- ============================================================
CREATE OR REPLACE FUNCTION public.instructor_request_settlement(_workspace_id uuid, _notes text DEFAULT NULL)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _ip public.instructor_profiles;
  _total numeric(12,2) := 0;
  _cnt int := 0;
  _req uuid;
  _snap jsonb;
  _num text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO _ip FROM public.instructor_profiles
   WHERE user_id = _uid AND workspace_id = _workspace_id
   ORDER BY created_at DESC LIMIT 1;
  IF _ip.id IS NULL THEN
    SELECT * INTO _ip FROM public.instructor_profiles WHERE user_id = _uid ORDER BY created_at DESC LIMIT 1;
  END IF;

  IF _ip.id IS NULL OR NOT COALESCE(_ip.bank_verified, false) THEN
    RAISE EXCEPTION 'Your bank details must be verified by an admin before you can request a settlement.'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT COALESCE(SUM(net_earning - COALESCE(settled_amount,0)), 0), COUNT(*)
    INTO _total, _cnt
    FROM public.instructor_earnings
   WHERE instructor_id = _uid
     AND workspace_id = _workspace_id
     AND settlement_status = 'pending'
     AND status = 'active'
     AND net_earning > COALESCE(settled_amount,0);

  IF _total <= 0 OR _cnt = 0 THEN
    RAISE EXCEPTION 'No eligible earnings to settle' USING ERRCODE = 'no_data_found';
  END IF;

  _num := 'STL-' || to_char(now(), 'YYYYMM') || '-' ||
          upper(substring(replace(gen_random_uuid()::text,'-',''),1,6));

  _snap := jsonb_build_object(
    'account_holder', _ip.account_holder_name,
    'account_number', _ip.bank_account_number,
    'ifsc', _ip.ifsc_code,
    'bank', _ip.bank_name,
    'branch', _ip.branch_name,
    'upi', _ip.upi_id
  );

  INSERT INTO public.payout_requests (
    workspace_id, instructor_id, amount, currency, status,
    notes, settlement_number, earnings_count, bank_snapshot
  ) VALUES (
    _workspace_id, _uid, _total, 'INR', 'requested'::payout_status,
    _notes, _num, _cnt, _snap
  ) RETURNING id INTO _req;

  UPDATE public.instructor_earnings
     SET settlement_status = 'requested',
         settlement_request_id = _req,
         updated_at = now()
   WHERE instructor_id = _uid
     AND workspace_id = _workspace_id
     AND settlement_status = 'pending'
     AND status = 'active'
     AND net_earning > COALESCE(settled_amount,0);

  INSERT INTO public.settlement_audit_log (
    workspace_id, settlement_request_id, actor_id, action, new_status, new_amount, remarks
  ) VALUES (
    _workspace_id, _req, _uid, 'requested', 'requested', _total, _notes
  );

  RETURN _req;
END $function$;

-- ============================================================
-- 11) RPC: admin approves / rejects / holds
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_update_settlement_status(
  _request_id uuid, _new_status text, _remarks text DEFAULT NULL
) RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _r public.payout_requests; _old text;
BEGIN
  SELECT * INTO _r FROM public.payout_requests WHERE id = _request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Settlement not found'; END IF;
  IF NOT public.has_any_workspace_role(auth.uid(), _r.workspace_id,
       ARRAY['organization_admin','staff','super_admin']::app_role[]) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _new_status NOT IN ('approved','rejected','on_hold','requested') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  _old := _r.status::text;

  UPDATE public.payout_requests
     SET status = _new_status::payout_status,
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         remarks = COALESCE(_remarks, remarks),
         updated_at = now()
   WHERE id = _request_id;

  UPDATE public.instructor_earnings
     SET settlement_status = CASE
       WHEN _new_status = 'approved' THEN 'approved'::public.earning_settlement_status
       WHEN _new_status = 'rejected' THEN 'pending'::public.earning_settlement_status
       WHEN _new_status = 'on_hold' THEN 'on_hold'::public.earning_settlement_status
       WHEN _new_status = 'requested' THEN 'requested'::public.earning_settlement_status
       ELSE settlement_status
     END,
     settlement_request_id = CASE
       WHEN _new_status = 'rejected' THEN NULL ELSE settlement_request_id
     END,
     updated_at = now()
   WHERE settlement_request_id = _request_id;

  INSERT INTO public.settlement_audit_log (
    workspace_id, settlement_request_id, actor_id, action, old_status, new_status, remarks
  ) VALUES (
    _r.workspace_id, _request_id, auth.uid(), _new_status, _old, _new_status, _remarks
  );
END $function$;

-- ============================================================
-- 12) RPC: admin records a (partial or full) payment
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_pay_settlement(
  _request_id uuid,
  _amount numeric,
  _mode text DEFAULT 'bank_transfer',
  _reference text DEFAULT NULL,
  _notes text DEFAULT NULL
) RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _r public.payout_requests;
  _paid numeric(12,2);
  _remaining numeric(12,2);
  _tx uuid;
  _new_status text;
  _per numeric;
BEGIN
  SELECT * INTO _r FROM public.payout_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Settlement not found'; END IF;
  IF NOT public.has_any_workspace_role(auth.uid(), _r.workspace_id,
       ARRAY['organization_admin','staff','super_admin']::app_role[]) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _r.status NOT IN ('approved','requested') THEN
    RAISE EXCEPTION 'Only approved or requested settlements can be paid';
  END IF;
  IF _amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;

  _remaining := _r.amount - COALESCE(_r.paid_amount, 0);
  IF _amount > _remaining + 0.01 THEN
    RAISE EXCEPTION 'Amount exceeds remaining balance of %', _remaining;
  END IF;

  INSERT INTO public.settlement_transactions (
    workspace_id, settlement_request_id, instructor_id, amount,
    payment_mode, transaction_reference, notes, paid_by
  ) VALUES (
    _r.workspace_id, _request_id, _r.instructor_id, _amount,
    _mode::public.settlement_payment_mode, _reference, _notes, auth.uid()
  ) RETURNING id INTO _tx;

  _paid := COALESCE(_r.paid_amount, 0) + _amount;
  _new_status := CASE WHEN _paid >= _r.amount - 0.01 THEN 'paid' ELSE _r.status::text END;

  UPDATE public.payout_requests
     SET paid_amount = _paid,
         status = _new_status::payout_status,
         paid_at = CASE WHEN _new_status = 'paid' THEN now() ELSE paid_at END,
         payment_reference = COALESCE(_reference, payment_reference),
         updated_at = now()
   WHERE id = _request_id;

  -- Distribute the payment proportionally across linked earnings
  _per := _amount / NULLIF(_remaining, 0);
  UPDATE public.instructor_earnings
     SET settled_amount = LEAST(net_earning, COALESCE(settled_amount,0) + ROUND((net_earning - COALESCE(settled_amount,0)) * COALESCE(_per,1), 2)),
         settlement_status = CASE
           WHEN _new_status = 'paid' THEN 'paid'::public.earning_settlement_status
           ELSE settlement_status
         END,
         updated_at = now()
   WHERE settlement_request_id = _request_id;

  INSERT INTO public.settlement_audit_log (
    workspace_id, settlement_request_id, actor_id, action,
    old_status, new_status, old_amount, new_amount, remarks
  ) VALUES (
    _r.workspace_id, _request_id, auth.uid(), 'payment_recorded',
    _r.status::text, _new_status, COALESCE(_r.paid_amount,0), _paid, _notes
  );

  RETURN _tx;
END $function$;

-- ============================================================
-- 13) RPC: admin verifies instructor bank details
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_verify_instructor_bank(
  _instructor_profile_id uuid, _verified boolean, _notes text DEFAULT NULL
) RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _ip public.instructor_profiles;
BEGIN
  SELECT * INTO _ip FROM public.instructor_profiles WHERE id = _instructor_profile_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Instructor profile not found'; END IF;
  IF NOT public.has_any_workspace_role(auth.uid(), _ip.workspace_id,
       ARRAY['organization_admin','staff','super_admin']::app_role[]) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.instructor_profiles
     SET bank_verified = _verified,
         bank_verified_at = CASE WHEN _verified THEN now() ELSE NULL END,
         bank_verified_by = CASE WHEN _verified THEN auth.uid() ELSE NULL END,
         verification_notes = COALESCE(_notes, verification_notes),
         updated_at = now()
   WHERE id = _instructor_profile_id;
END $function$;

NOTIFY pgrst, 'reload schema';

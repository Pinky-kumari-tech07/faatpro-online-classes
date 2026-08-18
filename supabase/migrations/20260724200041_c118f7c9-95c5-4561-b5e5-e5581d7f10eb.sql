
-- Fix #4: Preserve discount attribution on instructor earnings
ALTER TABLE public.instructor_earnings
  ADD COLUMN IF NOT EXISTS coupon_code text,
  ADD COLUMN IF NOT EXISTS original_discount_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS refunded_discount_amount numeric(12,2) NOT NULL DEFAULT 0;

-- Update snapshot trigger to capture original_discount_amount
CREATE OR REPLACE FUNCTION public.tg_earnings_snapshot_originals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.original_gross_amount IS NULL THEN NEW.original_gross_amount := NEW.gross_amount; END IF;
  IF NEW.original_commission_amount IS NULL THEN NEW.original_commission_amount := NEW.commission_amount; END IF;
  IF NEW.original_net_earning IS NULL THEN NEW.original_net_earning := NEW.net_earning; END IF;
  IF NEW.original_tax_amount IS NULL THEN NEW.original_tax_amount := NEW.tax_amount; END IF;
  IF NEW.original_net_revenue_base IS NULL THEN NEW.original_net_revenue_base := NEW.net_revenue_base; END IF;
  IF NEW.original_discount_amount IS NULL THEN NEW.original_discount_amount := NEW.discount_amount; END IF;
  RETURN NEW;
END $$;

-- Backfill originals for existing rows
UPDATE public.instructor_earnings
SET original_discount_amount = discount_amount
WHERE original_discount_amount IS NULL;

-- Fix earnings creation: use payments.discount_amount and coupon_code directly,
-- and stop double-subtracting discount from the commission base.
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
  _coupon text;
BEGIN
  IF NEW.status <> 'succeeded' OR NEW.course_id IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO _course FROM public.courses WHERE id = NEW.course_id;
  _instructor := _course.instructor_id;
  _currency := COALESCE(NEW.currency, _course.currency, 'INR');
  IF _instructor IS NULL THEN RETURN NEW; END IF;

  IF EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE profile_id = _instructor
      AND role IN ('organization_admin','super_admin','staff')
      AND status = 'active'
  ) THEN
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM public.instructor_earnings WHERE payment_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  _gross    := COALESCE(NEW.total_amount, NEW.amount, 0);
  _tax      := COALESCE(NEW.tax_amount, 0);
  -- Use the true discount recorded on the payment, not a derivation.
  _discount := COALESCE(NEW.discount_amount, 0);
  _coupon   := NULLIF(NEW.coupon_code, '');
  -- Commission base = post-discount, pre-tax amount actually charged.
  -- Discount is already reflected in NEW.amount / (total_amount - tax_amount);
  -- do NOT subtract it again.
  _base     := GREATEST(_gross - _tax, 0);
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
      _pct := COALESCE(_course.revenue_instructor_pct, 50);
      IF _pct IS NULL OR _pct = 0 THEN
        _pct := public.resolve_commission_percentage(NEW.workspace_id, _instructor, NEW.course_id);
      END IF;
      _instr_share := ROUND(_base * _pct / 100.0, 2);
      _plat_share  := _base - _instr_share;
  END CASE;

  INSERT INTO public.instructor_earnings (
    workspace_id, instructor_id, course_id, student_id, payment_id,
    gross_amount, tax_amount, discount_amount, coupon_code, net_revenue_base,
    commission_percentage, commission_amount, net_earning,
    revenue_model, currency, status, settlement_status, earned_at
  ) VALUES (
    NEW.workspace_id, _instructor, NEW.course_id, NEW.student_id, NEW.id,
    _gross, _tax, _discount, _coupon, _base,
    _pct, _plat_share, _instr_share,
    _model, _currency, 'active', 'pending',
    COALESCE(NEW.updated_at, NEW.created_at, now())
  );

  IF _model = 'one_time_contract' AND _instr_share > 0 AND _course.revenue_one_time_paid_at IS NULL THEN
    UPDATE public.courses SET revenue_one_time_paid_at = now() WHERE id = _course.id;
  END IF;

  RETURN NEW;
END $function$;

-- Prorate discount reversal on refunds
CREATE OR REPLACE FUNCTION public.apply_refund_to_earning()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _pay public.payments;
  _earning public.instructor_earnings;
  _paid numeric(12,2);
  _refunded_total numeric(12,2);
  _ratio numeric;
BEGIN
  SELECT * INTO _pay FROM public.payments WHERE id = NEW.payment_id;
  IF _pay IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO _earning FROM public.instructor_earnings WHERE payment_id = _pay.id;
  IF _earning IS NULL THEN RETURN NEW; END IF;

  _paid := COALESCE(_earning.original_gross_amount, _earning.gross_amount, 0);
  SELECT COALESCE(SUM(amount),0) INTO _refunded_total FROM public.refunds WHERE payment_id = _pay.id;
  IF _paid <= 0 THEN RETURN NEW; END IF;
  _ratio := LEAST(_refunded_total / _paid, 1);

  UPDATE public.instructor_earnings
  SET
    gross_amount       = ROUND(COALESCE(original_gross_amount, gross_amount) * (1 - _ratio), 2),
    tax_amount         = ROUND(COALESCE(original_tax_amount, tax_amount) * (1 - _ratio), 2),
    discount_amount    = ROUND(COALESCE(original_discount_amount, discount_amount) * (1 - _ratio), 2),
    net_revenue_base   = ROUND(COALESCE(original_net_revenue_base, net_revenue_base) * (1 - _ratio), 2),
    commission_amount  = ROUND(COALESCE(original_commission_amount, commission_amount) * (1 - _ratio), 2),
    net_earning        = ROUND(COALESCE(original_net_earning, net_earning) * (1 - _ratio), 2),
    refunded_gross_amount      = ROUND(COALESCE(original_gross_amount, gross_amount) * _ratio, 2),
    refunded_tax_amount        = ROUND(COALESCE(original_tax_amount, tax_amount) * _ratio, 2),
    refunded_discount_amount   = ROUND(COALESCE(original_discount_amount, discount_amount) * _ratio, 2),
    refunded_net_revenue_base  = ROUND(COALESCE(original_net_revenue_base, net_revenue_base) * _ratio, 2),
    refunded_commission_amount = ROUND(COALESCE(original_commission_amount, commission_amount) * _ratio, 2),
    refunded_tax_amount        = ROUND(COALESCE(original_tax_amount, tax_amount) * _ratio, 2),
    status = CASE WHEN _ratio >= 1 THEN 'refunded'::earning_status
                  WHEN _ratio > 0  THEN 'partially_refunded'::earning_status
                  ELSE status END,
    updated_at = now()
  WHERE id = _earning.id;

  RETURN NEW;
END $$;

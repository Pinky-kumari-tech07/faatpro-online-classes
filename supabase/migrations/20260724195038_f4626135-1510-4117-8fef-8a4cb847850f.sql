
-- Fix #1: Prorated partial refunds against instructor earnings
-- Adds 'partially_refunded' enum value, snapshot columns for original amounts,
-- and rewrites apply_refund_to_earning() to prorate based on the sum of
-- completed refunds against the original paid amount.

-- 1. Extend earning_status enum
ALTER TYPE public.earning_status ADD VALUE IF NOT EXISTS 'partially_refunded';

-- 2. Snapshot columns for original earning values (immutable source of truth for proration)
ALTER TABLE public.instructor_earnings
  ADD COLUMN IF NOT EXISTS original_gross_amount      numeric(12,2),
  ADD COLUMN IF NOT EXISTS original_commission_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS original_net_earning       numeric(12,2),
  ADD COLUMN IF NOT EXISTS original_tax_amount        numeric(12,2),
  ADD COLUMN IF NOT EXISTS refunded_commission_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refunded_tax_amount        numeric(12,2) NOT NULL DEFAULT 0;

-- Backfill snapshots where missing: treat currently-stored (or already-refunded) amounts
-- as the original values. For rows already fully refunded (net_earning=0), reconstruct
-- from refunded_amount + commission_amount + tax_amount.
UPDATE public.instructor_earnings
   SET original_gross_amount      = COALESCE(original_gross_amount, gross_amount),
       original_commission_amount = COALESCE(original_commission_amount, commission_amount),
       original_net_earning       = COALESCE(original_net_earning,
                                             CASE WHEN status = 'refunded'
                                                  THEN COALESCE(refunded_amount, 0)
                                                  ELSE net_earning END),
       original_tax_amount        = COALESCE(original_tax_amount, tax_amount)
 WHERE original_gross_amount IS NULL
    OR original_commission_amount IS NULL
    OR original_net_earning IS NULL
    OR original_tax_amount IS NULL;

-- 3. Rewrite the refund trigger to prorate
CREATE OR REPLACE FUNCTION public.apply_refund_to_earning()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _e            public.instructor_earnings;
  _paid_total   numeric(12,2);
  _refund_total numeric(12,2);
  _ratio        numeric(20,10);
  _new_status   public.earning_status;
BEGIN
  IF NEW.status <> 'completed' THEN RETURN NEW; END IF;

  SELECT * INTO _e FROM public.instructor_earnings
   WHERE payment_id = NEW.payment_id LIMIT 1;
  IF NOT FOUND THEN RETURN NEW; END IF;

  -- Ensure snapshot exists (safety net for older rows)
  IF _e.original_net_earning IS NULL THEN
    UPDATE public.instructor_earnings
       SET original_gross_amount      = gross_amount,
           original_commission_amount = commission_amount,
           original_net_earning       = net_earning,
           original_tax_amount        = tax_amount
     WHERE id = _e.id
     RETURNING * INTO _e;
  END IF;

  -- Paid amount for the underlying payment
  SELECT COALESCE(total_amount, amount, 0)
    INTO _paid_total
    FROM public.payments WHERE id = NEW.payment_id;

  IF COALESCE(_paid_total, 0) <= 0 THEN
    _paid_total := COALESCE(_e.original_gross_amount, 0);
  END IF;

  -- Sum all completed refunds for this payment (including this one)
  SELECT COALESCE(SUM(amount), 0) INTO _refund_total
    FROM public.refunds
   WHERE payment_id = NEW.payment_id
     AND status = 'completed';

  IF _paid_total <= 0 THEN
    _ratio := 1;
  ELSE
    _ratio := LEAST(1.0, GREATEST(0.0, _refund_total / _paid_total));
  END IF;

  IF _ratio >= 0.9999 THEN
    _new_status := 'refunded';
  ELSIF _ratio > 0 THEN
    _new_status := 'partially_refunded';
  ELSE
    _new_status := _e.status;
  END IF;

  UPDATE public.instructor_earnings
     SET refunded_amount             = ROUND(COALESCE(_e.original_net_earning, 0)       * _ratio, 2),
         refunded_commission_amount  = ROUND(COALESCE(_e.original_commission_amount, 0) * _ratio, 2),
         refunded_tax_amount         = ROUND(COALESCE(_e.original_tax_amount, 0)        * _ratio, 2),
         net_earning       = ROUND(COALESCE(_e.original_net_earning, 0)       * (1 - _ratio), 2),
         commission_amount = ROUND(COALESCE(_e.original_commission_amount, 0) * (1 - _ratio), 2),
         tax_amount        = ROUND(COALESCE(_e.original_tax_amount, 0)        * (1 - _ratio), 2),
         status = _new_status,
         settlement_status = CASE
           WHEN settlement_status = 'paid' AND _ratio >= 0.9999 THEN 'reversed'::public.earning_settlement_status
           ELSE settlement_status
         END,
         updated_at = now()
   WHERE id = _e.id;

  RETURN NEW;
END $function$;

-- 4. Snapshot originals whenever a new earning is created (defense in depth)
CREATE OR REPLACE FUNCTION public.tg_earnings_snapshot_originals()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.original_gross_amount      IS NULL THEN NEW.original_gross_amount      := NEW.gross_amount;      END IF;
  IF NEW.original_commission_amount IS NULL THEN NEW.original_commission_amount := NEW.commission_amount; END IF;
  IF NEW.original_net_earning       IS NULL THEN NEW.original_net_earning       := NEW.net_earning;       END IF;
  IF NEW.original_tax_amount        IS NULL THEN NEW.original_tax_amount        := NEW.tax_amount;        END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_earnings_snapshot_originals ON public.instructor_earnings;
CREATE TRIGGER trg_earnings_snapshot_originals
BEFORE INSERT ON public.instructor_earnings
FOR EACH ROW EXECUTE FUNCTION public.tg_earnings_snapshot_originals();

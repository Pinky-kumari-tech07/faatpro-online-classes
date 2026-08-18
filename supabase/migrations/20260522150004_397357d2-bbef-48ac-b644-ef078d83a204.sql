
-- Courses pricing fields
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS pricing_type text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS sale_price numeric,
  ADD COLUMN IF NOT EXISTS discount_type text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS discount_value numeric,
  ADD COLUMN IF NOT EXISTS discount_starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS discount_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS tax_inclusive boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gst_rate numeric,
  ADD COLUMN IF NOT EXISTS allow_coupons boolean NOT NULL DEFAULT true;

DO $$ BEGIN
  ALTER TABLE public.courses ADD CONSTRAINT courses_pricing_type_chk CHECK (pricing_type IN ('free','paid'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.courses ADD CONSTRAINT courses_discount_type_chk CHECK (discount_type IN ('none','percentage','fixed'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Backfill: existing rows with price_amount>0 become paid
UPDATE public.courses SET pricing_type='paid' WHERE price_amount IS NOT NULL AND price_amount > 0 AND pricing_type='free';

CREATE OR REPLACE FUNCTION public.validate_course_pricing()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.pricing_type = 'free' THEN
    NEW.price_amount := 0;
    NEW.sale_price := NULL;
    NEW.discount_type := 'none';
    NEW.discount_value := NULL;
    NEW.discount_starts_at := NULL;
    NEW.discount_ends_at := NULL;
  ELSE
    IF NEW.price_amount IS NULL OR NEW.price_amount <= 0 THEN
      RAISE EXCEPTION 'Paid courses require a price greater than 0';
    END IF;
    IF NEW.sale_price IS NOT NULL AND NEW.sale_price >= NEW.price_amount THEN
      RAISE EXCEPTION 'Sale price must be less than base price';
    END IF;
    IF NEW.discount_type = 'percentage' AND NEW.discount_value IS NOT NULL AND (NEW.discount_value < 0 OR NEW.discount_value > 100) THEN
      RAISE EXCEPTION 'Percentage discount must be between 0 and 100';
    END IF;
    IF NEW.discount_type = 'fixed' AND NEW.discount_value IS NOT NULL AND NEW.discount_value > NEW.price_amount THEN
      RAISE EXCEPTION 'Fixed discount cannot exceed base price';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_validate_course_pricing ON public.courses;
CREATE TRIGGER trg_validate_course_pricing
  BEFORE INSERT OR UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.validate_course_pricing();

-- Coupons extension
ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS applies_to text NOT NULL DEFAULT 'all_courses',
  ADD COLUMN IF NOT EXISTS course_ids jsonb,
  ADD COLUMN IF NOT EXISTS redeemed_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$ BEGIN
  ALTER TABLE public.coupons ADD CONSTRAINT coupons_applies_to_chk CHECK (applies_to IN ('all_courses','specific_courses'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DROP TRIGGER IF EXISTS trg_coupons_updated_at ON public.coupons;
CREATE TRIGGER trg_coupons_updated_at BEFORE UPDATE ON public.coupons
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Payments extension
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS base_price numeric,
  ADD COLUMN IF NOT EXISTS discount_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coupon_code text,
  ADD COLUMN IF NOT EXISTS tax_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_amount numeric,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS trg_payments_updated_at ON public.payments;
CREATE TRIGGER trg_payments_updated_at BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

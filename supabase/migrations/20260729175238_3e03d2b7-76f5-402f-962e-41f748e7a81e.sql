-- ============================================================
-- Centralized data-integrity layer (BUG-001 .. BUG-016)
-- Every rule enforced in the UI is mirrored here so direct API
-- calls / dev-tools cannot bypass validation.
-- ============================================================

-- Helper: does the text contain at least one alphabet character
CREATE OR REPLACE FUNCTION public.has_alpha(_text text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT _text IS NOT NULL AND _text ~ '[A-Za-z]'
$$;

-- Helper: safe display name (letters, numbers, space & - ( ) . , ' / )
CREATE OR REPLACE FUNCTION public.is_safe_name(_text text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT _text IS NOT NULL
     AND _text ~ '[A-Za-z]'
     AND _text ~ '^[A-Za-z0-9 &\-().,''/]+$'
$$;

CREATE OR REPLACE FUNCTION public.is_valid_email(_text text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT _text ~* '^[A-Za-z0-9!#$%&''*+/=?^_`{|}~.-]+@([A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}$'
$$;

CREATE OR REPLACE FUNCTION public.is_valid_phone(_text text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT regexp_replace(coalesce(_text,''), '[\s()\-.]', '', 'g') ~ '^\+?[0-9]{10,15}$'
$$;

CREATE OR REPLACE FUNCTION public.is_valid_gstin(_text text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT upper(_text) ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{1}Z[A-Z0-9]{1}$'
$$;

CREATE OR REPLACE FUNCTION public.is_https_url(_text text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT _text ~* '^https://([A-Za-z0-9-]+\.)+[A-Za-z]{2,}(:[0-9]{1,5})?(/.*)?$'
$$;

-- ============================================================
-- PAYMENTS (BUG-001, BUG-003, BUG-005)
-- ============================================================
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_amount_positive;
ALTER TABLE public.payments
  ADD CONSTRAINT payments_amount_positive
  CHECK (amount > 0 AND (total_amount IS NULL OR total_amount > 0)) NOT VALID;

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_currency_valid;
ALTER TABLE public.payments
  ADD CONSTRAINT payments_currency_valid
  CHECK (currency IS NULL OR upper(currency) IN ('INR','USD','EUR','GBP')) NOT VALID;

-- A succeeded gateway payment must carry a transaction reference.
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_gateway_txn_required;
ALTER TABLE public.payments
  ADD CONSTRAINT payments_gateway_txn_required
  CHECK (
    lower(coalesce(provider,'offline')) NOT IN ('razorpay','stripe','paypal','payu','cashfree')
    OR status <> 'succeeded'
    OR coalesce(nullif(trim(razorpay_payment_id), ''), nullif(trim(external_payment_id), '')) IS NOT NULL
  ) NOT VALID;

-- ============================================================
-- BATCHES (BUG-007, BUG-008)
-- ============================================================
ALTER TABLE public.batches DROP CONSTRAINT IF EXISTS batches_date_order;
ALTER TABLE public.batches
  ADD CONSTRAINT batches_date_order
  CHECK (start_date IS NULL OR end_date IS NULL OR end_date >= start_date) NOT VALID;

ALTER TABLE public.batches DROP CONSTRAINT IF EXISTS batches_coordinator_email_valid;
ALTER TABLE public.batches
  ADD CONSTRAINT batches_coordinator_email_valid
  CHECK (coordinator_email IS NULL OR trim(coordinator_email) = '' OR public.is_valid_email(coordinator_email)) NOT VALID;

ALTER TABLE public.batches DROP CONSTRAINT IF EXISTS batches_coordinator_phone_valid;
ALTER TABLE public.batches
  ADD CONSTRAINT batches_coordinator_phone_valid
  CHECK (coordinator_phone IS NULL OR trim(coordinator_phone) = '' OR public.is_valid_phone(coordinator_phone)) NOT VALID;

-- ============================================================
-- CATEGORIES (BUG-006)
-- ============================================================
ALTER TABLE public.course_categories DROP CONSTRAINT IF EXISTS course_categories_name_valid;
ALTER TABLE public.course_categories
  ADD CONSTRAINT course_categories_name_valid
  CHECK (public.is_safe_name(name) AND char_length(trim(name)) BETWEEN 2 AND 60) NOT VALID;

-- ============================================================
-- GST SETTINGS (BUG-011 .. BUG-016)
-- ============================================================
ALTER TABLE public.gst_settings DROP CONSTRAINT IF EXISTS gst_settings_company_name_valid;
ALTER TABLE public.gst_settings
  ADD CONSTRAINT gst_settings_company_name_valid
  CHECK (company_name IS NULL OR trim(company_name) = '' OR public.has_alpha(company_name)) NOT VALID;

ALTER TABLE public.gst_settings DROP CONSTRAINT IF EXISTS gst_settings_gstin_valid;
ALTER TABLE public.gst_settings
  ADD CONSTRAINT gst_settings_gstin_valid
  CHECK (company_gstin IS NULL OR trim(company_gstin) = '' OR public.is_valid_gstin(company_gstin)) NOT VALID;

ALTER TABLE public.gst_settings DROP CONSTRAINT IF EXISTS gst_settings_pan_valid;
ALTER TABLE public.gst_settings
  ADD CONSTRAINT gst_settings_pan_valid
  CHECK (pan_number IS NULL OR trim(pan_number) = '' OR upper(pan_number) ~ '^[A-Z]{5}[0-9]{4}[A-Z]$') NOT VALID;

ALTER TABLE public.gst_settings DROP CONSTRAINT IF EXISTS gst_settings_rate_range;
ALTER TABLE public.gst_settings
  ADD CONSTRAINT gst_settings_rate_range
  CHECK (default_gst_rate IS NULL OR (default_gst_rate >= 0 AND default_gst_rate <= 28)) NOT VALID;

ALTER TABLE public.gst_settings DROP CONSTRAINT IF EXISTS gst_settings_email_valid;
ALTER TABLE public.gst_settings
  ADD CONSTRAINT gst_settings_email_valid
  CHECK (business_email IS NULL OR trim(business_email) = '' OR public.is_valid_email(business_email)) NOT VALID;

ALTER TABLE public.gst_settings DROP CONSTRAINT IF EXISTS gst_settings_phone_valid;
ALTER TABLE public.gst_settings
  ADD CONSTRAINT gst_settings_phone_valid
  CHECK (business_phone IS NULL OR trim(business_phone) = '' OR public.is_valid_phone(business_phone)) NOT VALID;

-- ============================================================
-- LIVE CLASSES (BUG-009)
-- ============================================================
ALTER TABLE public.live_classes DROP CONSTRAINT IF EXISTS live_classes_url_https;
ALTER TABLE public.live_classes
  ADD CONSTRAINT live_classes_url_https
  CHECK (meeting_url IS NULL OR trim(meeting_url) = '' OR public.is_https_url(meeting_url)) NOT VALID;

ALTER TABLE public.live_classes DROP CONSTRAINT IF EXISTS live_classes_time_order;
ALTER TABLE public.live_classes
  ADD CONSTRAINT live_classes_time_order
  CHECK (starts_at IS NULL OR ends_at IS NULL OR ends_at > starts_at) NOT VALID;
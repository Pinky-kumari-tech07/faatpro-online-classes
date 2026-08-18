
-- =========================
-- 1. Profile billing fields
-- =========================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS billing_full_name text,
  ADD COLUMN IF NOT EXISTS billing_address text,
  ADD COLUMN IF NOT EXISTS billing_city text,
  ADD COLUMN IF NOT EXISTS billing_state text,
  ADD COLUMN IF NOT EXISTS billing_country text DEFAULT 'India',
  ADD COLUMN IF NOT EXISTS billing_pin text,
  ADD COLUMN IF NOT EXISTS billing_phone text,
  ADD COLUMN IF NOT EXISTS billing_gstin text;

-- =========================
-- 2. GST settings per workspace
-- =========================
CREATE TABLE IF NOT EXISTS public.gst_settings (
  workspace_id uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  company_name text NOT NULL DEFAULT 'FAATPRO',
  company_gstin text,
  pan_number text,
  business_address text,
  business_city text,
  business_state text NOT NULL DEFAULT 'Odisha',
  business_country text NOT NULL DEFAULT 'India',
  business_pin text,
  business_email text,
  business_phone text,
  invoice_prefix text NOT NULL DEFAULT 'INV',
  invoice_starting_number integer NOT NULL DEFAULT 1,
  default_hsn_sac text NOT NULL DEFAULT '999293',
  default_gst_rate numeric NOT NULL DEFAULT 18,
  logo_url text,
  signature_url text,
  authorized_signatory text,
  terms text,
  bank_details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gst_settings TO authenticated;
GRANT SELECT ON public.gst_settings TO anon;
GRANT ALL ON public.gst_settings TO service_role;
ALTER TABLE public.gst_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gst_settings_read" ON public.gst_settings
  FOR SELECT USING (true);

CREATE POLICY "gst_settings_admin_write" ON public.gst_settings
  FOR ALL TO authenticated
  USING (public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role,'staff'::app_role,'super_admin'::app_role]))
  WITH CHECK (public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role,'staff'::app_role,'super_admin'::app_role]));

CREATE TRIGGER gst_settings_set_updated_at BEFORE UPDATE ON public.gst_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- 3. Invoice sequence
-- =========================
CREATE TABLE IF NOT EXISTS public.invoice_sequences (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  doc_type text NOT NULL CHECK (doc_type IN ('invoice','credit_note')),
  next_number integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, doc_type)
);
GRANT SELECT, INSERT, UPDATE ON public.invoice_sequences TO authenticated;
GRANT ALL ON public.invoice_sequences TO service_role;
ALTER TABLE public.invoice_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invoice_sequences_admin_only" ON public.invoice_sequences
  FOR ALL TO authenticated
  USING (public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role,'staff'::app_role,'super_admin'::app_role]))
  WITH CHECK (public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role,'staff'::app_role,'super_admin'::app_role]));

-- =========================
-- 4. Extend invoices
-- =========================
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS doc_type text NOT NULL DEFAULT 'invoice',
  ADD COLUMN IF NOT EXISTS original_invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS refund_id uuid REFERENCES public.refunds(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS order_id text,
  ADD COLUMN IF NOT EXISTS hsn_sac text,
  ADD COLUMN IF NOT EXISTS qty integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rate numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS course_title text,
  ADD COLUMN IF NOT EXISTS taxable_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gst_type text NOT NULL DEFAULT 'inter_state',
  ADD COLUMN IF NOT EXISTS cgst_rate numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cgst_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sgst_rate numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sgst_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS igst_rate numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS igst_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_in_words text,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'paid',
  -- buyer snapshot
  ADD COLUMN IF NOT EXISTS buyer_name text,
  ADD COLUMN IF NOT EXISTS buyer_email text,
  ADD COLUMN IF NOT EXISTS buyer_phone text,
  ADD COLUMN IF NOT EXISTS buyer_address text,
  ADD COLUMN IF NOT EXISTS buyer_city text,
  ADD COLUMN IF NOT EXISTS buyer_state text,
  ADD COLUMN IF NOT EXISTS buyer_country text,
  ADD COLUMN IF NOT EXISTS buyer_pin text,
  ADD COLUMN IF NOT EXISTS buyer_gstin text,
  -- seller snapshot
  ADD COLUMN IF NOT EXISTS seller_name text,
  ADD COLUMN IF NOT EXISTS seller_gstin text,
  ADD COLUMN IF NOT EXISTS seller_pan text,
  ADD COLUMN IF NOT EXISTS seller_address text,
  ADD COLUMN IF NOT EXISTS seller_state text,
  ADD COLUMN IF NOT EXISTS seller_email text,
  ADD COLUMN IF NOT EXISTS seller_phone text,
  ADD COLUMN IF NOT EXISTS place_of_supply text,
  ADD COLUMN IF NOT EXISTS pdf_url text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Constraint for doc_type
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='invoices_doc_type_chk') THEN
    ALTER TABLE public.invoices ADD CONSTRAINT invoices_doc_type_chk CHECK (doc_type IN ('invoice','credit_note'));
  END IF;
END $$;

DROP TRIGGER IF EXISTS invoices_set_updated_at ON public.invoices;
CREATE TRIGGER invoices_set_updated_at BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- 5. Audit log
-- =========================
CREATE TABLE IF NOT EXISTS public.invoice_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE CASCADE,
  actor_id uuid,
  action text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.invoice_audit_log TO authenticated;
GRANT ALL ON public.invoice_audit_log TO service_role;
ALTER TABLE public.invoice_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invoice_audit_admin_read" ON public.invoice_audit_log
  FOR SELECT TO authenticated
  USING (public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role,'staff'::app_role,'super_admin'::app_role]));
CREATE POLICY "invoice_audit_insert" ON public.invoice_audit_log
  FOR INSERT TO authenticated WITH CHECK (true);

-- =========================
-- 6. Number to words helper
-- =========================
CREATE OR REPLACE FUNCTION public.num_to_words_inr(_n numeric)
RETURNS text
LANGUAGE plpgsql IMMUTABLE
SET search_path = public
AS $$
DECLARE
  ones text[] := ARRAY['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
                       'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  tens text[] := ARRAY['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  function_two text := '';
  function_two_helper text := '';
  rupees bigint;
  paise int;
  result text := '';
  crore bigint; lakh bigint; thousand bigint; hundred bigint; rest bigint;
BEGIN
  IF _n IS NULL THEN RETURN ''; END IF;
  rupees := floor(_n)::bigint;
  paise := round((_n - floor(_n)) * 100)::int;

  IF rupees = 0 THEN
    result := 'Zero';
  ELSE
    crore := rupees / 10000000; rupees := rupees % 10000000;
    lakh := rupees / 100000;    rupees := rupees % 100000;
    thousand := rupees / 1000;  rupees := rupees % 1000;
    hundred := rupees / 100;    rest := rupees % 100;

    IF crore > 0 THEN result := result || public.num_to_words_two(crore) || ' Crore '; END IF;
    IF lakh > 0  THEN result := result || public.num_to_words_two(lakh)  || ' Lakh '; END IF;
    IF thousand > 0 THEN result := result || public.num_to_words_two(thousand) || ' Thousand '; END IF;
    IF hundred > 0 THEN result := result || ones[hundred+1] || ' Hundred '; END IF;
    IF rest > 0 THEN
      IF result <> '' THEN result := result || 'and '; END IF;
      result := result || public.num_to_words_two(rest);
    END IF;
  END IF;
  result := trim(result) || ' Rupees';
  IF paise > 0 THEN
    result := result || ' and ' || public.num_to_words_two(paise) || ' Paise';
  END IF;
  RETURN result || ' Only';
END $$;

CREATE OR REPLACE FUNCTION public.num_to_words_two(_n bigint)
RETURNS text LANGUAGE plpgsql IMMUTABLE
SET search_path = public AS $$
DECLARE
  ones text[] := ARRAY['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
                       'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  tens text[] := ARRAY['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
BEGIN
  IF _n < 20 THEN RETURN ones[_n+1]; END IF;
  IF _n % 10 = 0 THEN RETURN tens[(_n/10)+1]; END IF;
  RETURN tens[(_n/10)+1] || ' ' || ones[(_n%10)+1];
END $$;

-- =========================
-- 7. Allocate next invoice number
-- =========================
CREATE OR REPLACE FUNCTION public.allocate_invoice_number(_workspace_id uuid, _doc_type text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _prefix text;
  _start integer;
  _next integer;
  _final text;
BEGIN
  SELECT invoice_prefix, invoice_starting_number INTO _prefix, _start
    FROM public.gst_settings WHERE workspace_id = _workspace_id;
  IF _prefix IS NULL THEN _prefix := 'INV'; END IF;
  IF _start IS NULL THEN _start := 1; END IF;
  IF _doc_type = 'credit_note' THEN _prefix := 'CN-' || _prefix; END IF;

  INSERT INTO public.invoice_sequences (workspace_id, doc_type, next_number)
    VALUES (_workspace_id, _doc_type, _start)
  ON CONFLICT (workspace_id, doc_type) DO NOTHING;

  UPDATE public.invoice_sequences
     SET next_number = GREATEST(next_number, _start) + 1,
         updated_at = now()
   WHERE workspace_id = _workspace_id AND doc_type = _doc_type
   RETURNING next_number - 1 INTO _next;

  _final := _prefix || '/' || to_char(now(), 'YYYY-MM') || '/' || lpad(_next::text, 5, '0');
  RETURN _final;
END $$;

-- =========================
-- 8. Generate GST invoice for a paid payment
-- =========================
CREATE OR REPLACE FUNCTION public.generate_gst_invoice(_payment_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _pay public.payments;
  _course public.courses;
  _profile public.profiles;
  _gst public.gst_settings;
  _existing uuid;
  _seller_state text;
  _buyer_state text;
  _is_intra boolean;
  _taxable numeric;
  _gst_rate numeric;
  _cgst numeric := 0; _sgst numeric := 0; _igst numeric := 0;
  _total numeric;
  _hsn text;
  _num text;
  _invoice_id uuid;
BEGIN
  SELECT * INTO _pay FROM public.payments WHERE id = _payment_id;
  IF NOT FOUND OR _pay.status <> 'paid' THEN RETURN NULL; END IF;

  SELECT id INTO _existing FROM public.invoices
    WHERE payment_id = _payment_id AND doc_type='invoice' LIMIT 1;
  IF _existing IS NOT NULL THEN RETURN _existing; END IF;

  SELECT * INTO _course FROM public.courses WHERE id = _pay.course_id;
  SELECT * INTO _profile FROM public.profiles WHERE id = _pay.student_id;
  SELECT * INTO _gst FROM public.gst_settings WHERE workspace_id = _pay.workspace_id;

  _seller_state := COALESCE(_gst.business_state, 'Odisha');
  _buyer_state := COALESCE(_profile.billing_state, _seller_state);
  _is_intra := lower(trim(_seller_state)) = lower(trim(_buyer_state));

  _gst_rate := COALESCE(_course.gst_rate, _gst.default_gst_rate, 18);
  _hsn := COALESCE(_gst.default_hsn_sac, '999293');

  IF COALESCE(_course.tax_inclusive, false) THEN
    _total := COALESCE(_pay.total_amount, _pay.amount, 0);
    _taxable := round(_total / (1 + _gst_rate/100.0), 2);
  ELSE
    _taxable := COALESCE(_pay.total_amount, _pay.amount, 0) - COALESCE(_pay.tax_amount, 0);
    IF _taxable <= 0 THEN
      _taxable := COALESCE(_pay.total_amount, _pay.amount, 0);
    END IF;
    _total := _taxable + round(_taxable * _gst_rate/100.0, 2);
  END IF;

  IF _is_intra THEN
    _cgst := round(_taxable * (_gst_rate/2)/100.0, 2);
    _sgst := round(_taxable * (_gst_rate/2)/100.0, 2);
    _igst := 0;
  ELSE
    _igst := round(_taxable * _gst_rate/100.0, 2);
  END IF;
  _total := round(_taxable + _cgst + _sgst + _igst, 2);

  _num := public.allocate_invoice_number(_pay.workspace_id, 'invoice');

  INSERT INTO public.invoices (
    workspace_id, payment_id, student_id, course_id, invoice_number,
    amount, tax, total_amount, currency, status, issued_at,
    doc_type, order_id, hsn_sac, qty, rate, course_title, taxable_amount,
    gst_type, cgst_rate, cgst_amount, sgst_rate, sgst_amount, igst_rate, igst_amount,
    amount_in_words, payment_method, payment_status,
    buyer_name, buyer_email, buyer_phone, buyer_address, buyer_city, buyer_state,
    buyer_country, buyer_pin, buyer_gstin,
    seller_name, seller_gstin, seller_pan, seller_address, seller_state, seller_email, seller_phone,
    place_of_supply, gst_number
  ) VALUES (
    _pay.workspace_id, _pay.id, _pay.student_id, _pay.course_id, _num,
    _taxable, _cgst+_sgst+_igst, _total, COALESCE(_pay.currency,'INR'), 'paid'::invoice_status, now(),
    'invoice', COALESCE(_pay.razorpay_order_id, _pay.external_payment_id, _pay.id::text),
    _hsn, 1, _taxable, COALESCE(_course.title,'Course'), _taxable,
    CASE WHEN _is_intra THEN 'intra_state' ELSE 'inter_state' END,
    CASE WHEN _is_intra THEN _gst_rate/2 ELSE 0 END, _cgst,
    CASE WHEN _is_intra THEN _gst_rate/2 ELSE 0 END, _sgst,
    CASE WHEN _is_intra THEN 0 ELSE _gst_rate END, _igst,
    public.num_to_words_inr(_total),
    COALESCE(_pay.provider,'razorpay'), 'paid',
    COALESCE(_profile.billing_full_name, _profile.full_name),
    _profile.email, COALESCE(_profile.billing_phone, _profile.phone),
    _profile.billing_address, _profile.billing_city, _buyer_state,
    COALESCE(_profile.billing_country,'India'), _profile.billing_pin, _profile.billing_gstin,
    COALESCE(_gst.company_name,'FAATPRO'), _gst.company_gstin, _gst.pan_number,
    _gst.business_address, _seller_state, _gst.business_email, _gst.business_phone,
    _buyer_state, _profile.billing_gstin
  ) RETURNING id INTO _invoice_id;

  INSERT INTO public.invoice_audit_log (workspace_id, invoice_id, actor_id, action, details)
    VALUES (_pay.workspace_id, _invoice_id, _pay.student_id, 'invoice_generated',
            jsonb_build_object('payment_id', _pay.id, 'invoice_number', _num));

  RETURN _invoice_id;
END $$;

-- =========================
-- 9. Generate credit note for refund
-- =========================
CREATE OR REPLACE FUNCTION public.generate_credit_note(_refund_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _r public.refunds;
  _orig public.invoices;
  _existing uuid;
  _ratio numeric;
  _taxable numeric; _cgst numeric; _sgst numeric; _igst numeric; _total numeric;
  _num text;
  _cn_id uuid;
BEGIN
  SELECT * INTO _r FROM public.refunds WHERE id = _refund_id;
  IF NOT FOUND OR _r.status <> 'completed' THEN RETURN NULL; END IF;

  SELECT id INTO _existing FROM public.invoices
    WHERE refund_id = _refund_id AND doc_type='credit_note' LIMIT 1;
  IF _existing IS NOT NULL THEN RETURN _existing; END IF;

  SELECT * INTO _orig FROM public.invoices
    WHERE payment_id = _r.payment_id AND doc_type='invoice' LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;

  _ratio := LEAST(1, _r.amount / NULLIF(_orig.total_amount, 0));
  _taxable := round(_orig.taxable_amount * _ratio, 2);
  _cgst := round(_orig.cgst_amount * _ratio, 2);
  _sgst := round(_orig.sgst_amount * _ratio, 2);
  _igst := round(_orig.igst_amount * _ratio, 2);
  _total := round(_taxable + _cgst + _sgst + _igst, 2);

  _num := public.allocate_invoice_number(_r.workspace_id, 'credit_note');

  INSERT INTO public.invoices (
    workspace_id, payment_id, student_id, course_id, invoice_number,
    amount, tax, total_amount, currency, status, issued_at,
    doc_type, original_invoice_id, refund_id, order_id, hsn_sac, qty, rate, course_title,
    taxable_amount, gst_type, cgst_rate, cgst_amount, sgst_rate, sgst_amount, igst_rate, igst_amount,
    amount_in_words, payment_method, payment_status,
    buyer_name, buyer_email, buyer_phone, buyer_address, buyer_city, buyer_state,
    buyer_country, buyer_pin, buyer_gstin,
    seller_name, seller_gstin, seller_pan, seller_address, seller_state, seller_email, seller_phone,
    place_of_supply, gst_number, notes
  ) VALUES (
    _r.workspace_id, _r.payment_id, _r.student_id, _r.course_id, _num,
    _taxable, _cgst+_sgst+_igst, _total, _orig.currency, 'paid'::invoice_status, now(),
    'credit_note', _orig.id, _r.id, _orig.order_id, _orig.hsn_sac, 1, _taxable, _orig.course_title,
    _taxable, _orig.gst_type, _orig.cgst_rate, _cgst, _orig.sgst_rate, _sgst, _orig.igst_rate, _igst,
    public.num_to_words_inr(_total),
    _orig.payment_method, 'refunded',
    _orig.buyer_name, _orig.buyer_email, _orig.buyer_phone, _orig.buyer_address, _orig.buyer_city, _orig.buyer_state,
    _orig.buyer_country, _orig.buyer_pin, _orig.buyer_gstin,
    _orig.seller_name, _orig.seller_gstin, _orig.seller_pan, _orig.seller_address, _orig.seller_state, _orig.seller_email, _orig.seller_phone,
    _orig.place_of_supply, _orig.buyer_gstin,
    'Credit note for refund against invoice ' || _orig.invoice_number
  ) RETURNING id INTO _cn_id;

  INSERT INTO public.invoice_audit_log (workspace_id, invoice_id, actor_id, action, details)
    VALUES (_r.workspace_id, _cn_id, _r.processed_by, 'credit_note_generated',
            jsonb_build_object('refund_id', _r.id, 'original_invoice', _orig.invoice_number));

  RETURN _cn_id;
END $$;

-- =========================
-- 10. Triggers
-- =========================
CREATE OR REPLACE FUNCTION public.trg_payments_after_paid()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'paid' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM public.generate_gst_invoice(NEW.id);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payments_generate_invoice ON public.payments;
CREATE TRIGGER payments_generate_invoice
  AFTER INSERT OR UPDATE OF status ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.trg_payments_after_paid();

CREATE OR REPLACE FUNCTION public.trg_refunds_after_completed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'completed' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM public.generate_credit_note(NEW.id);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS refunds_generate_credit_note ON public.refunds;
CREATE TRIGGER refunds_generate_credit_note
  AFTER INSERT OR UPDATE OF status ON public.refunds
  FOR EACH ROW EXECUTE FUNCTION public.trg_refunds_after_completed();

-- =========================
-- 11. Indexes
-- =========================
CREATE INDEX IF NOT EXISTS idx_invoices_workspace_issued ON public.invoices(workspace_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_student ON public.invoices(student_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_doc_type ON public.invoices(workspace_id, doc_type);
CREATE INDEX IF NOT EXISTS idx_invoices_buyer_state ON public.invoices(workspace_id, buyer_state);

CREATE OR REPLACE FUNCTION public.trg_bundle_payment_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.bundle_id IS NOT NULL
     AND NEW.status = 'succeeded'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM public.enroll_student_in_bundle(NEW.student_id, NEW.bundle_id, 'purchase', NEW.id, NULL);
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.trg_payments_after_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'succeeded' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM public.generate_gst_invoice(NEW.id);
  END IF;
  RETURN NEW;
END $$;

DO $$
DECLARE
  _def text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO _def
  FROM pg_proc
  WHERE proname = 'generate_gst_invoice'
    AND pronamespace = 'public'::regnamespace;

  IF _def IS NOT NULL AND position('_pay.status <> ''paid''' in _def) > 0 THEN
    _def := replace(_def, '_pay.status <> ''paid''', '_pay.status <> ''succeeded''');
    EXECUTE _def;
  END IF;
END $$;
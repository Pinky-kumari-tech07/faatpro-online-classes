
CREATE OR REPLACE FUNCTION public.trg_payments_after_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'succeeded' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM public.generate_gst_invoice(NEW.id);
  END IF;
  RETURN NEW;
END $function$;

-- Patch generate_gst_invoice: replace `_pay.status <> 'paid'` with `'succeeded'`
DO $$
DECLARE
  _def text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO _def FROM pg_proc
    WHERE proname='generate_gst_invoice' AND pronamespace='public'::regnamespace;
  IF _def IS NOT NULL THEN
    _def := replace(_def, '_pay.status <> ''paid''', '_pay.status <> ''succeeded''');
    EXECUTE _def;
  END IF;
END $$;

DROP POLICY IF EXISTS payments_student_update_pending ON public.payments;

CREATE OR REPLACE FUNCTION public.request_offline_payment(_payment_id uuid)
RETURNS public.payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _payment public.payments;
BEGIN
  SELECT * INTO _payment
  FROM public.payments
  WHERE id = _payment_id
    AND student_id = auth.uid()
    AND status = 'pending'::public.payment_status;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found or cannot be changed';
  END IF;

  UPDATE public.payments
     SET provider = 'offline',
         updated_at = now()
   WHERE id = _payment_id
   RETURNING * INTO _payment;

  RETURN _payment;
END;
$$;

REVOKE ALL ON FUNCTION public.request_offline_payment(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_offline_payment(uuid) TO authenticated;
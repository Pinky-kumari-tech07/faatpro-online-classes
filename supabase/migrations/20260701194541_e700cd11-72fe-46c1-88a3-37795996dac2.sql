DROP POLICY IF EXISTS payments_student_update_pending ON public.payments;

CREATE POLICY payments_student_update_pending ON public.payments
  FOR UPDATE TO authenticated
  USING (
    student_id = auth.uid()
    AND status = 'pending'::public.payment_status
  )
  WITH CHECK (
    student_id = auth.uid()
    AND status = 'pending'::public.payment_status
  );
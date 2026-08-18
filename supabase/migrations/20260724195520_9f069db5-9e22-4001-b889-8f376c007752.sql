
-- Cleanup: mark the older duplicate audit payment as refunded so the unique index can be built
UPDATE public.payments
   SET status = 'refunded'::public.payment_status,
       updated_at = now()
 WHERE id = '687424ff-9396-43f2-94b0-1a204dbf8592'
   AND status = 'succeeded';

-- Prevent duplicate succeeded course payments per (workspace, student, course)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_succeeded_course_payment
  ON public.payments (workspace_id, student_id, course_id)
  WHERE status = 'succeeded' AND course_id IS NOT NULL;

-- Prevent duplicate succeeded bundle payments per (workspace, student, bundle)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_succeeded_bundle_payment
  ON public.payments (workspace_id, student_id, bundle_id)
  WHERE status = 'succeeded' AND bundle_id IS NOT NULL;

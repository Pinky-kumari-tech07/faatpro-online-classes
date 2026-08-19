UPDATE public.invoices i SET payment_id = NULL
WHERE i.payment_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.payments p WHERE p.id = i.payment_id);

ALTER TABLE public.payments
  ADD CONSTRAINT payments_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE SET NULL,
  ADD CONSTRAINT payments_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD CONSTRAINT payments_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.payments(id) ON DELETE SET NULL;

NOTIFY pgrst, 'reload schema';
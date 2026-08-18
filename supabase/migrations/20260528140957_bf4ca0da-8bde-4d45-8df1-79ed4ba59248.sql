
-- Enrollments: let any authenticated student enroll themselves
DROP POLICY IF EXISTS enroll_student_insert ON public.enrollments;
CREATE POLICY enroll_student_insert ON public.enrollments
  FOR INSERT TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    OR has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role, 'staff'::app_role, 'super_admin'::app_role])
  );

-- Payments: let students create their own payment rows
DROP POLICY IF EXISTS payments_student_insert ON public.payments;
CREATE POLICY payments_student_insert ON public.payments
  FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid());

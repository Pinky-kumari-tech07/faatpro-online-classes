-- Remove remaining Staff direct-write bypasses in course lifecycle tables

DROP POLICY IF EXISTS course_audit_admin_insert ON public.course_audit_log;
CREATE POLICY course_audit_admin_insert
ON public.course_audit_log
FOR INSERT
TO authenticated
WITH CHECK (
  is_admin_anywhere(auth.uid())
);

DROP POLICY IF EXISTS cdr_instructor_request ON public.course_deletion_requests;
CREATE POLICY cdr_instructor_request
ON public.course_deletion_requests
FOR INSERT
TO authenticated
WITH CHECK (
  requested_by = auth.uid()
  AND is_course_instructor(auth.uid(), course_id)
);
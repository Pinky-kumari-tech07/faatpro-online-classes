
CREATE OR REPLACE FUNCTION public.instructor_delete_draft_course(_course_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _ws uuid;
  _status public.course_status;
  _owner uuid;
  _is_admin boolean;
  _is_owner boolean;
  _enroll_count int;
  _pay_count int;
  _cert_count int;
  _inv_count int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT workspace_id, status, instructor_id
    INTO _ws, _status, _owner
  FROM public.courses
  WHERE id = _course_id;
  IF _ws IS NULL THEN RAISE EXCEPTION 'Course not found'; END IF;

  _is_admin := public.is_admin_anywhere(auth.uid());
  _is_owner := (_owner = auth.uid()) OR EXISTS (
    SELECT 1 FROM public.course_instructors ci
    WHERE ci.course_id = _course_id AND ci.instructor_id = auth.uid()
  );

  IF NOT (_is_admin OR _is_owner) THEN
    RAISE EXCEPTION 'You are not allowed to delete this course';
  END IF;

  IF _status <> 'draft' THEN
    RAISE EXCEPTION 'Only draft courses can be deleted directly. Please submit a deletion request for admin approval.';
  END IF;

  SELECT count(*) INTO _enroll_count FROM public.enrollments WHERE course_id = _course_id;
  SELECT count(*) INTO _pay_count FROM public.payments WHERE course_id = _course_id;
  SELECT count(*) INTO _cert_count FROM public.certificates WHERE course_id = _course_id;
  SELECT count(*) INTO _inv_count FROM public.invoices WHERE course_id = _course_id;

  IF _enroll_count > 0 OR _pay_count > 0 OR _cert_count > 0 OR _inv_count > 0 THEN
    RAISE EXCEPTION 'This course has historical records (enrollments/payments/certificates/invoices). Submit a deletion request for admin review.';
  END IF;

  INSERT INTO public.course_audit_log (workspace_id, course_id, actor_id, action, details)
  VALUES (_ws, _course_id, auth.uid(), 'permanent_delete',
          jsonb_build_object('previous_status', _status::text, 'origin', 'instructor_draft_delete'));

  DELETE FROM public.courses WHERE id = _course_id;
  RETURN jsonb_build_object('deleted', true, 'archived', false);
END $function$;

REVOKE EXECUTE ON FUNCTION public.instructor_delete_draft_course(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.instructor_delete_draft_course(uuid) TO authenticated;

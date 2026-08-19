
-- Instructor delete restrictions on content tables
DROP POLICY IF EXISTS lessons_instructor_manage ON public.lessons;
CREATE POLICY lessons_instructor_select ON public.lessons FOR SELECT
  USING (public.is_course_instructor(auth.uid(), course_id));
CREATE POLICY lessons_instructor_insert ON public.lessons FOR INSERT
  WITH CHECK (public.is_course_instructor(auth.uid(), course_id));
CREATE POLICY lessons_instructor_update ON public.lessons FOR UPDATE
  USING (public.is_course_instructor(auth.uid(), course_id))
  WITH CHECK (public.is_course_instructor(auth.uid(), course_id));

DROP POLICY IF EXISTS quizzes_instructor_manage ON public.quizzes;
CREATE POLICY quizzes_instructor_select ON public.quizzes FOR SELECT
  USING (public.is_course_instructor(auth.uid(), course_id));
CREATE POLICY quizzes_instructor_insert ON public.quizzes FOR INSERT
  WITH CHECK (public.is_course_instructor(auth.uid(), course_id));
CREATE POLICY quizzes_instructor_update ON public.quizzes FOR UPDATE
  USING (public.is_course_instructor(auth.uid(), course_id))
  WITH CHECK (public.is_course_instructor(auth.uid(), course_id));

DROP POLICY IF EXISTS assignments_instructor_manage ON public.assignments;
CREATE POLICY assignments_instructor_select ON public.assignments FOR SELECT
  USING (public.is_course_instructor(auth.uid(), course_id));
CREATE POLICY assignments_instructor_insert ON public.assignments FOR INSERT
  WITH CHECK (public.is_course_instructor(auth.uid(), course_id));
CREATE POLICY assignments_instructor_update ON public.assignments FOR UPDATE
  USING (public.is_course_instructor(auth.uid(), course_id))
  WITH CHECK (public.is_course_instructor(auth.uid(), course_id));

DROP POLICY IF EXISTS lesson_assets_manage ON public.lesson_assets;
CREATE POLICY lesson_assets_admin_manage ON public.lesson_assets FOR ALL
  USING (public.has_any_workspace_role(auth.uid(), workspace_id,
         ARRAY['organization_admin','staff','super_admin']::app_role[]))
  WITH CHECK (public.has_any_workspace_role(auth.uid(), workspace_id,
         ARRAY['organization_admin','staff','super_admin']::app_role[]));
CREATE POLICY lesson_assets_instructor_select ON public.lesson_assets FOR SELECT
  USING (public.has_workspace_role(auth.uid(), workspace_id, 'instructor'::app_role));
CREATE POLICY lesson_assets_instructor_insert ON public.lesson_assets FOR INSERT
  WITH CHECK (public.has_workspace_role(auth.uid(), workspace_id, 'instructor'::app_role));
CREATE POLICY lesson_assets_instructor_update ON public.lesson_assets FOR UPDATE
  USING (public.has_workspace_role(auth.uid(), workspace_id, 'instructor'::app_role))
  WITH CHECK (public.has_workspace_role(auth.uid(), workspace_id, 'instructor'::app_role));

-- Safe delete with auto-archive fallback
DROP FUNCTION IF EXISTS public.admin_permanent_delete_course(uuid, uuid);
CREATE OR REPLACE FUNCTION public.admin_permanent_delete_course(_course_id uuid, _request_id uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _ws uuid; _status public.course_status;
  _enroll_count int; _pay_count int; _cert_count int; _inv_count int;
BEGIN
  IF NOT public.is_admin_or_staff_anywhere(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT workspace_id, status INTO _ws, _status FROM public.courses WHERE id = _course_id;
  IF _ws IS NULL THEN RAISE EXCEPTION 'Course not found'; END IF;
  IF _status <> 'archived' THEN
    RAISE EXCEPTION 'Course must be archived before permanent deletion';
  END IF;

  SELECT count(*) INTO _enroll_count FROM public.enrollments WHERE course_id = _course_id;
  SELECT count(*) INTO _pay_count FROM public.payments WHERE course_id = _course_id;
  SELECT count(*) INTO _cert_count FROM public.certificates WHERE course_id = _course_id;
  SELECT count(*) INTO _inv_count FROM public.invoices WHERE course_id = _course_id;

  IF _enroll_count > 0 OR _pay_count > 0 OR _cert_count > 0 OR _inv_count > 0 THEN
    INSERT INTO public.course_audit_log (workspace_id, course_id, actor_id, action, details)
    VALUES (_ws, _course_id, auth.uid(), 'permanent_delete_blocked',
      jsonb_build_object(
        'request_id', _request_id,
        'reason', 'historical_records_exist',
        'enrollments', _enroll_count,
        'payments', _pay_count,
        'certificates', _cert_count,
        'invoices', _inv_count));

    IF _request_id IS NOT NULL THEN
      UPDATE public.course_deletion_requests
        SET status = 'archived',
            executed_at = now(),
            execution_type = 'auto_archived',
            review_notes = COALESCE(review_notes,'') || ' [Auto-archived: historical records exist]'
        WHERE id = _request_id;
    END IF;

    RETURN jsonb_build_object(
      'deleted', false,
      'archived', true,
      'message', 'Course contains historical records and has been archived instead of permanently deleted.',
      'enrollments', _enroll_count,
      'payments', _pay_count,
      'certificates', _cert_count,
      'invoices', _inv_count
    );
  END IF;

  INSERT INTO public.course_audit_log (workspace_id, course_id, actor_id, action, details)
  VALUES (_ws, _course_id, auth.uid(), 'permanent_delete',
          jsonb_build_object('request_id', _request_id, 'previous_status', _status::text));

  IF _request_id IS NOT NULL THEN
    UPDATE public.course_deletion_requests
      SET status = 'deleted', executed_at = now(), execution_type = 'permanent'
      WHERE id = _request_id;
  END IF;

  DELETE FROM public.courses WHERE id = _course_id;
  RETURN jsonb_build_object('deleted', true, 'archived', false);
END $function$;

GRANT EXECUTE ON FUNCTION public.admin_permanent_delete_course(uuid, uuid) TO authenticated;

-- Course deletion summary helper
CREATE OR REPLACE FUNCTION public.course_deletion_summary(_course_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _ws uuid;
  _enroll int; _pay int; _cert int; _inv int;
  _revenue numeric;
BEGIN
  SELECT workspace_id INTO _ws FROM public.courses WHERE id = _course_id;
  IF _ws IS NULL THEN RETURN NULL; END IF;
  IF NOT public.is_admin_or_staff_anywhere(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT count(*) INTO _enroll FROM public.enrollments WHERE course_id = _course_id;
  SELECT count(*) INTO _pay FROM public.payments WHERE course_id = _course_id AND status = 'succeeded';
  SELECT count(*) INTO _cert FROM public.certificates WHERE course_id = _course_id;
  SELECT count(*) INTO _inv FROM public.invoices WHERE course_id = _course_id;
  SELECT COALESCE(sum(amount),0) INTO _revenue FROM public.payments
    WHERE course_id = _course_id AND status = 'succeeded';
  RETURN jsonb_build_object(
    'enrollments', _enroll,
    'payments', _pay,
    'certificates', _cert,
    'invoices', _inv,
    'revenue', _revenue,
    'can_hard_delete', (_enroll = 0 AND _pay = 0 AND _cert = 0 AND _inv = 0)
  );
END $function$;

GRANT EXECUTE ON FUNCTION public.course_deletion_summary(uuid) TO authenticated;

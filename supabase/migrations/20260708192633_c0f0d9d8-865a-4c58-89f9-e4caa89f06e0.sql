
-- 1. Drop instructor-inclusive ALL policies and re-create as INSERT/UPDATE only
-- certificates
DROP POLICY IF EXISTS certificates_manage ON public.certificates;
CREATE POLICY certificates_staff_manage ON public.certificates FOR ALL TO authenticated
  USING (public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin','staff','super_admin']::app_role[]))
  WITH CHECK (public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin','staff','super_admin']::app_role[]));
CREATE POLICY certificates_instructor_write ON public.certificates FOR INSERT TO authenticated
  WITH CHECK (public.has_workspace_role(auth.uid(), workspace_id, 'instructor'::app_role));
CREATE POLICY certificates_instructor_update ON public.certificates FOR UPDATE TO authenticated
  USING (public.has_workspace_role(auth.uid(), workspace_id, 'instructor'::app_role))
  WITH CHECK (public.has_workspace_role(auth.uid(), workspace_id, 'instructor'::app_role));

-- course_bundles
DROP POLICY IF EXISTS course_bundles_admin_write ON public.course_bundles;
CREATE POLICY course_bundles_staff_manage ON public.course_bundles FOR ALL TO authenticated
  USING (public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin','staff','super_admin']::app_role[]))
  WITH CHECK (public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin','staff','super_admin']::app_role[]));
CREATE POLICY course_bundles_instructor_insert ON public.course_bundles FOR INSERT TO authenticated
  WITH CHECK (public.has_workspace_role(auth.uid(), workspace_id, 'instructor'::app_role));
CREATE POLICY course_bundles_instructor_update ON public.course_bundles FOR UPDATE TO authenticated
  USING (public.has_workspace_role(auth.uid(), workspace_id, 'instructor'::app_role))
  WITH CHECK (public.has_workspace_role(auth.uid(), workspace_id, 'instructor'::app_role));

-- bundle_courses
DROP POLICY IF EXISTS bundle_courses_admin_write ON public.bundle_courses;
CREATE POLICY bundle_courses_staff_manage ON public.bundle_courses FOR ALL TO authenticated
  USING (public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin','staff','super_admin']::app_role[]))
  WITH CHECK (public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin','staff','super_admin']::app_role[]));
CREATE POLICY bundle_courses_instructor_insert ON public.bundle_courses FOR INSERT TO authenticated
  WITH CHECK (public.has_workspace_role(auth.uid(), workspace_id, 'instructor'::app_role));
CREATE POLICY bundle_courses_instructor_update ON public.bundle_courses FOR UPDATE TO authenticated
  USING (public.has_workspace_role(auth.uid(), workspace_id, 'instructor'::app_role))
  WITH CHECK (public.has_workspace_role(auth.uid(), workspace_id, 'instructor'::app_role));

-- live_classes: instructor should not DELETE
DROP POLICY IF EXISTS live_classes_instructor_manage ON public.live_classes;
CREATE POLICY live_classes_instructor_insert ON public.live_classes FOR INSERT TO authenticated
  WITH CHECK (public.is_course_instructor(auth.uid(), course_id));
CREATE POLICY live_classes_instructor_update ON public.live_classes FOR UPDATE TO authenticated
  USING (public.is_course_instructor(auth.uid(), course_id))
  WITH CHECK (public.is_course_instructor(auth.uid(), course_id));

-- quiz_questions
DROP POLICY IF EXISTS qq_manage ON public.quiz_questions;
CREATE POLICY qq_staff_manage ON public.quiz_questions FOR ALL TO authenticated
  USING (public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin','staff','super_admin']::app_role[]))
  WITH CHECK (public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin','staff','super_admin']::app_role[]));
CREATE POLICY qq_instructor_insert ON public.quiz_questions FOR INSERT TO authenticated
  WITH CHECK (
    public.has_workspace_role(auth.uid(), workspace_id, 'instructor'::app_role)
    OR EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = quiz_id AND public.is_course_instructor(auth.uid(), q.course_id))
  );
CREATE POLICY qq_instructor_update ON public.quiz_questions FOR UPDATE TO authenticated
  USING (
    public.has_workspace_role(auth.uid(), workspace_id, 'instructor'::app_role)
    OR EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = quiz_id AND public.is_course_instructor(auth.uid(), q.course_id))
  )
  WITH CHECK (
    public.has_workspace_role(auth.uid(), workspace_id, 'instructor'::app_role)
    OR EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = quiz_id AND public.is_course_instructor(auth.uid(), q.course_id))
  );

-- question_bank
DROP POLICY IF EXISTS qb_manage ON public.question_bank;
CREATE POLICY qb_staff_manage ON public.question_bank FOR ALL TO authenticated
  USING (public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin','staff','super_admin']::app_role[]))
  WITH CHECK (public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin','staff','super_admin']::app_role[]));
CREATE POLICY qb_instructor_insert ON public.question_bank FOR INSERT TO authenticated
  WITH CHECK (public.has_workspace_role(auth.uid(), workspace_id, 'instructor'::app_role));
CREATE POLICY qb_instructor_update ON public.question_bank FOR UPDATE TO authenticated
  USING (public.has_workspace_role(auth.uid(), workspace_id, 'instructor'::app_role))
  WITH CHECK (public.has_workspace_role(auth.uid(), workspace_id, 'instructor'::app_role));

-- question_categories
DROP POLICY IF EXISTS qc_manage ON public.question_categories;
CREATE POLICY qc_staff_manage ON public.question_categories FOR ALL TO authenticated
  USING (public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin','staff','super_admin']::app_role[]))
  WITH CHECK (public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin','staff','super_admin']::app_role[]));
CREATE POLICY qc_instructor_insert ON public.question_categories FOR INSERT TO authenticated
  WITH CHECK (public.has_workspace_role(auth.uid(), workspace_id, 'instructor'::app_role));
CREATE POLICY qc_instructor_update ON public.question_categories FOR UPDATE TO authenticated
  USING (public.has_workspace_role(auth.uid(), workspace_id, 'instructor'::app_role))
  WITH CHECK (public.has_workspace_role(auth.uid(), workspace_id, 'instructor'::app_role));

-- attendance_records: remove instructor ALL, keep session-scoped write for INSERT/UPDATE only
DROP POLICY IF EXISTS att_records_manage ON public.attendance_records;
DROP POLICY IF EXISTS att_rec_write ON public.attendance_records;
CREATE POLICY att_records_staff_manage ON public.attendance_records FOR ALL TO authenticated
  USING (public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin','staff','super_admin']::app_role[]))
  WITH CHECK (public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin','staff','super_admin']::app_role[]));
CREATE POLICY att_records_instructor_insert ON public.attendance_records FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.attendance_sessions s
    WHERE s.id = attendance_records.session_id
      AND (s.instructor_id = auth.uid() OR s.created_by = auth.uid() OR public.is_course_instructor(auth.uid(), s.course_id))
      AND NOT public.attendance_session_is_locked(s.id)
  ));
CREATE POLICY att_records_instructor_update ON public.attendance_records FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.attendance_sessions s
    WHERE s.id = attendance_records.session_id
      AND (s.instructor_id = auth.uid() OR s.created_by = auth.uid() OR public.is_course_instructor(auth.uid(), s.course_id))
      AND NOT public.attendance_session_is_locked(s.id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.attendance_sessions s
    WHERE s.id = attendance_records.session_id
      AND (s.instructor_id = auth.uid() OR s.created_by = auth.uid() OR public.is_course_instructor(auth.uid(), s.course_id))
      AND NOT public.attendance_session_is_locked(s.id)
  ));

-- attendance_sessions
DROP POLICY IF EXISTS att_sessions_manage ON public.attendance_sessions;
DROP POLICY IF EXISTS att_sess_write ON public.attendance_sessions;
CREATE POLICY att_sessions_staff_manage ON public.attendance_sessions FOR ALL TO authenticated
  USING (public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin','staff','super_admin']::app_role[]))
  WITH CHECK (public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin','staff','super_admin']::app_role[]));
CREATE POLICY att_sessions_instructor_insert ON public.attendance_sessions FOR INSERT TO authenticated
  WITH CHECK (instructor_id = auth.uid() OR created_by = auth.uid() OR public.is_course_instructor(auth.uid(), course_id));
CREATE POLICY att_sessions_instructor_update ON public.attendance_sessions FOR UPDATE TO authenticated
  USING (instructor_id = auth.uid() OR created_by = auth.uid() OR public.is_course_instructor(auth.uid(), course_id))
  WITH CHECK (instructor_id = auth.uid() OR created_by = auth.uid() OR public.is_course_instructor(auth.uid(), course_id));

-- 2. Audit log: add IP/UA columns; make immutable
ALTER TABLE public.course_audit_log
  ADD COLUMN IF NOT EXISTS ip_address text,
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS previous_status text,
  ADD COLUMN IF NOT EXISTS new_status text;

-- Block UPDATE/DELETE on audit log for everyone (immutable)
DROP POLICY IF EXISTS course_audit_log_no_update ON public.course_audit_log;
DROP POLICY IF EXISTS course_audit_log_no_delete ON public.course_audit_log;
CREATE POLICY course_audit_log_no_update ON public.course_audit_log FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY course_audit_log_no_delete ON public.course_audit_log FOR DELETE TO authenticated USING (false);
REVOKE UPDATE, DELETE ON public.course_audit_log FROM authenticated, anon;

-- 3. Expand course_deletion_summary
CREATE OR REPLACE FUNCTION public.course_deletion_summary(_course_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _ws uuid;
  _enroll int; _pay int; _cert int; _inv int;
  _revenue numeric;
  _lessons int; _videos int; _assets int; _quizzes int; _live int;
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
  SELECT COALESCE(sum(amount),0) INTO _revenue FROM public.payments WHERE course_id = _course_id AND status = 'succeeded';
  SELECT count(*) INTO _lessons FROM public.lessons WHERE course_id = _course_id;
  SELECT count(*) INTO _videos FROM public.lessons WHERE course_id = _course_id AND video_url IS NOT NULL AND video_url <> '';
  SELECT count(*) INTO _assets FROM public.lesson_assets la JOIN public.lessons l ON l.id = la.lesson_id WHERE l.course_id = _course_id;
  SELECT count(*) INTO _quizzes FROM public.quizzes WHERE course_id = _course_id;
  SELECT count(*) INTO _live FROM public.live_classes WHERE course_id = _course_id;
  RETURN jsonb_build_object(
    'enrollments', _enroll, 'payments', _pay, 'certificates', _cert, 'invoices', _inv, 'revenue', _revenue,
    'lessons', _lessons, 'videos', _videos, 'assets', _assets, 'quizzes', _quizzes, 'live_classes', _live,
    'can_hard_delete', (_enroll = 0 AND _pay = 0 AND _cert = 0 AND _inv = 0)
  );
END $function$;

-- 4. Update permanent delete RPC to record IP/UA and status transitions
CREATE OR REPLACE FUNCTION public.admin_permanent_delete_course(
  _course_id uuid, _request_id uuid DEFAULT NULL::uuid,
  _ip text DEFAULT NULL, _user_agent text DEFAULT NULL, _remarks text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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
    INSERT INTO public.course_audit_log (workspace_id, course_id, actor_id, action, details, ip_address, user_agent, previous_status, new_status)
    VALUES (_ws, _course_id, auth.uid(), 'permanent_delete_blocked',
      jsonb_build_object('request_id', _request_id, 'reason','historical_records_exist',
        'enrollments', _enroll_count, 'payments', _pay_count, 'certificates', _cert_count, 'invoices', _inv_count,
        'remarks', _remarks),
      _ip, _user_agent, _status::text, 'archived');
    IF _request_id IS NOT NULL THEN
      UPDATE public.course_deletion_requests
        SET status='archived', executed_at=now(), execution_type='auto_archived',
            review_notes = COALESCE(review_notes,'') || ' [Auto-archived: historical records exist]'
        WHERE id = _request_id;
    END IF;
    RETURN jsonb_build_object('deleted', false, 'archived', true,
      'message', 'Course contains historical records and has been archived instead of permanently deleted.',
      'enrollments', _enroll_count, 'payments', _pay_count, 'certificates', _cert_count, 'invoices', _inv_count);
  END IF;

  INSERT INTO public.course_audit_log (workspace_id, course_id, actor_id, action, details, ip_address, user_agent, previous_status, new_status)
  VALUES (_ws, _course_id, auth.uid(), 'permanent_delete',
    jsonb_build_object('request_id', _request_id, 'remarks', _remarks),
    _ip, _user_agent, _status::text, 'deleted');

  IF _request_id IS NOT NULL THEN
    UPDATE public.course_deletion_requests
      SET status='deleted', executed_at=now(), execution_type='permanent'
      WHERE id = _request_id;
  END IF;

  DELETE FROM public.courses WHERE id = _course_id;
  RETURN jsonb_build_object('deleted', true, 'archived', false);
END $function$;

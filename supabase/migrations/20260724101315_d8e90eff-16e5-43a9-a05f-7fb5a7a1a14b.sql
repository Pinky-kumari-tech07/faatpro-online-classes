-- =====================================================================
-- STAFF RBAC LOCKDOWN
-- Staff is an operational role only. Academic content management
-- (courses / sections / lessons / assets / quizzes / questions /
-- assignments / bundles) becomes admin-only. Staff retains read access
-- and continues to manage batches, enrollments, certificates,
-- payments, invoices, live classes, communications and support.
-- =====================================================================

-- ---------- courses ---------------------------------------------------
DROP POLICY IF EXISTS courses_insert ON public.courses;
CREATE POLICY courses_insert ON public.courses
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin_anywhere(auth.uid())
    OR ((instructor_id = auth.uid()) AND public.is_workspace_member(auth.uid(), workspace_id))
  );

DROP POLICY IF EXISTS courses_update ON public.courses;
CREATE POLICY courses_update ON public.courses
  FOR UPDATE TO authenticated
  USING (
    public.is_admin_anywhere(auth.uid())
    OR (instructor_id = auth.uid())
    OR public.is_course_instructor(auth.uid(), id)
  )
  WITH CHECK (
    public.is_admin_anywhere(auth.uid())
    OR (instructor_id = auth.uid())
    OR public.is_course_instructor(auth.uid(), id)
  );

-- ---------- course_sections ------------------------------------------
DROP POLICY IF EXISTS sections_manage ON public.course_sections;
CREATE POLICY sections_manage ON public.course_sections
  FOR ALL TO authenticated
  USING (
    public.is_admin_anywhere(auth.uid())
    OR public.is_course_instructor(auth.uid(), course_id)
  )
  WITH CHECK (
    public.is_admin_anywhere(auth.uid())
    OR public.is_course_instructor(auth.uid(), course_id)
  );

-- ---------- lessons --------------------------------------------------
DROP POLICY IF EXISTS lessons_admin_staff_manage ON public.lessons;
CREATE POLICY lessons_admin_manage ON public.lessons
  FOR ALL TO authenticated
  USING (public.is_admin_anywhere(auth.uid()))
  WITH CHECK (public.is_admin_anywhere(auth.uid()));

-- ---------- lesson_assets --------------------------------------------
DROP POLICY IF EXISTS lesson_assets_admin_manage ON public.lesson_assets;
CREATE POLICY lesson_assets_admin_manage ON public.lesson_assets
  FOR ALL TO authenticated
  USING (public.has_any_workspace_role(auth.uid(), workspace_id,
         ARRAY['organization_admin','super_admin']::app_role[]))
  WITH CHECK (public.has_any_workspace_role(auth.uid(), workspace_id,
         ARRAY['organization_admin','super_admin']::app_role[]));

-- ---------- quizzes --------------------------------------------------
DROP POLICY IF EXISTS quizzes_admin_staff_manage ON public.quizzes;
CREATE POLICY quizzes_admin_manage ON public.quizzes
  FOR ALL TO authenticated
  USING (public.is_admin_anywhere(auth.uid()))
  WITH CHECK (public.is_admin_anywhere(auth.uid()));

-- ---------- quiz_questions -------------------------------------------
DROP POLICY IF EXISTS qq_staff_manage ON public.quiz_questions;
CREATE POLICY qq_admin_manage ON public.quiz_questions
  FOR ALL TO authenticated
  USING (public.has_any_workspace_role(auth.uid(), workspace_id,
         ARRAY['organization_admin','super_admin']::app_role[]))
  WITH CHECK (public.has_any_workspace_role(auth.uid(), workspace_id,
         ARRAY['organization_admin','super_admin']::app_role[]));

-- ---------- assignments ----------------------------------------------
DROP POLICY IF EXISTS assignments_admin_staff_manage ON public.assignments;
CREATE POLICY assignments_admin_manage ON public.assignments
  FOR ALL TO authenticated
  USING (public.is_admin_anywhere(auth.uid()))
  WITH CHECK (public.is_admin_anywhere(auth.uid()));

-- ---------- course_bundles / bundle_courses --------------------------
DROP POLICY IF EXISTS course_bundles_staff_manage ON public.course_bundles;
CREATE POLICY course_bundles_admin_manage ON public.course_bundles
  FOR ALL TO authenticated
  USING (public.has_any_workspace_role(auth.uid(), workspace_id,
         ARRAY['organization_admin','super_admin']::app_role[]))
  WITH CHECK (public.has_any_workspace_role(auth.uid(), workspace_id,
         ARRAY['organization_admin','super_admin']::app_role[]));

DROP POLICY IF EXISTS bundle_courses_staff_manage ON public.bundle_courses;
CREATE POLICY bundle_courses_admin_manage ON public.bundle_courses
  FOR ALL TO authenticated
  USING (public.has_any_workspace_role(auth.uid(), workspace_id,
         ARRAY['organization_admin','super_admin']::app_role[]))
  WITH CHECK (public.has_any_workspace_role(auth.uid(), workspace_id,
         ARRAY['organization_admin','super_admin']::app_role[]));

-- =====================================================================
-- RPC LOCKDOWN — course lifecycle now requires admin (never staff)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.admin_archive_course(_course_id uuid, _request_id uuid DEFAULT NULL::uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _ws uuid;
BEGIN
  IF NOT public.is_admin_anywhere(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT workspace_id INTO _ws FROM public.courses WHERE id = _course_id;
  IF _ws IS NULL THEN RAISE EXCEPTION 'Course not found'; END IF;
  UPDATE public.courses SET status = 'archived', updated_at = now() WHERE id = _course_id;
  IF _request_id IS NOT NULL THEN
    UPDATE public.course_deletion_requests
      SET status = 'archived', executed_at = now(), execution_type = 'archive'
      WHERE id = _request_id;
  END IF;
  INSERT INTO public.course_audit_log (workspace_id, course_id, actor_id, action, details)
  VALUES (_ws, _course_id, auth.uid(), 'archived', jsonb_build_object('request_id', _request_id));
END $function$;

CREATE OR REPLACE FUNCTION public.admin_suspend_course(_course_id uuid, _reason text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _ws uuid;
BEGIN
  IF NOT public.is_admin_anywhere(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT workspace_id INTO _ws FROM public.courses WHERE id = _course_id;
  IF _ws IS NULL THEN RAISE EXCEPTION 'Course not found'; END IF;
  UPDATE public.courses SET status = 'suspended', updated_at = now() WHERE id = _course_id;
  INSERT INTO public.course_audit_log (workspace_id, course_id, actor_id, action, details)
  VALUES (_ws, _course_id, auth.uid(), 'suspended', jsonb_build_object('reason', _reason));
END $function$;

CREATE OR REPLACE FUNCTION public.admin_restore_course(_course_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _ws uuid;
BEGIN
  IF NOT public.is_admin_anywhere(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT workspace_id INTO _ws FROM public.courses WHERE id = _course_id;
  IF _ws IS NULL THEN RAISE EXCEPTION 'Course not found'; END IF;
  UPDATE public.courses SET status = 'draft', updated_at = now() WHERE id = _course_id;
  INSERT INTO public.course_audit_log (workspace_id, course_id, actor_id, action, details)
  VALUES (_ws, _course_id, auth.uid(), 'restored', '{}'::jsonb);
END $function$;

CREATE OR REPLACE FUNCTION public.review_course_deletion(_request_id uuid, _approve boolean, _notes text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _r public.course_deletion_requests;
BEGIN
  IF NOT public.is_admin_anywhere(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT * INTO _r FROM public.course_deletion_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF _r.status <> 'pending' THEN RAISE EXCEPTION 'Request already processed'; END IF;
  UPDATE public.course_deletion_requests
    SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
        reviewed_by = auth.uid(), reviewed_at = now(), review_notes = _notes
    WHERE id = _request_id;
  INSERT INTO public.course_audit_log (workspace_id, course_id, actor_id, action, details)
  VALUES (_r.workspace_id, _r.course_id, auth.uid(),
          CASE WHEN _approve THEN 'deletion_approved' ELSE 'deletion_rejected' END,
          jsonb_build_object('request_id', _request_id, 'notes', _notes));
END $function$;

CREATE OR REPLACE FUNCTION public.admin_permanent_delete_course(_course_id uuid, _request_id uuid DEFAULT NULL::uuid, _ip text DEFAULT NULL::text, _user_agent text DEFAULT NULL::text, _remarks text DEFAULT NULL::text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _ws uuid; _status public.course_status;
  _enroll_count int; _pay_count int; _cert_count int; _inv_count int;
BEGIN
  IF NOT public.is_admin_anywhere(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
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
        'enrollments', _enroll_count, 'payments', _pay_count, 'certificates', _cert_count, 'invoices', _inv_count, 'remarks', _remarks),
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

REVOKE EXECUTE ON FUNCTION public.admin_pay_settlement(uuid, numeric, text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_update_settlement_status(uuid, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_verify_instructor_bank(uuid, boolean, text) FROM PUBLIC;

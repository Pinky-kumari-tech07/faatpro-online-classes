-- Final Staff RBAC lockdown for course lifecycle and direct API bypasses

-- 1) Course lifecycle request tables: staff can read only through existing read policies, but cannot manage records.
DROP POLICY IF EXISTS cdr_admin_manage ON public.course_deletion_requests;
CREATE POLICY cdr_admin_manage
ON public.course_deletion_requests
FOR ALL
TO authenticated
USING (
  has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role, 'super_admin'::app_role])
)
WITH CHECK (
  has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role, 'super_admin'::app_role])
);

DROP POLICY IF EXISTS cal_staff_read ON public.course_audit_log;
DROP POLICY IF EXISTS cal_admin_manage ON public.course_audit_log;
CREATE POLICY cal_admin_read
ON public.course_audit_log
FOR SELECT
TO authenticated
USING (
  has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role, 'super_admin'::app_role])
);

CREATE POLICY cal_admin_manage
ON public.course_audit_log
FOR ALL
TO authenticated
USING (
  has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role, 'super_admin'::app_role])
)
WITH CHECK (
  has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role, 'super_admin'::app_role])
);

-- 2) Permanent delete RPC: admins only.
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

-- 3) Reassignment RPC overloads: admins only.
CREATE OR REPLACE FUNCTION public.admin_reassign_course_instructor(_course_id uuid, _new_instructor_id uuid, _notes text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _ws uuid; _old uuid; _is_instr boolean;
BEGIN
  IF NOT public.is_admin_anywhere(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT workspace_id, instructor_id INTO _ws, _old FROM public.courses WHERE id = _course_id;
  IF _ws IS NULL THEN RAISE EXCEPTION 'Course not found'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE profile_id = _new_instructor_id AND role = 'instructor'::app_role AND status = 'active'
  ) INTO _is_instr;
  IF NOT _is_instr THEN RAISE EXCEPTION 'Target user is not an active instructor'; END IF;

  UPDATE public.courses SET instructor_id = _new_instructor_id, updated_at = now() WHERE id = _course_id;

  INSERT INTO public.course_audit_log (workspace_id, course_id, actor_id, action, details)
  VALUES (_ws, _course_id, auth.uid(), 'instructor_reassigned',
          jsonb_build_object('from', _old, 'to', _new_instructor_id, 'notes', _notes));
END $function$;

CREATE OR REPLACE FUNCTION public.admin_reassign_course_instructor(
  _course_id uuid,
  _new_instructor_id uuid,
  _reason text DEFAULT NULL::text,
  _effective_date timestamp with time zone DEFAULT NULL::timestamp with time zone,
  _notify boolean DEFAULT true,
  _transfer_live_classes boolean DEFAULT false,
  _ip text DEFAULT NULL::text,
  _user_agent text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _ws uuid; _old uuid; _title text;
  _is_active_instr boolean; _live_moved int := 0;
  _student_count int := 0; _revenue numeric := 0;
BEGIN
  IF NOT public.is_admin_anywhere(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT workspace_id, instructor_id, title INTO _ws, _old, _title FROM public.courses WHERE id = _course_id;
  IF _ws IS NULL THEN RAISE EXCEPTION 'Course not found'; END IF;
  IF _old = _new_instructor_id THEN RAISE EXCEPTION 'Course already belongs to this instructor'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members wm
    JOIN public.profiles p ON p.id = wm.profile_id
    WHERE wm.profile_id = _new_instructor_id
      AND wm.workspace_id = _ws
      AND wm.role = 'instructor'::app_role
      AND wm.status = 'active'
      AND COALESCE(p.is_active, true) = true
  ) INTO _is_active_instr;
  IF NOT _is_active_instr THEN RAISE EXCEPTION 'Target user is not an active instructor in this workspace'; END IF;

  SELECT count(*) INTO _student_count FROM public.enrollments WHERE course_id = _course_id AND status = 'active';
  SELECT COALESCE(sum(amount),0) INTO _revenue FROM public.payments WHERE course_id = _course_id AND status = 'succeeded';

  UPDATE public.courses SET instructor_id = _new_instructor_id, updated_at = now() WHERE id = _course_id;
  UPDATE public.course_instructors SET instructor_id = _new_instructor_id WHERE course_id = _course_id AND is_primary = true;
  IF NOT FOUND THEN
    INSERT INTO public.course_instructors (workspace_id, course_id, instructor_id, is_primary)
    VALUES (_ws, _course_id, _new_instructor_id, true);
  END IF;

  IF _transfer_live_classes THEN
    UPDATE public.live_classes SET instructor_id = _new_instructor_id WHERE course_id = _course_id AND status IN ('scheduled','live');
    GET DIAGNOSTICS _live_moved = ROW_COUNT;
  END IF;

  INSERT INTO public.course_audit_log (workspace_id, course_id, actor_id, action, details, ip_address, user_agent)
  VALUES (_ws, _course_id, auth.uid(), 'instructor_reassigned', jsonb_build_object(
    'course_title', _title,
    'from', _old,
    'to', _new_instructor_id,
    'reason', _reason,
    'effective_date', COALESCE(_effective_date, now()),
    'notify', _notify,
    'transfer_live_classes', _transfer_live_classes,
    'live_classes_moved', _live_moved,
    'active_students', _student_count,
    'historical_revenue', _revenue
  ), _ip, _user_agent);

  RETURN jsonb_build_object(
    'course_id', _course_id,
    'old_instructor_id', _old,
    'new_instructor_id', _new_instructor_id,
    'live_classes_moved', _live_moved,
    'active_students', _student_count,
    'historical_revenue', _revenue
  );
END $function$;

-- 4) Explicitly revoke broad direct execution from anonymous users for sensitive RPCs.
REVOKE EXECUTE ON FUNCTION public.admin_permanent_delete_course(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_reassign_course_instructor(uuid, uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_reassign_course_instructor(uuid, uuid, text, timestamp with time zone, boolean, boolean, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_bulk_reassign_courses(uuid[], uuid, text, boolean, boolean, text, text) FROM anon;
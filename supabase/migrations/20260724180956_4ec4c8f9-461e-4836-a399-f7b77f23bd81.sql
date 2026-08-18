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
  _eligible boolean; _live_moved int := 0;
  _student_count int := 0; _revenue numeric := 0;
BEGIN
  IF NOT public.is_admin_anywhere(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT workspace_id, instructor_id, title INTO _ws, _old, _title FROM public.courses WHERE id = _course_id;
  IF _ws IS NULL THEN RAISE EXCEPTION 'Course not found'; END IF;
  IF _old = _new_instructor_id THEN RAISE EXCEPTION 'Course already belongs to this instructor'; END IF;

  -- Global instructor eligibility (matches list_assignable_instructors):
  -- must have instructor role anywhere, approved verification, active profile.
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.instructor_profiles ip ON ip.user_id = p.id
    WHERE p.id = _new_instructor_id
      AND COALESCE(p.is_active, true) = true
      AND ip.verification_status = 'approved'
      AND (
        EXISTS (SELECT 1 FROM public.workspace_members wm
                WHERE wm.profile_id = p.id AND wm.role = 'instructor'::app_role)
        OR EXISTS (SELECT 1 FROM public.rbac_user_roles rur
                   JOIN public.rbac_roles rr ON rr.id = rur.role_id
                   WHERE rur.user_id = p.id AND rr.slug = 'instructor')
      )
  ) INTO _eligible;
  IF NOT _eligible THEN
    RAISE EXCEPTION 'Target user is not an approved active instructor';
  END IF;

  -- Ensure the instructor is a member of THIS workspace so downstream RLS works.
  INSERT INTO public.workspace_members (workspace_id, profile_id, role, status)
  VALUES (_ws, _new_instructor_id, 'instructor'::app_role, 'active')
  ON CONFLICT (workspace_id, profile_id, role) DO UPDATE SET status = 'active';

  SELECT count(*) INTO _student_count FROM public.enrollments WHERE course_id = _course_id AND status = 'active';
  SELECT COALESCE(sum(amount),0) INTO _revenue FROM public.payments WHERE course_id = _course_id AND status = 'succeeded';

  UPDATE public.courses SET instructor_id = _new_instructor_id, updated_at = now() WHERE id = _course_id;

  INSERT INTO public.course_instructors (workspace_id, course_id, instructor_id)
  VALUES (_ws, _course_id, _new_instructor_id)
  ON CONFLICT (course_id, instructor_id) DO NOTHING;

  IF _old IS NOT NULL THEN
    DELETE FROM public.course_instructors WHERE course_id = _course_id AND instructor_id = _old;
  END IF;

  IF _transfer_live_classes THEN
    UPDATE public.live_classes SET instructor_id = _new_instructor_id WHERE course_id = _course_id AND status IN ('scheduled','live');
    GET DIAGNOSTICS _live_moved = ROW_COUNT;
  END IF;

  INSERT INTO public.course_audit_log (workspace_id, course_id, actor_id, action, details, ip_address, user_agent)
  VALUES (_ws, _course_id, auth.uid(),
    CASE WHEN _old IS NULL THEN 'instructor_assigned' ELSE 'instructor_reassigned' END,
    jsonb_build_object(
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
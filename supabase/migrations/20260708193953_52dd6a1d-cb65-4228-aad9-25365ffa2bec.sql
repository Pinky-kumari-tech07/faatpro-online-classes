
CREATE OR REPLACE FUNCTION public.admin_reactivate_instructor(
  _instructor_id uuid, _ip text DEFAULT NULL, _user_agent text DEFAULT NULL, _reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_admin_anywhere(auth.uid()) THEN
    RAISE EXCEPTION 'Only Organization Admin or Super Admin can reactivate instructors';
  END IF;
  UPDATE public.profiles SET is_active = true, updated_at = now() WHERE id = _instructor_id;
  UPDATE public.workspace_members SET status = 'active'::member_status
   WHERE profile_id = _instructor_id AND role = 'instructor'::app_role;
  INSERT INTO public.notifications (workspace_id, profile_id, channel, event_type, title, body)
  SELECT wm.workspace_id, _instructor_id, 'in_app', 'account_reactivated',
         'Account reactivated', COALESCE(_reason, 'Your instructor account has been reactivated.')
    FROM public.workspace_members wm
   WHERE wm.profile_id = _instructor_id AND wm.role = 'instructor'::app_role LIMIT 1;
  RETURN jsonb_build_object('instructor_id', _instructor_id, 'reactivated', true);
END $$;

CREATE OR REPLACE FUNCTION public.instructor_deactivation_summary(_instructor_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _prof record;
  _total int; _pub int; _draft int; _students int;
  _pending_earn numeric; _approved_earn numeric;
  _pending_payouts int; _upcoming_live int; _pending_reviews int;
  _blockers text[] := ARRAY[]::text[];
BEGIN
  IF NOT public.is_admin_anywhere(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT p.id, p.full_name, p.email, p.phone, ip.registration_mobile, ip.whatsapp_number
    INTO _prof FROM public.profiles p
    LEFT JOIN public.instructor_profiles ip ON ip.user_id = p.id WHERE p.id = _instructor_id;
  SELECT count(*) INTO _total FROM public.courses WHERE instructor_id = _instructor_id AND deleted_at IS NULL;
  SELECT count(*) INTO _pub FROM public.courses WHERE instructor_id = _instructor_id AND status = 'published' AND deleted_at IS NULL;
  SELECT count(*) INTO _draft FROM public.courses WHERE instructor_id = _instructor_id AND status = 'draft' AND deleted_at IS NULL;
  SELECT count(DISTINCT e.student_id) INTO _students FROM public.enrollments e JOIN public.courses c ON c.id = e.course_id
   WHERE c.instructor_id = _instructor_id AND e.status = 'active'::enrollment_status;
  SELECT COALESCE(sum(net_earning),0) INTO _pending_earn FROM public.instructor_earnings
   WHERE instructor_id = _instructor_id AND settlement_status IN ('pending','processing');
  SELECT COALESCE(sum(net_earning),0) INTO _approved_earn FROM public.instructor_earnings
   WHERE instructor_id = _instructor_id AND settlement_status = 'paid';
  SELECT count(*) INTO _pending_payouts FROM public.payout_requests
   WHERE instructor_id = _instructor_id AND status IN ('requested','approved');
  SELECT count(*) INTO _upcoming_live FROM public.live_classes
   WHERE instructor_id = _instructor_id AND starts_at BETWEEN now() AND now() + interval '24 hours'
     AND status IN ('scheduled','live');
  SELECT count(*) INTO _pending_reviews FROM public.assignment_submissions s
    JOIN public.assignments a ON a.id = s.assignment_id
    JOIN public.courses c ON c.id = a.course_id
   WHERE c.instructor_id = _instructor_id AND s.status = 'submitted';
  IF _upcoming_live > 0 THEN _blockers := _blockers || format('%s live class(es) within next 24 hours', _upcoming_live); END IF;
  IF _pending_reviews > 0 THEN _blockers := _blockers || format('%s pending submission review(s)', _pending_reviews); END IF;
  RETURN jsonb_build_object(
    'instructor', jsonb_build_object('id', _prof.id, 'name', _prof.full_name, 'email', _prof.email,
       'mobile', COALESCE(_prof.registration_mobile, _prof.phone, _prof.whatsapp_number)),
    'courses', jsonb_build_object('total', _total, 'published', _pub, 'draft', _draft),
    'students', _students,
    'earnings', jsonb_build_object('pending', _pending_earn, 'approved', _approved_earn),
    'pending_payout_requests', _pending_payouts,
    'blockers', to_jsonb(_blockers),
    'upcoming_live_classes_24h', _upcoming_live,
    'pending_reviews', _pending_reviews
  );
END $$;

CREATE OR REPLACE FUNCTION public.admin_deactivate_instructor(
  _instructor_id uuid, _mode text, _new_instructor_id uuid DEFAULT NULL,
  _reason text DEFAULT NULL, _ip text DEFAULT NULL, _user_agent text DEFAULT NULL,
  _force boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _c record; _transferred int := 0; _archived int := 0;
  _upcoming_live int; _pending_reviews int;
BEGIN
  IF NOT public.is_admin_anywhere(auth.uid()) THEN
    RAISE EXCEPTION 'Only Organization Admin or Super Admin can deactivate instructors';
  END IF;
  IF _mode NOT IN ('deactivate','transfer','archive') THEN RAISE EXCEPTION 'Invalid mode'; END IF;
  IF _mode = 'transfer' AND _new_instructor_id IS NULL THEN
    RAISE EXCEPTION 'Replacement instructor required for transfer mode'; END IF;
  IF _mode = 'transfer' AND _new_instructor_id = _instructor_id THEN
    RAISE EXCEPTION 'Replacement instructor cannot be the same person'; END IF;
  IF NOT _force THEN
    SELECT count(*) INTO _upcoming_live FROM public.live_classes
     WHERE instructor_id = _instructor_id AND starts_at BETWEEN now() AND now() + interval '24 hours'
       AND status IN ('scheduled','live');
    IF _upcoming_live > 0 THEN
      RAISE EXCEPTION 'Cannot deactivate: % live class(es) scheduled within the next 24 hours', _upcoming_live;
    END IF;
    SELECT count(*) INTO _pending_reviews FROM public.assignment_submissions s
      JOIN public.assignments a ON a.id = s.assignment_id
      JOIN public.courses c ON c.id = a.course_id
     WHERE c.instructor_id = _instructor_id AND s.status = 'submitted';
    IF _pending_reviews > 0 THEN
      RAISE EXCEPTION 'Cannot deactivate: % pending submission review(s)', _pending_reviews;
    END IF;
  END IF;
  UPDATE public.profiles SET is_active = false, updated_at = now() WHERE id = _instructor_id;
  UPDATE public.workspace_members SET status = 'suspended'::member_status
   WHERE profile_id = _instructor_id AND role = 'instructor'::app_role;
  FOR _c IN SELECT id, workspace_id, status FROM public.courses WHERE instructor_id = _instructor_id LOOP
    IF _mode = 'transfer' THEN
      BEGIN
        PERFORM public.admin_reassign_course_instructor(
          _c.id, _new_instructor_id, _reason, now(), true, true, _ip, _user_agent);
        _transferred := _transferred + 1;
      EXCEPTION WHEN OTHERS THEN NULL; END;
    ELSIF _mode = 'archive' AND _c.status <> 'archived' THEN
      UPDATE public.courses SET status = 'archived'::course_status, archived_at = now(), updated_at = now() WHERE id = _c.id;
      INSERT INTO public.course_audit_log (workspace_id, course_id, actor_id, action, details, ip_address, user_agent, previous_status, new_status)
      VALUES (_c.workspace_id, _c.id, auth.uid(), 'archive',
              jsonb_build_object('reason', COALESCE(_reason,'Instructor deactivated')),
              _ip, _user_agent, _c.status::text, 'archived');
      _archived := _archived + 1;
    END IF;
  END LOOP;
  INSERT INTO public.notifications (workspace_id, profile_id, channel, event_type, title, body)
  SELECT wm.workspace_id, _instructor_id, 'in_app', 'account_deactivated',
         'Account deactivated',
         'Your instructor account has been deactivated by an administrator. Reason: ' || COALESCE(_reason,'—')
    FROM public.workspace_members wm
   WHERE wm.profile_id = _instructor_id AND wm.role = 'instructor'::app_role LIMIT 1;
  RETURN jsonb_build_object('instructor_id', _instructor_id, 'mode', _mode,
    'transferred', _transferred, 'archived', _archived);
END $$;

CREATE OR REPLACE FUNCTION public.admin_reassign_course_instructor(
  _course_id uuid, _new_instructor_id uuid,
  _reason text DEFAULT NULL, _effective_date timestamptz DEFAULT NULL,
  _notify boolean DEFAULT true, _transfer_live_classes boolean DEFAULT false,
  _ip text DEFAULT NULL, _user_agent text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _ws uuid; _old uuid; _title text;
  _is_active_instr boolean; _live_moved int := 0;
  _student_count int := 0; _revenue numeric := 0;
BEGIN
  IF NOT public.has_any_workspace_role(auth.uid(),
       (SELECT workspace_id FROM public.courses WHERE id = _course_id),
       ARRAY['organization_admin','super_admin']::app_role[])
     AND NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only Organization Admin or Super Admin can transfer courses';
  END IF;
  SELECT workspace_id, instructor_id, title INTO _ws, _old, _title
    FROM public.courses WHERE id = _course_id;
  IF _ws IS NULL THEN RAISE EXCEPTION 'Course not found'; END IF;
  IF _new_instructor_id = _old THEN RAISE EXCEPTION 'New instructor is the same as current instructor'; END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members wm JOIN public.profiles p ON p.id = wm.profile_id
    WHERE wm.profile_id = _new_instructor_id AND wm.workspace_id = _ws
      AND wm.role = 'instructor'::app_role AND wm.status = 'active'::member_status
      AND COALESCE(p.is_active, true) = true
  ) INTO _is_active_instr;
  IF NOT _is_active_instr THEN RAISE EXCEPTION 'Target user is not an active instructor in this workspace'; END IF;

  SELECT count(DISTINCT student_id) INTO _student_count
    FROM public.enrollments WHERE course_id = _course_id AND status = 'active'::enrollment_status;
  SELECT COALESCE(sum(amount),0) INTO _revenue
    FROM public.payments WHERE course_id = _course_id AND status = 'succeeded'::payment_status;

  UPDATE public.courses SET instructor_id = _new_instructor_id, updated_at = now() WHERE id = _course_id;

  IF _transfer_live_classes THEN
    UPDATE public.live_classes SET instructor_id = _new_instructor_id, updated_at = now()
     WHERE course_id = _course_id AND starts_at > COALESCE(_effective_date, now())
       AND status IN ('scheduled','live');
    GET DIAGNOSTICS _live_moved = ROW_COUNT;
  END IF;

  INSERT INTO public.course_audit_log (
    workspace_id, course_id, actor_id, action, details, ip_address, user_agent, previous_status, new_status
  ) VALUES (
    _ws, _course_id, auth.uid(), 'instructor_reassigned',
    jsonb_build_object('from', _old, 'to', _new_instructor_id,
      'reason', _reason, 'effective_date', _effective_date,
      'notify', _notify, 'transferred_live_classes', _live_moved,
      'students_snapshot', _student_count, 'revenue_snapshot', _revenue),
    _ip, _user_agent, NULL, NULL);

  IF _notify THEN
    INSERT INTO public.notifications (workspace_id, profile_id, channel, event_type, title, body, source_id)
    VALUES (_ws, _new_instructor_id, 'in_app', 'course_transferred',
            'Course assigned to you',
            'You have been assigned as the instructor of "' || _title || '".', _course_id);
    IF _old IS NOT NULL THEN
      INSERT INTO public.notifications (workspace_id, profile_id, channel, event_type, title, body, source_id)
      VALUES (_ws, _old, 'in_app', 'course_transferred',
              'Course transferred',
              'The course "' || _title || '" has been transferred to another instructor.', _course_id);
    END IF;
    IF auth.uid() IS NOT NULL THEN
      INSERT INTO public.notifications (workspace_id, profile_id, channel, event_type, title, body, source_id)
      VALUES (_ws, auth.uid(), 'in_app', 'course_transferred',
              'Transfer completed',
              'Transfer of "' || _title || '" completed successfully.', _course_id);
    END IF;
  END IF;

  RETURN jsonb_build_object('course_id', _course_id, 'from', _old, 'to', _new_instructor_id,
    'transferred_live_classes', _live_moved, 'students', _student_count, 'revenue', _revenue);
END $$;

CREATE OR REPLACE FUNCTION public.bulk_transfer_preview(_course_ids uuid[])
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  WITH s AS (
    SELECT count(DISTINCT student_id) AS students FROM public.enrollments
    WHERE course_id = ANY(_course_ids) AND status = 'active'::enrollment_status
  ), r AS (
    SELECT COALESCE(sum(amount),0) AS revenue FROM public.payments
    WHERE course_id = ANY(_course_ids) AND status = 'succeeded'::payment_status
  )
  SELECT jsonb_build_object('courses', COALESCE(array_length(_course_ids,1),0),
    'students', (SELECT students FROM s), 'revenue', (SELECT revenue FROM r));
$$;

CREATE OR REPLACE FUNCTION public.list_courses_with_stats(_instructor_id uuid)
RETURNS TABLE(id uuid, title text, category text, status text, students int, revenue numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT c.id, c.title, c.category, c.status::text,
    COALESCE((SELECT count(DISTINCT student_id)::int FROM public.enrollments e
              WHERE e.course_id = c.id AND e.status = 'active'::enrollment_status), 0),
    COALESCE((SELECT sum(amount) FROM public.payments p
              WHERE p.course_id = c.id AND p.status = 'succeeded'::payment_status), 0)
  FROM public.courses c
  WHERE c.instructor_id = _instructor_id AND c.deleted_at IS NULL
  ORDER BY c.title;
$$;

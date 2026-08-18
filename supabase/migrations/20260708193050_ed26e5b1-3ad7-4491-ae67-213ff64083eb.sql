
-- Enhanced single-course transfer
CREATE OR REPLACE FUNCTION public.admin_reassign_course_instructor(
  _course_id uuid,
  _new_instructor_id uuid,
  _reason text DEFAULT NULL,
  _effective_date timestamptz DEFAULT NULL,
  _notify boolean DEFAULT true,
  _transfer_live_classes boolean DEFAULT false,
  _ip text DEFAULT NULL,
  _user_agent text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _ws uuid; _old uuid; _title text;
  _is_active_instr boolean;
  _live_moved int := 0;
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

  IF _new_instructor_id = _old THEN
    RAISE EXCEPTION 'New instructor is the same as current instructor';
  END IF;

  -- Target must be active instructor in the same workspace
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members wm
    JOIN public.profiles p ON p.id = wm.profile_id
    WHERE wm.profile_id = _new_instructor_id
      AND wm.workspace_id = _ws
      AND wm.role = 'instructor'::app_role
      AND wm.status = 'active'::member_status
      AND COALESCE(p.is_active, true) = true
  ) INTO _is_active_instr;
  IF NOT _is_active_instr THEN
    RAISE EXCEPTION 'Target user is not an active instructor in this workspace';
  END IF;

  UPDATE public.courses
     SET instructor_id = _new_instructor_id, updated_at = now()
   WHERE id = _course_id;

  -- Optionally transfer future/scheduled live classes for this course
  IF _transfer_live_classes THEN
    UPDATE public.live_classes
       SET instructor_id = _new_instructor_id, updated_at = now()
     WHERE course_id = _course_id
       AND starts_at > COALESCE(_effective_date, now())
       AND status IN ('scheduled','live');
    GET DIAGNOSTICS _live_moved = ROW_COUNT;
  END IF;

  INSERT INTO public.course_audit_log (
    workspace_id, course_id, actor_id, action, details,
    ip_address, user_agent, previous_status, new_status
  ) VALUES (
    _ws, _course_id, auth.uid(), 'instructor_reassigned',
    jsonb_build_object(
      'from', _old, 'to', _new_instructor_id,
      'reason', _reason, 'effective_date', _effective_date,
      'notify', _notify, 'transferred_live_classes', _live_moved
    ),
    _ip, _user_agent, NULL, NULL
  );

  IF _notify THEN
    -- Notify new instructor
    INSERT INTO public.notifications (workspace_id, profile_id, channel, event_type, title, body, source_id)
    VALUES (_ws, _new_instructor_id, 'in_app', 'course_transferred',
            'Course assigned to you',
            'You have been assigned as the instructor of "' || _title || '".',
            _course_id);
    -- Also notify old instructor if any
    IF _old IS NOT NULL THEN
      INSERT INTO public.notifications (workspace_id, profile_id, channel, event_type, title, body, source_id)
      VALUES (_ws, _old, 'in_app', 'course_transferred',
              'Course transferred',
              'The course "' || _title || '" has been transferred to another instructor.',
              _course_id);
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'course_id', _course_id,
    'from', _old, 'to', _new_instructor_id,
    'transferred_live_classes', _live_moved
  );
END $function$;

-- Bulk transfer
CREATE OR REPLACE FUNCTION public.admin_bulk_reassign_courses(
  _course_ids uuid[],
  _new_instructor_id uuid,
  _reason text DEFAULT NULL,
  _transfer_live_classes boolean DEFAULT false,
  _notify boolean DEFAULT true,
  _ip text DEFAULT NULL,
  _user_agent text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _cid uuid; _ok int := 0; _errors jsonb := '[]'::jsonb;
BEGIN
  IF _course_ids IS NULL OR array_length(_course_ids,1) IS NULL THEN
    RAISE EXCEPTION 'No courses provided';
  END IF;
  FOREACH _cid IN ARRAY _course_ids LOOP
    BEGIN
      PERFORM public.admin_reassign_course_instructor(
        _cid, _new_instructor_id, _reason, now(), _notify, _transfer_live_classes, _ip, _user_agent
      );
      _ok := _ok + 1;
    EXCEPTION WHEN OTHERS THEN
      _errors := _errors || jsonb_build_object('course_id', _cid, 'error', SQLERRM);
    END;
  END LOOP;
  RETURN jsonb_build_object('transferred', _ok, 'errors', _errors);
END $function$;

-- Instructor deactivation workflow
CREATE OR REPLACE FUNCTION public.admin_deactivate_instructor(
  _instructor_id uuid,
  _mode text,  -- 'deactivate' | 'transfer' | 'archive'
  _new_instructor_id uuid DEFAULT NULL,
  _reason text DEFAULT NULL,
  _ip text DEFAULT NULL,
  _user_agent text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _c record;
  _transferred int := 0; _archived int := 0;
BEGIN
  IF NOT public.is_admin_anywhere(auth.uid()) THEN
    RAISE EXCEPTION 'Only Organization Admin or Super Admin can deactivate instructors';
  END IF;
  IF _mode NOT IN ('deactivate','transfer','archive') THEN
    RAISE EXCEPTION 'Invalid mode';
  END IF;
  IF _mode = 'transfer' AND _new_instructor_id IS NULL THEN
    RAISE EXCEPTION 'Replacement instructor required for transfer mode';
  END IF;
  IF _mode = 'transfer' AND _new_instructor_id = _instructor_id THEN
    RAISE EXCEPTION 'Replacement instructor cannot be the same person';
  END IF;

  -- Block login
  UPDATE public.profiles SET is_active = false, updated_at = now() WHERE id = _instructor_id;
  UPDATE public.workspace_members
     SET status = 'suspended'::member_status
   WHERE profile_id = _instructor_id AND role = 'instructor'::app_role;

  FOR _c IN
    SELECT id, workspace_id, status
      FROM public.courses
     WHERE instructor_id = _instructor_id
  LOOP
    IF _mode = 'transfer' THEN
      BEGIN
        PERFORM public.admin_reassign_course_instructor(
          _c.id, _new_instructor_id, _reason, now(), true, true, _ip, _user_agent
        );
        _transferred := _transferred + 1;
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    ELSIF _mode = 'archive' AND _c.status <> 'archived' THEN
      UPDATE public.courses SET status = 'archived'::course_status, archived_at = now(), updated_at = now()
        WHERE id = _c.id;
      INSERT INTO public.course_audit_log (workspace_id, course_id, actor_id, action, details, ip_address, user_agent, previous_status, new_status)
      VALUES (_c.workspace_id, _c.id, auth.uid(), 'archive',
              jsonb_build_object('reason', COALESCE(_reason,'Instructor deactivated')),
              _ip, _user_agent, _c.status::text, 'archived');
      _archived := _archived + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'instructor_id', _instructor_id, 'mode', _mode,
    'transferred', _transferred, 'archived', _archived
  );
END $function$;

-- Reporting helper for transfers
CREATE OR REPLACE FUNCTION public.list_course_transfers(
  _workspace_id uuid DEFAULT NULL,
  _from timestamptz DEFAULT NULL,
  _to timestamptz DEFAULT NULL
) RETURNS TABLE(
  id uuid, course_id uuid, course_title text,
  from_instructor uuid, from_name text,
  to_instructor uuid, to_name text,
  actor_id uuid, actor_name text,
  reason text, ip_address text, user_agent text, created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT al.id, al.course_id, c.title,
         (al.details->>'from')::uuid AS from_instructor,
         pf.full_name AS from_name,
         (al.details->>'to')::uuid AS to_instructor,
         pt.full_name AS to_name,
         al.actor_id, pa.full_name AS actor_name,
         al.details->>'reason' AS reason,
         al.ip_address, al.user_agent, al.created_at
  FROM public.course_audit_log al
  LEFT JOIN public.courses c ON c.id = al.course_id
  LEFT JOIN public.profiles pf ON pf.id = (al.details->>'from')::uuid
  LEFT JOIN public.profiles pt ON pt.id = (al.details->>'to')::uuid
  LEFT JOIN public.profiles pa ON pa.id = al.actor_id
  WHERE al.action = 'instructor_reassigned'
    AND (_workspace_id IS NULL OR al.workspace_id = _workspace_id)
    AND (_from IS NULL OR al.created_at >= _from)
    AND (_to   IS NULL OR al.created_at <= _to)
    AND public.is_admin_or_staff_anywhere(auth.uid())
  ORDER BY al.created_at DESC;
$function$;

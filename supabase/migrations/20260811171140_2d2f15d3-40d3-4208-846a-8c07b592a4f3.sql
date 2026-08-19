
-- 1) Unified, authoritative completion status (lessons + published quizzes + published assignments)
CREATE OR REPLACE FUNCTION public.course_completion_status(_student uuid, _course uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  total_lessons int := 0; done_lessons int := 0;
  total_quizzes int := 0; passed_quizzes int := 0;
  total_assignments int := 0; passed_assignments int := 0;
  total_items int := 0; done_items int := 0;
  pct numeric := 0;
BEGIN
  SELECT count(*) INTO total_lessons FROM public.lessons WHERE course_id = _course;
  IF total_lessons > 0 THEN
    SELECT count(DISTINCT lp.lesson_id) INTO done_lessons
      FROM public.lesson_progress lp
      JOIN public.lessons l ON l.id = lp.lesson_id
      WHERE l.course_id = _course AND lp.student_id = _student AND lp.is_completed = true;
  END IF;

  SELECT count(*) INTO total_quizzes
    FROM public.quizzes WHERE course_id = _course AND status = 'published';
  IF total_quizzes > 0 THEN
    SELECT count(DISTINCT qa.quiz_id) INTO passed_quizzes
      FROM public.quiz_attempts qa
      JOIN public.quizzes q ON q.id = qa.quiz_id
      WHERE q.course_id = _course AND q.status = 'published'
        AND qa.student_id = _student AND qa.passed = true;
  END IF;

  SELECT count(*) INTO total_assignments
    FROM public.assignments WHERE course_id = _course AND status = 'published';
  IF total_assignments > 0 THEN
    SELECT count(DISTINCT s.assignment_id) INTO passed_assignments
      FROM public.assignment_submissions s
      JOIN public.assignments a ON a.id = s.assignment_id
      WHERE a.course_id = _course AND a.status = 'published'
        AND s.student_id = _student AND s.passed = true;
  END IF;

  total_items := total_lessons + total_quizzes + total_assignments;
  done_items := LEAST(done_lessons, total_lessons)
              + LEAST(passed_quizzes, total_quizzes)
              + LEAST(passed_assignments, total_assignments);

  IF total_items > 0 THEN
    pct := round((done_items::numeric / total_items::numeric) * 100, 2);
  END IF;

  RETURN jsonb_build_object(
    'total_lessons', total_lessons,
    'completed_lessons', done_lessons,
    'total_quizzes', total_quizzes,
    'passed_quizzes', passed_quizzes,
    'total_assignments', total_assignments,
    'passed_assignments', passed_assignments,
    'total_items', total_items,
    'completed_items', done_items,
    'completion_percentage', pct,
    'is_complete', (
      total_items > 0
      AND done_lessons >= total_lessons
      AND passed_quizzes >= total_quizzes
      AND passed_assignments >= total_assignments
    )
  );
END $function$;

-- 2) Auto-issue: single source of truth for eligibility + idempotent + enrollment aware
CREATE OR REPLACE FUNCTION public.try_issue_course_certificate(_student uuid, _course uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _course_row public.courses;
  _status jsonb;
  _avg_pct numeric; _final_pct numeric;
  _existing uuid; _tpl uuid; _cert_id uuid;
  _code text;
  _enr record;
BEGIN
  SELECT * INTO _course_row FROM public.courses WHERE id = _course;
  IF NOT FOUND THEN RETURN NULL; END IF;

  -- Idempotency: one active certificate per (student, course)
  SELECT id INTO _existing FROM public.certificates
    WHERE student_id = _student AND course_id = _course AND revoked_at IS NULL LIMIT 1;
  IF _existing IS NOT NULL THEN RETURN _existing; END IF;

  -- Enrollment must exist and still be valid (not expired / access-expired)
  SELECT * INTO _enr FROM public.enrollments
    WHERE student_id = _student AND course_id = _course
    ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF _enr.status = 'expired'
     OR (_enr.access_expires_at IS NOT NULL AND _enr.access_expires_at < now()) THEN
    RETURN NULL;
  END IF;

  -- Same eligibility rules the insert-time guard enforces
  _status := public.course_completion_status(_student, _course);
  IF NOT COALESCE((_status->>'is_complete')::boolean, false) THEN RETURN NULL; END IF;

  IF COALESCE((_status->>'total_quizzes')::int, 0) > 0 THEN
    SELECT AVG(best_pct) INTO _avg_pct FROM (
      SELECT MAX(qa.percentage) AS best_pct
      FROM public.quiz_attempts qa JOIN public.quizzes q ON q.id = qa.quiz_id
      WHERE qa.student_id = _student AND q.course_id = _course AND q.status = 'published'
      GROUP BY qa.quiz_id
    ) t;
    _final_pct := COALESCE(_avg_pct, 0);
  ELSE
    _final_pct := 100;
  END IF;

  IF _final_pct < COALESCE(_course_row.passing_percentage, 0) THEN RETURN NULL; END IF;

  UPDATE public.enrollments SET status = 'completed', completed_at = COALESCE(completed_at, now())
    WHERE student_id = _student AND course_id = _course AND status <> 'completed';

  _tpl := public.resolve_certificate_template(_course_row.workspace_id, _course);
  _code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 14));

  BEGIN
    INSERT INTO public.certificates (
      workspace_id, course_id, student_id, template_id,
      completion_percentage, completion_date, certificate_number, verification_code
    ) VALUES (
      _course_row.workspace_id, _course, _student, _tpl,
      ROUND(_final_pct, 2), now(), _code, _code
    ) RETURNING id INTO _cert_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO _cert_id FROM public.certificates
      WHERE student_id = _student AND course_id = _course AND revoked_at IS NULL LIMIT 1;
  END;

  RETURN _cert_id;
END; $function$;

-- 3) Progress writes must never fail because of certificate issuance
CREATE OR REPLACE FUNCTION public.try_cert_after_lesson_progress()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _course uuid;
BEGIN
  IF NEW.is_completed = true THEN
    SELECT course_id INTO _course FROM public.lessons WHERE id = NEW.lesson_id;
    IF _course IS NOT NULL THEN
      BEGIN
        PERFORM public.try_issue_course_certificate(NEW.student_id, _course);
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'certificate auto-issue skipped for % / %: %', NEW.student_id, _course, SQLERRM;
      END;
    END IF;
  END IF;
  RETURN NEW;
END; $function$;

-- 4) Student self-issue: idempotent + enrollment validity
CREATE OR REPLACE FUNCTION public.issue_self_certificate(_workspace_id uuid, _course_id uuid, _template_id uuid DEFAULT NULL::uuid, _completion_percentage numeric DEFAULT 100, _completion_date timestamp with time zone DEFAULT now())
 RETURNS certificates
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _existing public.certificates;
  _new public.certificates;
  _chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  _cn text; _vc text; _tpl uuid;
  _status jsonb;
  _enr record;
  i int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO _existing FROM public.certificates
   WHERE student_id = _uid AND course_id = _course_id AND revoked_at IS NULL
   ORDER BY issued_at DESC LIMIT 1;
  IF FOUND THEN RETURN _existing; END IF;

  SELECT * INTO _enr FROM public.enrollments
   WHERE student_id = _uid AND course_id = _course_id AND workspace_id = _workspace_id
   ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_enrolled'; END IF;
  IF _enr.status = 'expired'
     OR (_enr.access_expires_at IS NOT NULL AND _enr.access_expires_at < now()) THEN
    RAISE EXCEPTION 'enrollment_not_active';
  END IF;

  _status := public.course_completion_status(_uid, _course_id);
  IF NOT COALESCE((_status->>'is_complete')::boolean, false) THEN
    RAISE EXCEPTION 'course_not_complete: %', _status::text USING ERRCODE = 'check_violation';
  END IF;

  _tpl := public.resolve_certificate_template(_workspace_id, _course_id);

  _cn := 'CERT-' || to_char(now(), 'YYYY') || '-';
  FOR i IN 1..6 LOOP
    _cn := _cn || substr(_chars, 1 + floor(random() * length(_chars))::int, 1);
  END LOOP;
  _vc := '';
  FOR i IN 1..14 LOOP
    _vc := _vc || substr(_chars, 1 + floor(random() * length(_chars))::int, 1);
  END LOOP;

  BEGIN
    INSERT INTO public.certificates (
      workspace_id, course_id, student_id, template_id,
      completion_percentage, completion_date, certificate_number, verification_code
    ) VALUES (
      _workspace_id, _course_id, _uid, _tpl,
      COALESCE((_status->>'completion_percentage')::numeric, _completion_percentage),
      _completion_date, _vc, _vc
    ) RETURNING * INTO _new;
  EXCEPTION WHEN unique_violation THEN
    SELECT * INTO _new FROM public.certificates
      WHERE student_id = _uid AND course_id = _course_id AND revoked_at IS NULL
      ORDER BY issued_at DESC LIMIT 1;
  END;

  RETURN _new;
END $function$;

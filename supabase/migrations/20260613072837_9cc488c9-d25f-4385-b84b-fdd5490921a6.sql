
-- Resolve template: course-assigned -> workspace default -> oldest workspace template
CREATE OR REPLACE FUNCTION public.resolve_certificate_template(_workspace_id uuid, _course_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _tpl uuid;
BEGIN
  IF _course_id IS NOT NULL THEN
    SELECT certificate_template_id INTO _tpl FROM public.courses WHERE id = _course_id;
    IF _tpl IS NOT NULL THEN
      -- verify it still exists and belongs to the workspace
      PERFORM 1 FROM public.certificate_templates
        WHERE id = _tpl AND workspace_id = _workspace_id;
      IF FOUND THEN RETURN _tpl; END IF;
    END IF;
  END IF;

  SELECT id INTO _tpl FROM public.certificate_templates
    WHERE workspace_id = _workspace_id AND is_default = true
    ORDER BY updated_at DESC LIMIT 1;
  IF _tpl IS NOT NULL THEN RETURN _tpl; END IF;

  SELECT id INTO _tpl FROM public.certificate_templates
    WHERE workspace_id = _workspace_id
    ORDER BY created_at ASC LIMIT 1;
  RETURN _tpl;
END $$;

GRANT EXECUTE ON FUNCTION public.resolve_certificate_template(uuid, uuid) TO authenticated, service_role;

-- Rewrite auto-issuer to use unified resolver
CREATE OR REPLACE FUNCTION public.try_issue_course_certificate(_student uuid, _course uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _course_row public.courses;
  _total_lessons int; _done_lessons int;
  _total_assigns int; _done_assigns int;
  _total_quizzes int; _passed_quizzes int;
  _avg_pct numeric; _final_pct numeric;
  _existing uuid; _tpl uuid; _cert_id uuid;
  _code text;
BEGIN
  SELECT * INTO _course_row FROM public.courses WHERE id = _course;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT id INTO _existing FROM public.certificates
    WHERE student_id = _student AND course_id = _course AND revoked_at IS NULL LIMIT 1;
  IF _existing IS NOT NULL THEN RETURN _existing; END IF;

  SELECT COUNT(*) INTO _total_lessons FROM public.lessons WHERE course_id = _course;
  SELECT COUNT(DISTINCT lp.lesson_id) INTO _done_lessons
    FROM public.lesson_progress lp JOIN public.lessons l ON l.id = lp.lesson_id
    WHERE lp.student_id = _student AND l.course_id = _course AND lp.is_completed = true;
  IF _total_lessons > 0 AND _done_lessons < _total_lessons THEN RETURN NULL; END IF;

  SELECT COUNT(*) INTO _total_assigns FROM public.assignments
    WHERE course_id = _course AND status = 'published';
  SELECT COUNT(DISTINCT s.assignment_id) INTO _done_assigns
    FROM public.assignment_submissions s JOIN public.assignments a ON a.id = s.assignment_id
    WHERE s.student_id = _student AND a.course_id = _course AND a.status = 'published';
  IF _total_assigns > 0 AND _done_assigns < _total_assigns THEN RETURN NULL; END IF;

  SELECT COUNT(*) INTO _total_quizzes FROM public.quizzes
    WHERE course_id = _course AND status = 'published';
  SELECT COUNT(DISTINCT qa.quiz_id) INTO _passed_quizzes
    FROM public.quiz_attempts qa JOIN public.quizzes q ON q.id = qa.quiz_id
    WHERE qa.student_id = _student AND q.course_id = _course
      AND qa.passed = true AND q.status = 'published';
  IF _total_quizzes > 0 AND _passed_quizzes < _total_quizzes THEN RETURN NULL; END IF;

  IF _total_quizzes > 0 THEN
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

  IF _final_pct < _course_row.passing_percentage THEN RETURN NULL; END IF;

  UPDATE public.enrollments SET status = 'completed', completed_at = COALESCE(completed_at, now())
    WHERE student_id = _student AND course_id = _course AND status <> 'completed';

  _tpl := public.resolve_certificate_template(_course_row.workspace_id, _course);

  _code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 14));

  INSERT INTO public.certificates (
    workspace_id, course_id, student_id, template_id,
    completion_percentage, completion_date, certificate_number, verification_code
  ) VALUES (
    _course_row.workspace_id, _course, _student, _tpl,
    ROUND(_final_pct, 2), now(), _code, _code
  ) RETURNING id INTO _cert_id;

  RETURN _cert_id;
END; $function$;

-- Rewrite self-issue: ignore client-supplied template, always resolve server-side
CREATE OR REPLACE FUNCTION public.issue_self_certificate(
  _workspace_id uuid,
  _course_id uuid,
  _template_id uuid DEFAULT NULL,
  _completion_percentage numeric DEFAULT 100,
  _completion_date timestamptz DEFAULT now()
)
RETURNS public.certificates
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _existing public.certificates;
  _new public.certificates;
  _chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  _cn text;
  _vc text;
  _tpl uuid;
  i int;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO _existing
  FROM public.certificates
  WHERE student_id = _uid AND course_id = _course_id
  ORDER BY issued_at DESC
  LIMIT 1;
  IF FOUND THEN
    RETURN _existing;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.enrollments
    WHERE student_id = _uid AND course_id = _course_id AND workspace_id = _workspace_id
  ) THEN
    RAISE EXCEPTION 'not_enrolled';
  END IF;

  -- Always resolve template server-side: course -> workspace default -> oldest
  _tpl := public.resolve_certificate_template(_workspace_id, _course_id);

  _cn := 'CERT-' || to_char(now(), 'YYYY') || '-';
  FOR i IN 1..6 LOOP
    _cn := _cn || substr(_chars, 1 + floor(random() * length(_chars))::int, 1);
  END LOOP;
  _vc := '';
  FOR i IN 1..14 LOOP
    _vc := _vc || substr(_chars, 1 + floor(random() * length(_chars))::int, 1);
  END LOOP;

  INSERT INTO public.certificates (
    workspace_id, course_id, student_id, template_id,
    completion_percentage, completion_date,
    certificate_number, verification_code
  ) VALUES (
    _workspace_id, _course_id, _uid, _tpl,
    _completion_percentage, _completion_date,
    _cn, _vc
  )
  RETURNING * INTO _new;

  RETURN _new;
END;
$$;

GRANT EXECUTE ON FUNCTION public.issue_self_certificate(uuid, uuid, uuid, numeric, timestamptz) TO authenticated;

NOTIFY pgrst, 'reload schema';

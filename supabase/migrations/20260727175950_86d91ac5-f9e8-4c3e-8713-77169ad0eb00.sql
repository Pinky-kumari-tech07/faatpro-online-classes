
-- 1) Completion status function
CREATE OR REPLACE FUNCTION public.course_completion_status(_student uuid, _course uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  total_lessons int := 0; done_lessons int := 0;
  total_quizzes int := 0; passed_quizzes int := 0;
  total_assignments int := 0; passed_assignments int := 0;
  pct numeric := 0;
BEGIN
  SELECT count(*) INTO total_lessons FROM public.lessons WHERE course_id = _course;
  IF total_lessons > 0 THEN
    SELECT count(DISTINCT lp.lesson_id) INTO done_lessons
      FROM public.lesson_progress lp
      JOIN public.lessons l ON l.id = lp.lesson_id
      WHERE l.course_id = _course
        AND lp.student_id = _student
        AND lp.is_completed = true;
  END IF;

  SELECT count(*) INTO total_quizzes
    FROM public.quizzes WHERE course_id = _course AND status = 'published';
  IF total_quizzes > 0 THEN
    SELECT count(DISTINCT qa.quiz_id) INTO passed_quizzes
      FROM public.quiz_attempts qa
      JOIN public.quizzes q ON q.id = qa.quiz_id
      WHERE q.course_id = _course
        AND q.status = 'published'
        AND qa.student_id = _student
        AND qa.passed = true;
  END IF;

  SELECT count(*) INTO total_assignments
    FROM public.assignments WHERE course_id = _course AND status = 'published';
  IF total_assignments > 0 THEN
    SELECT count(DISTINCT s.assignment_id) INTO passed_assignments
      FROM public.assignment_submissions s
      JOIN public.assignments a ON a.id = s.assignment_id
      WHERE a.course_id = _course
        AND a.status = 'published'
        AND s.student_id = _student
        AND s.passed = true;
  END IF;

  IF total_lessons > 0 THEN
    pct := round((done_lessons::numeric / total_lessons::numeric) * 100, 2);
  END IF;

  RETURN jsonb_build_object(
    'total_lessons', total_lessons,
    'completed_lessons', done_lessons,
    'total_quizzes', total_quizzes,
    'passed_quizzes', passed_quizzes,
    'total_assignments', total_assignments,
    'passed_assignments', passed_assignments,
    'completion_percentage', pct,
    'is_complete', (
      done_lessons >= total_lessons
      AND passed_quizzes >= total_quizzes
      AND passed_assignments >= total_assignments
      AND total_lessons > 0
    )
  );
END $$;

GRANT EXECUTE ON FUNCTION public.course_completion_status(uuid, uuid) TO authenticated, service_role;

-- 2) BEFORE INSERT trigger on certificates enforcing completion
CREATE OR REPLACE FUNCTION public.enforce_certificate_completion()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  status jsonb;
  override text;
BEGIN
  -- Allow explicit per-request override set by a trusted admin action.
  BEGIN
    override := current_setting('app.cert_completion_override', true);
  EXCEPTION WHEN OTHERS THEN
    override := NULL;
  END;
  IF override = 'true' THEN
    RETURN NEW;
  END IF;

  status := public.course_completion_status(NEW.student_id, NEW.course_id);

  IF NOT COALESCE((status->>'is_complete')::boolean, false) THEN
    RAISE EXCEPTION 'course_not_complete: %', status::text
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_certificate_completion ON public.certificates;
CREATE TRIGGER trg_enforce_certificate_completion
BEFORE INSERT ON public.certificates
FOR EACH ROW EXECUTE FUNCTION public.enforce_certificate_completion();

-- 3) Update self-issue RPC to require completion (redundant with trigger but
--    yields a nicer error message and short-circuits before random codegen)
CREATE OR REPLACE FUNCTION public.issue_self_certificate(
  _workspace_id uuid, _course_id uuid,
  _template_id uuid DEFAULT NULL::uuid,
  _completion_percentage numeric DEFAULT 100,
  _completion_date timestamp with time zone DEFAULT now()
)
RETURNS certificates
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _existing public.certificates;
  _new public.certificates;
  _chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  _cn text; _vc text; _tpl uuid;
  _status jsonb;
  i int;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO _existing
  FROM public.certificates
  WHERE student_id = _uid AND course_id = _course_id
  ORDER BY issued_at DESC LIMIT 1;
  IF FOUND THEN
    RETURN _existing;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.enrollments
    WHERE student_id = _uid AND course_id = _course_id AND workspace_id = _workspace_id
  ) THEN
    RAISE EXCEPTION 'not_enrolled';
  END IF;

  _status := public.course_completion_status(_uid, _course_id);
  IF NOT COALESCE((_status->>'is_complete')::boolean, false) THEN
    RAISE EXCEPTION 'course_not_complete: %', _status::text
      USING ERRCODE = 'check_violation';
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

  INSERT INTO public.certificates (
    workspace_id, course_id, student_id, template_id,
    completion_percentage, completion_date,
    certificate_number, verification_code
  ) VALUES (
    _workspace_id, _course_id, _uid, _tpl,
    COALESCE((_status->>'completion_percentage')::numeric, _completion_percentage),
    _completion_date, _cn, _vc
  ) RETURNING * INTO _new;

  RETURN _new;
END $function$;

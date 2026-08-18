
-- Backfill: set certificate_number = verification_code for existing rows
UPDATE public.certificates
   SET certificate_number = verification_code
 WHERE certificate_number IS DISTINCT FROM verification_code;

-- Update issuer function to use a single identifier
CREATE OR REPLACE FUNCTION public.try_issue_course_certificate(_student uuid, _course uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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

  SELECT id INTO _tpl FROM public.certificate_templates
    WHERE workspace_id = _course_row.workspace_id AND is_default = true LIMIT 1;
  IF _tpl IS NULL THEN
    SELECT id INTO _tpl FROM public.certificate_templates
      WHERE workspace_id = _course_row.workspace_id ORDER BY created_at ASC LIMIT 1;
  END IF;

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

-- Trigger to enforce equality of certificate_number and verification_code
CREATE OR REPLACE FUNCTION public.enforce_cert_identifier_match()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.certificate_number IS NULL AND NEW.verification_code IS NOT NULL THEN
    NEW.certificate_number := NEW.verification_code;
  ELSIF NEW.verification_code IS NULL AND NEW.certificate_number IS NOT NULL THEN
    NEW.verification_code := NEW.certificate_number;
  ELSIF NEW.certificate_number IS DISTINCT FROM NEW.verification_code THEN
    NEW.certificate_number := NEW.verification_code;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_certs_identifier_match ON public.certificates;
CREATE TRIGGER trg_certs_identifier_match
BEFORE INSERT OR UPDATE ON public.certificates
FOR EACH ROW EXECUTE FUNCTION public.enforce_cert_identifier_match();

NOTIFY pgrst, 'reload schema';

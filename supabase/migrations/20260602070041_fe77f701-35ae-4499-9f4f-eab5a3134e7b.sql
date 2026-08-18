
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS passing_percentage integer NOT NULL DEFAULT 90
    CHECK (passing_percentage BETWEEN 1 AND 100);

ALTER TABLE public.quiz_attempts
  ADD COLUMN IF NOT EXISTS percentage numeric,
  ADD COLUMN IF NOT EXISTS passed boolean;

UPDATE public.quiz_attempts qa
SET percentage = CASE WHEN qa.max_score > 0 THEN ROUND((qa.score::numeric / qa.max_score) * 100, 2) ELSE 0 END
WHERE qa.percentage IS NULL;

UPDATE public.quiz_attempts qa
SET passed = (qa.percentage >= COALESCE((SELECT c.passing_percentage FROM public.quizzes q JOIN public.courses c ON c.id = q.course_id WHERE q.id = qa.quiz_id), 90))
WHERE qa.passed IS NULL;

-- Dedupe existing active certificates: keep newest, revoke older
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY student_id, course_id ORDER BY issued_at DESC, id DESC
  ) AS rn
  FROM public.certificates WHERE revoked_at IS NULL
)
UPDATE public.certificates c
   SET revoked_at = now()
  FROM ranked r
 WHERE c.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_cert_active_per_student_course
  ON public.certificates (student_id, course_id) WHERE revoked_at IS NULL;

CREATE OR REPLACE FUNCTION public.compute_quiz_attempt_result()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _passing int;
BEGIN
  IF NEW.max_score IS NULL OR NEW.max_score = 0 THEN
    NEW.percentage := 0;
  ELSE
    NEW.percentage := ROUND((NEW.score::numeric / NEW.max_score) * 100, 2);
  END IF;
  SELECT c.passing_percentage INTO _passing
    FROM public.quizzes q JOIN public.courses c ON c.id = q.course_id
    WHERE q.id = NEW.quiz_id;
  _passing := COALESCE(_passing, 90);
  NEW.passed := (NEW.percentage >= _passing);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_compute_quiz_attempt_result ON public.quiz_attempts;
CREATE TRIGGER trg_compute_quiz_attempt_result
  BEFORE INSERT ON public.quiz_attempts
  FOR EACH ROW EXECUTE FUNCTION public.compute_quiz_attempt_result();

CREATE OR REPLACE FUNCTION public.try_issue_course_certificate(_student uuid, _course uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _course_row public.courses;
  _total_lessons int; _done_lessons int;
  _total_assigns int; _done_assigns int;
  _total_quizzes int; _passed_quizzes int;
  _avg_pct numeric; _final_pct numeric;
  _existing uuid; _tpl uuid; _cert_id uuid;
  _code text; _num text;
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
  _num  := 'CERT-' || to_char(now(), 'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  INSERT INTO public.certificates (
    workspace_id, course_id, student_id, template_id,
    completion_percentage, completion_date, certificate_number, verification_code
  ) VALUES (
    _course_row.workspace_id, _course, _student, _tpl,
    ROUND(_final_pct, 2), now(), _num, _code
  ) RETURNING id INTO _cert_id;

  RETURN _cert_id;
END; $$;

CREATE OR REPLACE FUNCTION public.try_cert_after_quiz_attempt()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _course uuid;
BEGIN
  SELECT course_id INTO _course FROM public.quizzes WHERE id = NEW.quiz_id;
  IF _course IS NOT NULL THEN PERFORM public.try_issue_course_certificate(NEW.student_id, _course); END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_cert_after_quiz_attempt ON public.quiz_attempts;
CREATE TRIGGER trg_cert_after_quiz_attempt
  AFTER INSERT ON public.quiz_attempts
  FOR EACH ROW EXECUTE FUNCTION public.try_cert_after_quiz_attempt();

CREATE OR REPLACE FUNCTION public.try_cert_after_lesson_progress()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _course uuid;
BEGIN
  IF NEW.is_completed = true THEN
    SELECT course_id INTO _course FROM public.lessons WHERE id = NEW.lesson_id;
    IF _course IS NOT NULL THEN PERFORM public.try_issue_course_certificate(NEW.student_id, _course); END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_cert_after_lesson_progress ON public.lesson_progress;
CREATE TRIGGER trg_cert_after_lesson_progress
  AFTER INSERT OR UPDATE ON public.lesson_progress
  FOR EACH ROW EXECUTE FUNCTION public.try_cert_after_lesson_progress();

CREATE OR REPLACE FUNCTION public.try_cert_after_assignment_sub()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _course uuid;
BEGIN
  SELECT course_id INTO _course FROM public.assignments WHERE id = NEW.assignment_id;
  IF _course IS NOT NULL THEN PERFORM public.try_issue_course_certificate(NEW.student_id, _course); END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_cert_after_assignment_sub ON public.assignment_submissions;
CREATE TRIGGER trg_cert_after_assignment_sub
  AFTER INSERT OR UPDATE ON public.assignment_submissions
  FOR EACH ROW EXECUTE FUNCTION public.try_cert_after_assignment_sub();

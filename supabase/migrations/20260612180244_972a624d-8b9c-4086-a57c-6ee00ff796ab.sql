
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
  i int;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Return existing certificate if already issued (idempotent)
  SELECT * INTO _existing
  FROM public.certificates
  WHERE student_id = _uid AND course_id = _course_id
  ORDER BY issued_at DESC
  LIMIT 1;
  IF FOUND THEN
    RETURN _existing;
  END IF;

  -- Verify student is enrolled in this course/workspace
  IF NOT EXISTS (
    SELECT 1 FROM public.enrollments
    WHERE student_id = _uid AND course_id = _course_id AND workspace_id = _workspace_id
  ) THEN
    RAISE EXCEPTION 'not_enrolled';
  END IF;

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
    _workspace_id, _course_id, _uid, _template_id,
    _completion_percentage, _completion_date,
    _cn, _vc
  )
  RETURNING * INTO _new;

  RETURN _new;
END;
$$;

GRANT EXECUTE ON FUNCTION public.issue_self_certificate(uuid, uuid, uuid, numeric, timestamptz) TO authenticated;

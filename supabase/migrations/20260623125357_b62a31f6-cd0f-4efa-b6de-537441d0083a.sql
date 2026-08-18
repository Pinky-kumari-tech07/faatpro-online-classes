
CREATE OR REPLACE FUNCTION public.get_public_course_curriculum(_course_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_public boolean;
  _sections jsonb;
  _lessons jsonb;
  _quizzes int;
  _assignments int;
  _students int;
  _duration int;
BEGIN
  SELECT (status = 'published' AND visibility = 'public' AND deleted_at IS NULL)
    INTO _is_public
  FROM public.courses
  WHERE id = _course_id;

  IF NOT COALESCE(_is_public, false) THEN
    RETURN jsonb_build_object(
      'sections', '[]'::jsonb,
      'lessons', '[]'::jsonb,
      'stats', jsonb_build_object('modules',0,'lessons',0,'quizzes',0,'assignments',0,'students',0,'durationMinutes',0)
    );
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'title', title, 'position', position) ORDER BY position), '[]'::jsonb)
    INTO _sections
  FROM public.course_sections WHERE course_id = _course_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id, 'title', title, 'lesson_type', lesson_type,
    'duration_seconds', duration_seconds, 'position', position,
    'is_preview', is_preview, 'section_id', section_id
  ) ORDER BY position), '[]'::jsonb)
    INTO _lessons
  FROM public.lessons WHERE course_id = _course_id;

  SELECT count(*) INTO _quizzes FROM public.quizzes WHERE course_id = _course_id;
  SELECT count(*) INTO _assignments FROM public.assignments WHERE course_id = _course_id;
  SELECT count(*) INTO _students FROM public.enrollments WHERE course_id = _course_id;
  SELECT COALESCE(round(sum(COALESCE(duration_seconds,0))::numeric / 60)::int, 0)
    INTO _duration
  FROM public.lessons WHERE course_id = _course_id;

  RETURN jsonb_build_object(
    'sections', _sections,
    'lessons', _lessons,
    'stats', jsonb_build_object(
      'modules', jsonb_array_length(_sections),
      'lessons', jsonb_array_length(_lessons),
      'quizzes', _quizzes,
      'assignments', _assignments,
      'students', _students,
      'durationMinutes', _duration
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_course_curriculum(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_public_instructors()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH instr AS (
    SELECT DISTINCT wm.profile_id AS id
    FROM public.workspace_members wm
    WHERE wm.role = 'instructor'::app_role AND wm.status = 'active'
    UNION
    SELECT DISTINCT c.instructor_id AS id
    FROM public.courses c
    WHERE c.instructor_id IS NOT NULL
      AND c.status = 'published'
      AND c.visibility = 'public'
      AND c.deleted_at IS NULL
    UNION
    SELECT ip.user_id AS id
    FROM public.instructor_profiles ip
    WHERE ip.verification_status = 'approved'
  ),
  stats AS (
    SELECT c.instructor_id AS id,
           count(*)::int AS course_count,
           array_agg(DISTINCT c.category) FILTER (WHERE c.category IS NOT NULL) AS categories,
           sum(COALESCE((SELECT count(*) FROM public.enrollments e WHERE e.course_id = c.id),0))::int AS students
    FROM public.courses c
    WHERE c.status = 'published' AND c.visibility = 'public' AND c.deleted_at IS NULL
    GROUP BY c.instructor_id
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', i.id,
    'name', COALESCE(p.full_name, 'Instructor'),
    'avatar', p.avatar_url,
    'count', COALESCE(s.course_count, 0),
    'students', COALESCE(s.students, 0),
    'categories', COALESCE(to_jsonb(s.categories), '[]'::jsonb),
    'verified', COALESCE(ip.verification_status = 'approved', false)
  ) ORDER BY COALESCE(s.course_count,0) DESC, p.full_name ASC), '[]'::jsonb)
  FROM instr i
  LEFT JOIN public.profiles p ON p.id = i.id
  LEFT JOIN stats s ON s.id = i.id
  LEFT JOIN public.instructor_profiles ip ON ip.user_id = i.id
  WHERE p.id IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_instructors() TO anon, authenticated;
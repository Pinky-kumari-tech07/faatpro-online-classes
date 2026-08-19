
CREATE OR REPLACE FUNCTION public.get_public_homepage_stats()
RETURNS TABLE(active_learners bigint, courses bigint, expert_instructors bigint, completion_rate numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT COUNT(DISTINCT student_id) FROM public.enrollments)::bigint AS active_learners,
    (SELECT COUNT(*) FROM public.courses WHERE status = 'published')::bigint AS courses,
    (SELECT COUNT(*) FROM public.instructor_profiles WHERE verification_status = 'approved')::bigint AS expert_instructors,
    COALESCE((
      SELECT ROUND(
        (COUNT(*) FILTER (WHERE status = 'completed'))::numeric
        / NULLIF(COUNT(*), 0) * 100, 1)
      FROM public.enrollments
    ), 0)::numeric AS completion_rate;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_homepage_stats() TO anon, authenticated;

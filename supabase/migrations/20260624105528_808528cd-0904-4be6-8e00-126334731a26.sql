CREATE OR REPLACE FUNCTION public.get_public_course_categories()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id,
    'name', name,
    'slug', slug,
    'parent_id', parent_id,
    'icon', icon,
    'sort_order', sort_order,
    'is_trending', is_trending
  ) ORDER BY parent_id NULLS FIRST, sort_order, name), '[]'::jsonb)
  FROM public.course_categories
  WHERE status = 'active';
$$;

GRANT EXECUTE ON FUNCTION public.get_public_course_categories() TO anon, authenticated;
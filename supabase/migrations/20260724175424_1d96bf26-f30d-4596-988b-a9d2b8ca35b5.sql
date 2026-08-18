
-- 1) Add section_id to quizzes/assignments/live_classes so they can be nested under a section
ALTER TABLE public.quizzes
  ADD COLUMN IF NOT EXISTS section_id uuid REFERENCES public.course_sections(id) ON DELETE SET NULL;
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS section_id uuid REFERENCES public.course_sections(id) ON DELETE SET NULL;
ALTER TABLE public.live_classes
  ADD COLUMN IF NOT EXISTS section_id uuid REFERENCES public.course_sections(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_quizzes_section_id ON public.quizzes(section_id);
CREATE INDEX IF NOT EXISTS idx_assignments_section_id ON public.assignments(section_id);
CREATE INDEX IF NOT EXISTS idx_live_classes_section_id ON public.live_classes(section_id);

-- 2) SECURITY DEFINER function so admins can list all active instructors across workspaces,
--    bypassing per-workspace RLS on workspace_members.
CREATE OR REPLACE FUNCTION public.list_assignable_instructors()
RETURNS TABLE (id uuid, full_name text, email text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_admin_anywhere(auth.uid()) OR public.is_super_admin(auth.uid())) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH instr AS (
    SELECT DISTINCT wm.profile_id
    FROM public.workspace_members wm
    WHERE wm.role = 'instructor'::app_role AND wm.status = 'active'
  ),
  elevated AS (
    SELECT DISTINCT wm.profile_id
    FROM public.workspace_members wm
    WHERE wm.role IN ('organization_admin'::app_role, 'super_admin'::app_role, 'staff'::app_role)
      AND wm.status = 'active'
  )
  SELECT p.id, p.full_name, p.email
  FROM instr i
  JOIN public.profiles p ON p.id = i.profile_id
  WHERE i.profile_id NOT IN (SELECT profile_id FROM elevated)
    AND NOT public.is_platform_owner(p.id)
  ORDER BY p.full_name NULLS LAST, p.email;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_assignable_instructors() TO authenticated;

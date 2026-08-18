-- Multi-instructor assignment table
CREATE TABLE IF NOT EXISTS public.course_instructors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  course_id uuid NOT NULL,
  instructor_id uuid NOT NULL,
  assigned_by uuid,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, instructor_id)
);

CREATE INDEX IF NOT EXISTS idx_course_instructors_instructor ON public.course_instructors(instructor_id);
CREATE INDEX IF NOT EXISTS idx_course_instructors_course ON public.course_instructors(course_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_instructors TO authenticated;
GRANT ALL ON public.course_instructors TO service_role;

ALTER TABLE public.course_instructors ENABLE ROW LEVEL SECURITY;

CREATE POLICY ci_read ON public.course_instructors
  FOR SELECT TO authenticated
  USING (instructor_id = auth.uid() OR public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY ci_manage ON public.course_instructors
  FOR ALL TO authenticated
  USING (public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin','staff','super_admin']::app_role[]))
  WITH CHECK (public.has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin','staff','super_admin']::app_role[]));

-- Extend is_course_instructor to include co-instructors
CREATE OR REPLACE FUNCTION public.is_course_instructor(_user_id uuid, _course_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.courses WHERE id = _course_id AND instructor_id = _user_id)
      OR EXISTS (SELECT 1 FROM public.course_instructors WHERE course_id = _course_id AND instructor_id = _user_id);
$$;

-- Allow co-instructors to read assigned courses (even cross-workspace)
DROP POLICY IF EXISTS courses_co_instructor_read ON public.courses;
CREATE POLICY courses_co_instructor_read ON public.courses
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.course_instructors ci WHERE ci.course_id = courses.id AND ci.instructor_id = auth.uid()));

-- Seed: assign Harsh Bardahan as co-instructor of Digital Marketing
INSERT INTO public.course_instructors (workspace_id, course_id, instructor_id)
SELECT workspace_id, id, '755bbc48-e2d3-42be-beb9-5f039735c441'
FROM public.courses
WHERE title = 'Digital Marketing'
ON CONFLICT (course_id, instructor_id) DO NOTHING;
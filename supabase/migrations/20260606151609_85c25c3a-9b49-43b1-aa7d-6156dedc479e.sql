-- Allow any user who is an instructor on at least one course (either as
-- owner via courses.instructor_id or as co-instructor via course_instructors)
-- to read every course in the database. This powers the course picker in
-- Lessons, Quizzes, Assignments, Live Classes, Certificates, etc. for
-- instructor accounts whose workspace_members role is still 'student'.

CREATE OR REPLACE FUNCTION public.is_any_course_instructor(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.course_instructors WHERE instructor_id = _user_id)
      OR EXISTS (SELECT 1 FROM public.courses WHERE instructor_id = _user_id);
$$;

DROP POLICY IF EXISTS "Instructors can read all courses" ON public.courses;
CREATE POLICY "Instructors can read all courses"
ON public.courses
FOR SELECT
TO authenticated
USING (public.is_any_course_instructor(auth.uid()));

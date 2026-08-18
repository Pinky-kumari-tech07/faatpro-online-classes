DROP POLICY IF EXISTS "Admins instructors staff can read all courses" ON public.courses;

CREATE POLICY "Admins instructors staff can read all courses"
ON public.courses
FOR SELECT
TO authenticated
USING (public.is_workspace_staff_anywhere(auth.uid()));
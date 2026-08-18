CREATE POLICY "courses_instructor_read"
ON public.courses
FOR SELECT
TO authenticated
USING (instructor_id = auth.uid());
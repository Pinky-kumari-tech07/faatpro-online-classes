CREATE POLICY courses_enrolled_read ON public.courses
  FOR SELECT TO authenticated
  USING (public.is_enrolled(auth.uid(), id));

CREATE POLICY sections_enrolled_read ON public.course_sections
  FOR SELECT TO authenticated
  USING (public.is_enrolled(auth.uid(), course_id));
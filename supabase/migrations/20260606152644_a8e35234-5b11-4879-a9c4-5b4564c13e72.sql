CREATE POLICY "Course instructors can read enrollments"
ON public.enrollments FOR SELECT
USING (public.is_course_instructor(auth.uid(), course_id));

CREATE POLICY "Course instructors can read lesson progress"
ON public.lesson_progress FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.lessons l
  WHERE l.id = lesson_progress.lesson_id
    AND public.is_course_instructor(auth.uid(), l.course_id)
));
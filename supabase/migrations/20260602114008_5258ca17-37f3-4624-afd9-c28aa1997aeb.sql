
-- Add missing foreign keys so PostgREST can embed related rows
DELETE FROM public.live_classes WHERE course_id IS NOT NULL AND course_id NOT IN (SELECT id FROM public.courses);
UPDATE public.live_classes SET instructor_id = NULL WHERE instructor_id IS NOT NULL AND instructor_id NOT IN (SELECT id FROM public.profiles);
DELETE FROM public.live_classes WHERE workspace_id NOT IN (SELECT id FROM public.workspaces);

ALTER TABLE public.live_classes
  ADD CONSTRAINT live_classes_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE,
  ADD CONSTRAINT live_classes_instructor_id_fkey FOREIGN KEY (instructor_id) REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD CONSTRAINT live_classes_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- Allow enrolled students and course instructors to read live classes even if not workspace members
DROP POLICY IF EXISTS live_classes_read ON public.live_classes;
CREATE POLICY live_classes_read ON public.live_classes
  FOR SELECT
  USING (
    is_workspace_member(auth.uid(), workspace_id)
    OR is_enrolled(auth.uid(), course_id)
    OR is_course_instructor(auth.uid(), course_id)
  );

NOTIFY pgrst, 'reload schema';

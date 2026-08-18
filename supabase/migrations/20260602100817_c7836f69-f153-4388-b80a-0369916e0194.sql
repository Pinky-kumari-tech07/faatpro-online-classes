
-- Remove orphans before adding FKs
DELETE FROM public.certificates WHERE course_id NOT IN (SELECT id FROM public.courses);
DELETE FROM public.certificates WHERE student_id NOT IN (SELECT id FROM public.profiles);
DELETE FROM public.certificates WHERE workspace_id NOT IN (SELECT id FROM public.workspaces);
UPDATE public.certificates SET template_id = NULL WHERE template_id IS NOT NULL AND template_id NOT IN (SELECT id FROM public.certificate_templates);

ALTER TABLE public.certificates
  ADD CONSTRAINT certificates_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE,
  ADD CONSTRAINT certificates_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD CONSTRAINT certificates_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE,
  ADD CONSTRAINT certificates_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.certificate_templates(id) ON DELETE SET NULL;

NOTIFY pgrst, 'reload schema';

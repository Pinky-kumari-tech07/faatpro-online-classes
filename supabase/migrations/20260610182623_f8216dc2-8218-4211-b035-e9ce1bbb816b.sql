
DROP POLICY IF EXISTS category_icons_auth_insert ON storage.objects;
DROP POLICY IF EXISTS category_icons_auth_update ON storage.objects;
DROP POLICY IF EXISTS category_icons_auth_delete ON storage.objects;

CREATE POLICY category_icons_staff_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'category-icons' AND public.is_workspace_staff_anywhere(auth.uid()));
CREATE POLICY category_icons_staff_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'category-icons' AND public.is_workspace_staff_anywhere(auth.uid()))
  WITH CHECK (bucket_id = 'category-icons' AND public.is_workspace_staff_anywhere(auth.uid()));
CREATE POLICY category_icons_staff_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'category-icons' AND public.is_workspace_staff_anywhere(auth.uid()));

DROP POLICY IF EXISTS lesson_files_public_read ON storage.objects;
DROP POLICY IF EXISTS lesson_files_read ON storage.objects;
CREATE POLICY lesson_files_read ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'lesson-files' AND (
      public.is_workspace_staff_anywhere(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.lessons l
        JOIN public.courses c ON c.id = l.course_id
        WHERE (storage.foldername(name))[1] = c.id::text
          AND public.is_enrolled(auth.uid(), c.id)
      )
    )
  );

DROP POLICY IF EXISTS realtime_authenticated_only ON public.messages;

REVOKE SELECT ON public.profiles FROM anon;
GRANT SELECT (id, full_name, avatar_url, bio, designation, qualification, expertise, years_experience, linkedin_url, social_links)
  ON public.profiles TO anon;

ALTER PUBLICATION supabase_realtime DROP TABLE public.quiz_questions;
ALTER PUBLICATION supabase_realtime DROP TABLE public.support_tickets;
ALTER PUBLICATION supabase_realtime DROP TABLE public.support_messages;

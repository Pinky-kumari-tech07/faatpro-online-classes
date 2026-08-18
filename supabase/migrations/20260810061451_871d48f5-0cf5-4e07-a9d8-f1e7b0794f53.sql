-- course-thumbnails bucket had NO storage policies at all, so every upload failed.
DROP POLICY IF EXISTS course_thumbnails_public_read ON storage.objects;
CREATE POLICY course_thumbnails_public_read ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'course-thumbnails');

DROP POLICY IF EXISTS course_thumbnails_staff_insert ON storage.objects;
CREATE POLICY course_thumbnails_staff_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'course-thumbnails' AND public.is_workspace_staff_anywhere(auth.uid()));

DROP POLICY IF EXISTS course_thumbnails_staff_update ON storage.objects;
CREATE POLICY course_thumbnails_staff_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'course-thumbnails' AND public.is_workspace_staff_anywhere(auth.uid()))
  WITH CHECK (bucket_id = 'course-thumbnails' AND public.is_workspace_staff_anywhere(auth.uid()));

DROP POLICY IF EXISTS course_thumbnails_staff_delete ON storage.objects;
CREATE POLICY course_thumbnails_staff_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'course-thumbnails' AND public.is_workspace_staff_anywhere(auth.uid()));

-- lesson-files read policy checked folder[1] (workspace id) against course id,
-- so enrolled students could never read a file. Paths are:
--   <workspace_id>/<course_id>/<file>  or  <workspace_id>/course-<course_id>/<file>
DROP POLICY IF EXISTS lesson_files_read ON storage.objects;
CREATE POLICY lesson_files_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'lesson-files'
    AND (
      public.is_workspace_staff_anywhere(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.courses c
        WHERE (storage.foldername(name))[2] IN (c.id::text, 'course-' || c.id::text)
          AND public.is_enrolled(auth.uid(), c.id)
      )
    )
  );
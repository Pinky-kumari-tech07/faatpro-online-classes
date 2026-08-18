
-- Instructors: full control over their own folder (folder = user_id)
CREATE POLICY "instructor_docs_own_select" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'instructor-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "instructor_docs_own_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'instructor-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "instructor_docs_own_update" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'instructor-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'instructor-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "instructor_docs_own_delete" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'instructor-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Admins/staff: read any instructor's documents for verification review
CREATE POLICY "instructor_docs_admin_read" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'instructor-documents'
  AND public.is_admin_or_staff_anywhere(auth.uid())
);

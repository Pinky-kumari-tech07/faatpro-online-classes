
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('lesson-files', 'lesson-files', true, 104857600, NULL)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "lesson_files_public_read" ON storage.objects;
DROP POLICY IF EXISTS "lesson_files_authenticated_write" ON storage.objects;
DROP POLICY IF EXISTS "lesson_files_authenticated_update" ON storage.objects;
DROP POLICY IF EXISTS "lesson_files_authenticated_delete" ON storage.objects;

CREATE POLICY "lesson_files_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'lesson-files');

CREATE POLICY "lesson_files_authenticated_write"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'lesson-files');

CREATE POLICY "lesson_files_authenticated_update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'lesson-files');

CREATE POLICY "lesson_files_authenticated_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'lesson-files');

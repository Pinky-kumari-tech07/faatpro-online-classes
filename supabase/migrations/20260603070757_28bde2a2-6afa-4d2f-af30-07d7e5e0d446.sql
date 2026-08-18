
DROP POLICY IF EXISTS category_icons_staff_insert ON storage.objects;
DROP POLICY IF EXISTS category_icons_staff_update ON storage.objects;
DROP POLICY IF EXISTS category_icons_staff_delete ON storage.objects;
DROP POLICY IF EXISTS category_icons_public_read ON storage.objects;

CREATE POLICY category_icons_public_read ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'category-icons');

CREATE POLICY category_icons_auth_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'category-icons');

CREATE POLICY category_icons_auth_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'category-icons')
  WITH CHECK (bucket_id = 'category-icons');

CREATE POLICY category_icons_auth_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'category-icons');

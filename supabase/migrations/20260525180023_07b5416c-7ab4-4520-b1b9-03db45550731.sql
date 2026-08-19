CREATE POLICY "courses_public_read"
ON public.courses FOR SELECT
TO anon, authenticated
USING (status = 'published' AND visibility = 'public');
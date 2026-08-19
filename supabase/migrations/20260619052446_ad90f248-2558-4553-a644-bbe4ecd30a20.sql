
-- site_pages: CMS-managed legal/policy pages
CREATE TABLE public.site_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  meta_title text,
  meta_description text,
  og_image_url text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.site_pages TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.site_pages TO authenticated;
GRANT ALL ON public.site_pages TO service_role;

ALTER TABLE public.site_pages ENABLE ROW LEVEL SECURITY;

-- Published pages are world-readable; admins/staff can read drafts too
CREATE POLICY "Published pages readable by anyone"
  ON public.site_pages FOR SELECT
  USING (status = 'published' OR public.is_admin_or_staff_anywhere(auth.uid()));

CREATE POLICY "Admins manage site pages"
  ON public.site_pages FOR ALL
  TO authenticated
  USING (public.is_admin_or_staff_anywhere(auth.uid()))
  WITH CHECK (public.is_admin_or_staff_anywhere(auth.uid()));

CREATE TRIGGER trg_site_pages_updated_at
  BEFORE UPDATE ON public.site_pages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Version history
CREATE TABLE public.site_page_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES public.site_pages(id) ON DELETE CASCADE,
  version_number int NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  meta_title text,
  meta_description text,
  og_image_url text,
  status text NOT NULL,
  edited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (page_id, version_number)
);

GRANT SELECT, INSERT ON public.site_page_versions TO authenticated;
GRANT ALL ON public.site_page_versions TO service_role;

ALTER TABLE public.site_page_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read versions"
  ON public.site_page_versions FOR SELECT
  TO authenticated
  USING (public.is_admin_or_staff_anywhere(auth.uid()));

CREATE POLICY "Admins create versions"
  ON public.site_page_versions FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_staff_anywhere(auth.uid()));

-- Trigger: snapshot a version on UPDATE (after, so we capture the new state)
CREATE OR REPLACE FUNCTION public.site_pages_snapshot_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _next int;
BEGIN
  SELECT COALESCE(MAX(version_number), 0) + 1 INTO _next
    FROM public.site_page_versions WHERE page_id = NEW.id;
  INSERT INTO public.site_page_versions (
    page_id, version_number, title, content, meta_title, meta_description,
    og_image_url, status, edited_by
  ) VALUES (
    NEW.id, _next, NEW.title, NEW.content, NEW.meta_title, NEW.meta_description,
    NEW.og_image_url, NEW.status, NEW.updated_by
  );
  RETURN NEW;
END $$;

CREATE TRIGGER trg_site_pages_snapshot
  AFTER INSERT OR UPDATE ON public.site_pages
  FOR EACH ROW EXECUTE FUNCTION public.site_pages_snapshot_version();

-- Seed the four policy pages with starter content
INSERT INTO public.site_pages (slug, title, content, meta_title, meta_description, status, published_at)
VALUES
  ('privacy-policy', 'Privacy Policy',
   '<p>FAATPRO respects your privacy. This policy explains what data we collect and how we use it.</p><h2>Information we collect</h2><ul><li>Account profile, email, and learning activity</li><li>Course progress, quiz, assignment, and certificate records</li></ul><h2>How we use your data</h2><ul><li>To deliver courses, certificates, and notifications</li><li>To improve the platform and personalize learning</li></ul>',
   'Privacy Policy | FAATPRO',
   'How FAATPRO collects, uses and protects your personal data.',
   'published', now()),
  ('terms-and-conditions', 'Terms & Conditions',
   '<p>By using FAATPRO you agree to these terms.</p><ul><li>Provide accurate information when creating an account.</li><li>Do not share login access with anyone else.</li><li>Instructors must upload original or properly licensed content.</li><li>Accounts may be suspended for policy violations.</li></ul>',
   'Terms & Conditions | FAATPRO',
   'The terms governing your use of the FAATPRO platform.',
   'published', now()),
  ('return-refund-policy', 'Return & Refund Policy',
   '<p>We want learners to be confident in their purchase.</p><h2>Eligibility</h2><ul><li>Refund requests must be raised within 7 days of purchase.</li><li>Course progress must be below 20%% to qualify.</li></ul><h2>Process</h2><p>Email support@faatpro.com with your order details. Approved refunds are processed within 7-10 business days.</p>',
   'Return & Refund Policy | FAATPRO',
   'FAATPRO refund eligibility and process for course purchases.',
   'published', now()),
  ('code-of-conduct', 'Code of Conduct',
   '<p>FAATPRO is a respectful learning community.</p><ul><li>Respect instructors and fellow learners at all times.</li><li>No harassment, hate speech, spam, plagiarism, or cheating.</li><li>No unauthorized sharing or redistribution of paid course content.</li><li>Instructors must provide professional, safe, and truthful learning material.</li></ul>',
   'Code of Conduct | FAATPRO',
   'Community standards and expected behavior on FAATPRO.',
   'published', now());

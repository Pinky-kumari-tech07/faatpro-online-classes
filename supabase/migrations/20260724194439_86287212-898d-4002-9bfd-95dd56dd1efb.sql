
-- Remove anon table read; public catalog now goes through a safe RPC
REVOKE SELECT ON public.live_classes FROM anon;

-- Tighten SELECT policy: drop the is_public=true branch that exposed meeting_url / meeting_password
DROP POLICY IF EXISTS live_classes_public_read ON public.live_classes;

CREATE POLICY live_classes_authorized_read
  ON public.live_classes FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND (
      is_admin_or_staff_anywhere(auth.uid())
      OR (course_id IS NOT NULL AND is_course_instructor(auth.uid(), course_id))
      OR (course_id IS NOT NULL AND is_enrolled(auth.uid(), course_id))
      OR (auth.uid() = ANY (assigned_student_ids))
      OR (bundle_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM student_bundles sb
         WHERE sb.bundle_id = live_classes.bundle_id
           AND sb.student_id = auth.uid()
           AND sb.status = 'active'
      ))
      OR (batch_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM batch_students bs
         WHERE bs.batch_id = live_classes.batch_id
           AND bs.student_id = auth.uid()
      ))
      OR (institution_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM institution_students ist
         WHERE ist.institution_id = live_classes.institution_id
           AND ist.student_id = auth.uid()
      ))
    )
  );

-- Safe public listing: only marketing metadata, never meeting_url / meeting_password
CREATE OR REPLACE FUNCTION public.get_public_live_classes(_limit int DEFAULT 24)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  starts_at timestamptz,
  ends_at timestamptz,
  status live_class_status,
  banner_url text,
  thumbnail_url text,
  price numeric,
  max_participants integer,
  timezone text,
  course_title text,
  instructor_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lc.id, lc.title, lc.description, lc.starts_at, lc.ends_at, lc.status,
         lc.banner_url, lc.thumbnail_url, lc.price, lc.max_participants, lc.timezone,
         c.title AS course_title,
         p.full_name AS instructor_name
    FROM public.live_classes lc
    LEFT JOIN public.courses c ON c.id = lc.course_id
    LEFT JOIN public.profiles p ON p.id = lc.instructor_id
   WHERE lc.is_public = true
     AND lc.status <> 'cancelled'
     AND lc.starts_at >= now() - interval '3 hours'
   ORDER BY lc.starts_at ASC
   LIMIT GREATEST(1, LEAST(coalesce(_limit, 24), 100));
$$;

GRANT EXECUTE ON FUNCTION public.get_public_live_classes(int) TO anon, authenticated, service_role;

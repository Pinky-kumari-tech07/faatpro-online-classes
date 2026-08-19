
-- 1. contact_messages
DROP POLICY IF EXISTS contact_admin_read ON public.contact_messages;
DROP POLICY IF EXISTS contact_admin_update ON public.contact_messages;

CREATE POLICY contact_admin_read ON public.contact_messages
FOR SELECT TO authenticated
USING (
  (workspace_id IS NOT NULL AND has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role, 'staff'::app_role, 'super_admin'::app_role]))
  OR (workspace_id IS NULL AND is_super_admin(auth.uid()))
);

CREATE POLICY contact_admin_update ON public.contact_messages
FOR UPDATE TO authenticated
USING (
  (workspace_id IS NOT NULL AND has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role, 'staff'::app_role, 'super_admin'::app_role]))
  OR (workspace_id IS NULL AND is_super_admin(auth.uid()))
);

-- 2. coupons
DROP POLICY IF EXISTS coupons_read ON public.coupons;
CREATE POLICY coupons_read ON public.coupons
FOR SELECT TO authenticated
USING (has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role, 'staff'::app_role, 'super_admin'::app_role]));

-- 3. quiz_questions: hide correct_answers from students via column-level grants
REVOKE SELECT ON public.quiz_questions FROM authenticated;
GRANT SELECT (id, workspace_id, quiz_id, question_type, prompt, options, points, position) ON public.quiz_questions TO authenticated;

CREATE OR REPLACE FUNCTION public.get_quiz_correct_answers(_question_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ws uuid;
  _answers jsonb;
BEGIN
  SELECT workspace_id, correct_answers INTO _ws, _answers
  FROM public.quiz_questions WHERE id = _question_id;
  IF _ws IS NULL THEN RETURN NULL; END IF;
  IF has_any_workspace_role(auth.uid(), _ws, ARRAY['organization_admin'::app_role, 'staff'::app_role, 'super_admin'::app_role, 'instructor'::app_role]) THEN
    RETURN _answers;
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.get_quiz_correct_answers(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_quiz_correct_answers(uuid) TO authenticated;

-- Helper to check if current user is staff/instructor in any workspace
CREATE OR REPLACE FUNCTION public.is_workspace_staff_anywhere(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE profile_id = _user_id
      AND status = 'active'
      AND role IN ('organization_admin'::app_role, 'staff'::app_role, 'super_admin'::app_role, 'instructor'::app_role)
  );
$$;
REVOKE ALL ON FUNCTION public.is_workspace_staff_anywhere(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_workspace_staff_anywhere(uuid) TO authenticated;

-- 4. category-icons bucket: staff-only writes
DROP POLICY IF EXISTS "Authenticated can upload category icons" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update category icons" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete category icons" ON storage.objects;

CREATE POLICY "category_icons_staff_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'category-icons' AND public.is_workspace_staff_anywhere(auth.uid()));
CREATE POLICY "category_icons_staff_update" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'category-icons' AND public.is_workspace_staff_anywhere(auth.uid()));
CREATE POLICY "category_icons_staff_delete" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'category-icons' AND public.is_workspace_staff_anywhere(auth.uid()));

-- 5. lesson-files bucket
DROP POLICY IF EXISTS lesson_files_authenticated_write ON storage.objects;
DROP POLICY IF EXISTS lesson_files_authenticated_update ON storage.objects;
DROP POLICY IF EXISTS lesson_files_authenticated_delete ON storage.objects;

CREATE POLICY "lesson_files_staff_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'lesson-files' AND public.is_workspace_staff_anywhere(auth.uid()));
CREATE POLICY "lesson_files_staff_update" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'lesson-files' AND public.is_workspace_staff_anywhere(auth.uid()));
CREATE POLICY "lesson_files_staff_delete" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'lesson-files' AND public.is_workspace_staff_anywhere(auth.uid()));

-- 6. Remove broad listing SELECT policies on public buckets
DROP POLICY IF EXISTS "Category icons publicly readable" ON storage.objects;
DROP POLICY IF EXISTS lesson_files_public_read ON storage.objects;
DROP POLICY IF EXISTS cert_assets_public_read ON storage.objects;

-- 7. search_path on trigger function
ALTER FUNCTION public.set_updated_at() SET search_path = public;

-- 8. realtime.messages basic policy
DO $$
BEGIN
  EXECUTE 'ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY';
EXCEPTION WHEN others THEN NULL;
END $$;

DROP POLICY IF EXISTS "realtime_authenticated_only" ON realtime.messages;
CREATE POLICY "realtime_authenticated_only" ON realtime.messages
FOR SELECT TO authenticated USING (true);

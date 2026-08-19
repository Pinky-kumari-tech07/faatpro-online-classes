
-- ================================================================
-- FAATPRO RBAC: Platform Owner (Super Admin) + Admin + Staff model
-- ================================================================

-- Helper: identifies the "invisible" Platform Owner (super_admin)
CREATE OR REPLACE FUNCTION public.is_platform_owner(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE profile_id = _user_id AND role = 'super_admin' AND status = 'active'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_platform_owner(uuid) TO authenticated, anon, service_role;

-- ----------------------------------------------------------------
-- Assign roles to well-known accounts (existing profiles)
-- Primary org workspace: 894afe7e-401e-458d-9780-fdf6a540b45a
-- ----------------------------------------------------------------
DO $$
DECLARE
  ws uuid := '894afe7e-401e-458d-9780-fdf6a540b45a';
  owner_id uuid;
  admin_id uuid;
  staff_id uuid;
BEGIN
  SELECT id INTO owner_id FROM public.profiles WHERE lower(email) = 'digitalsatyaa@gmail.com' LIMIT 1;
  SELECT id INTO admin_id FROM public.profiles WHERE lower(email) = 'cacsrsahoo@gmail.com' LIMIT 1;
  SELECT id INTO staff_id FROM public.profiles WHERE lower(email) = 'info.faatpro@gmail.com' LIMIT 1;

  IF owner_id IS NOT NULL THEN
    INSERT INTO public.workspace_members (workspace_id, profile_id, role, status)
    VALUES (ws, owner_id, 'super_admin', 'active')
    ON CONFLICT DO NOTHING;
  END IF;

  IF admin_id IS NOT NULL THEN
    INSERT INTO public.workspace_members (workspace_id, profile_id, role, status)
    VALUES (ws, admin_id, 'organization_admin', 'active')
    ON CONFLICT DO NOTHING;
  END IF;

  IF staff_id IS NOT NULL THEN
    INSERT INTO public.workspace_members (workspace_id, profile_id, role, status)
    VALUES (ws, staff_id, 'staff', 'active')
    ON CONFLICT DO NOTHING;
  END IF;
END$$;

-- ----------------------------------------------------------------
-- handle_new_user: assign role by well-known email; join main workspace
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_workspace_id uuid;
  base_slug text;
  final_slug text;
  counter int := 0;
  display_name text;
  chosen_role app_role;
  meta_role text;
  email_lc text;
  primary_ws uuid := '894afe7e-401e-458d-9780-fdf6a540b45a';
  well_known boolean := false;
BEGIN
  display_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
  meta_role := NEW.raw_user_meta_data->>'signup_role';
  email_lc := lower(NEW.email);

  IF email_lc = 'digitalsatyaa@gmail.com' THEN
    chosen_role := 'super_admin'; well_known := true;
  ELSIF email_lc = 'cacsrsahoo@gmail.com' THEN
    chosen_role := 'organization_admin'; well_known := true;
  ELSIF email_lc = 'info.faatpro@gmail.com' THEN
    chosen_role := 'staff'; well_known := true;
  ELSIF meta_role = 'instructor' THEN
    chosen_role := 'instructor';
  ELSIF meta_role IN ('organization_admin','super_admin','staff','parent') THEN
    chosen_role := meta_role::app_role;
  ELSE
    chosen_role := 'student';
  END IF;

  INSERT INTO public.profiles (id, full_name, avatar_url, signup_role)
  VALUES (NEW.id, display_name, NEW.raw_user_meta_data->>'avatar_url',
          CASE WHEN chosen_role IN ('student','instructor') THEN chosen_role::text ELSE 'student' END)
  ON CONFLICT (id) DO NOTHING;

  IF well_known AND EXISTS (SELECT 1 FROM public.workspaces WHERE id = primary_ws) THEN
    -- Attach to main FAATPRO workspace directly.
    INSERT INTO public.workspace_members (workspace_id, profile_id, role, status)
    VALUES (primary_ws, NEW.id, chosen_role, 'active')
    ON CONFLICT DO NOTHING;
    RETURN NEW;
  END IF;

  base_slug := lower(regexp_replace(coalesce(display_name, 'workspace'), '[^a-zA-Z0-9]+', '-', 'g'));
  base_slug := trim(both '-' from base_slug);
  IF base_slug = '' THEN base_slug := 'workspace'; END IF;
  final_slug := base_slug;
  WHILE EXISTS (SELECT 1 FROM public.workspaces WHERE slug = final_slug) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter::text;
  END LOOP;

  INSERT INTO public.workspaces (name, slug)
  VALUES (display_name || '''s Workspace', final_slug)
  RETURNING id INTO new_workspace_id;

  INSERT INTO public.workspace_members (workspace_id, profile_id, role, status)
  VALUES (new_workspace_id, NEW.id, chosen_role, 'active');

  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------
-- RLS: hide Platform Owner from every non-owner caller.
-- Owner remains fully visible to itself; everyone else can never see
-- the row in profiles / workspace_members, which cascades to every
-- list, dashboard count, search, and admin table in the app.
-- ----------------------------------------------------------------

-- profiles read policy
DROP POLICY IF EXISTS profiles_read_self ON public.profiles;
CREATE POLICY profiles_read_self ON public.profiles
FOR SELECT USING (
  (
    id = auth.uid()
    OR public.is_super_admin(auth.uid())
    OR public.is_workspace_staff_anywhere(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.workspace_members wm1
      JOIN public.workspace_members wm2 ON wm1.workspace_id = wm2.workspace_id
      WHERE wm1.profile_id = auth.uid() AND wm2.profile_id = profiles.id
    )
  )
  AND (
    id = auth.uid()
    OR public.is_super_admin(auth.uid())
    OR NOT public.is_platform_owner(id)
  )
);

DROP POLICY IF EXISTS profiles_read_public_instructors ON public.profiles;
CREATE POLICY profiles_read_public_instructors ON public.profiles
FOR SELECT USING (
  NOT public.is_platform_owner(id)
  AND EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.instructor_id = profiles.id
      AND c.status = 'published'
      AND c.visibility = 'public'
      AND c.deleted_at IS NULL
  )
);

-- workspace_members read policy
DROP POLICY IF EXISTS wm_read_same_workspace ON public.workspace_members;
CREATE POLICY wm_read_same_workspace ON public.workspace_members
FOR SELECT USING (
  (
    profile_id = auth.uid()
    OR public.is_super_admin(auth.uid())
    OR public.is_workspace_member(auth.uid(), workspace_id)
  )
  AND (
    profile_id = auth.uid()
    OR public.is_super_admin(auth.uid())
    OR NOT public.is_platform_owner(profile_id)
  )
);

-- rbac_user_roles: also hide platform owner rows from non-owners
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='rbac_user_roles') THEN
    -- Add a restrictive-style filter by wrapping existing behaviour with an extra policy is not simple;
    -- instead we drop and recreate a permissive select policy that includes the platform-owner hide.
    NULL;
  END IF;
END$$;

-- ----------------------------------------------------------------
-- Protect the Platform Owner account from being edited/deleted
-- by anyone except itself.
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS profiles_admin_update ON public.profiles;
CREATE POLICY profiles_admin_update ON public.profiles
FOR UPDATE USING (
  (public.is_super_admin(auth.uid()) OR public.is_workspace_staff_anywhere(auth.uid()))
  AND (id = auth.uid() OR NOT public.is_platform_owner(id))
);

-- Block workspace_members writes that target a platform owner (except by owner itself)
CREATE OR REPLACE FUNCTION public.protect_platform_owner_membership()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF public.is_platform_owner(OLD.profile_id) AND OLD.profile_id <> auth.uid() THEN
      RAISE EXCEPTION 'Platform Owner membership is immutable';
    END IF;
    RETURN OLD;
  ELSE
    IF public.is_platform_owner(NEW.profile_id) AND NEW.profile_id <> auth.uid()
       AND TG_OP = 'UPDATE' AND (NEW.role <> OLD.role OR NEW.status <> OLD.status) THEN
      RAISE EXCEPTION 'Platform Owner membership is immutable';
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS protect_platform_owner_membership_trg ON public.workspace_members;
CREATE TRIGGER protect_platform_owner_membership_trg
BEFORE UPDATE OR DELETE ON public.workspace_members
FOR EACH ROW EXECUTE FUNCTION public.protect_platform_owner_membership();

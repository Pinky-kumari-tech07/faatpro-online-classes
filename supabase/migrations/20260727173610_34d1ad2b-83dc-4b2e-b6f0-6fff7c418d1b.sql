
-- 1) Authoritative role application RPC (used post-signup, incl. Google OAuth callback)
CREATE OR REPLACE FUNCTION public.apply_signup_role(desired_role app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  existing_signup text;
  primary_ws uuid;
  has_elevated boolean;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF desired_role NOT IN ('student','instructor') THEN
    RAISE EXCEPTION 'apply_signup_role only accepts student or instructor';
  END IF;

  -- Never downgrade elevated roles.
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE profile_id = uid
      AND status = 'active'
      AND role IN ('super_admin','organization_admin','instructor','staff')
  ) INTO has_elevated;

  SELECT signup_role INTO existing_signup FROM public.profiles WHERE id = uid;

  -- If already elevated OR signup_role already non-student, do nothing when downgrading.
  IF has_elevated AND desired_role = 'student' THEN
    RETURN;
  END IF;
  IF existing_signup IS NOT NULL
     AND existing_signup <> 'student'
     AND desired_role = 'student' THEN
    RETURN;
  END IF;

  UPDATE public.profiles
     SET signup_role = desired_role::text
   WHERE id = uid;

  -- Update the user's primary (first) workspace membership.
  SELECT workspace_id INTO primary_ws
  FROM public.workspace_members
  WHERE profile_id = uid
  ORDER BY created_at ASC
  LIMIT 1;

  IF primary_ws IS NOT NULL THEN
    -- Ensure the desired role exists (idempotent).
    INSERT INTO public.workspace_members (workspace_id, profile_id, role, status)
    VALUES (primary_ws, uid, desired_role, 'active')
    ON CONFLICT (workspace_id, profile_id, role) DO UPDATE
      SET status = 'active';

    -- If promoting to instructor, drop the auto-created student row in the same workspace.
    IF desired_role = 'instructor' THEN
      DELETE FROM public.workspace_members
       WHERE workspace_id = primary_ws
         AND profile_id = uid
         AND role = 'student'
         -- Only drop if the student membership was not created by an enrollment.
         AND NOT EXISTS (
           SELECT 1 FROM public.enrollments e
            WHERE e.student_id = uid AND e.workspace_id = primary_ws
         );
    END IF;
  END IF;

  -- Ensure instructor_profiles exists for instructors.
  IF desired_role = 'instructor' THEN
    INSERT INTO public.instructor_profiles (user_id)
    VALUES (uid)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_signup_role(app_role) FROM public;
GRANT EXECUTE ON FUNCTION public.apply_signup_role(app_role) TO authenticated;

-- 2) Guard: instructor_profiles requires an instructor membership (auto-provision if missing)
CREATE OR REPLACE FUNCTION public.enforce_instructor_role_for_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_instr boolean;
  primary_ws uuid;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE profile_id = NEW.user_id
      AND role = 'instructor'
      AND status = 'active'
  ) INTO has_instr;

  IF has_instr THEN
    RETURN NEW;
  END IF;

  -- Auto-provision instructor membership in the user's primary workspace.
  SELECT workspace_id INTO primary_ws
    FROM public.workspace_members
   WHERE profile_id = NEW.user_id
   ORDER BY created_at ASC
   LIMIT 1;

  IF primary_ws IS NULL THEN
    RAISE EXCEPTION 'Cannot create instructor profile: user has no workspace membership';
  END IF;

  INSERT INTO public.workspace_members (workspace_id, profile_id, role, status)
  VALUES (primary_ws, NEW.user_id, 'instructor', 'active')
  ON CONFLICT (workspace_id, profile_id, role) DO UPDATE SET status = 'active';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_instructor_role_for_profile ON public.instructor_profiles;
CREATE TRIGGER trg_enforce_instructor_role_for_profile
BEFORE INSERT ON public.instructor_profiles
FOR EACH ROW EXECUTE FUNCTION public.enforce_instructor_role_for_profile();

-- 3) Prevent removing the last instructor membership while an instructor profile still exists
CREATE OR REPLACE FUNCTION public.protect_instructor_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_profile uuid;
  has_profile boolean;
  remaining int;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_profile := OLD.profile_id;
    IF OLD.role <> 'instructor' THEN RETURN OLD; END IF;
  ELSE
    target_profile := NEW.profile_id;
    IF OLD.role = 'instructor' AND (NEW.role <> 'instructor' OR NEW.status <> 'active') THEN
      -- treat as a removal for counting purposes
      NULL;
    ELSE
      RETURN NEW;
    END IF;
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.instructor_profiles WHERE user_id = target_profile)
    INTO has_profile;
  IF NOT has_profile THEN
    RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
  END IF;

  SELECT count(*) INTO remaining
  FROM public.workspace_members
  WHERE profile_id = target_profile
    AND role = 'instructor'
    AND status = 'active'
    AND id <> COALESCE(NEW.id, OLD.id);

  IF remaining = 0 THEN
    RAISE EXCEPTION 'Cannot remove the last instructor membership while instructor profile still exists (user %). Delete instructor_profiles first.', target_profile;
  END IF;

  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_instructor_membership ON public.workspace_members;
CREATE TRIGGER trg_protect_instructor_membership
BEFORE UPDATE OR DELETE ON public.workspace_members
FOR EACH ROW EXECUTE FUNCTION public.protect_instructor_membership();

-- 4) Update handle_new_user to also seed instructor_profiles for instructor signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  INSERT INTO public.profiles (id, email, full_name, signup_role)
  VALUES (NEW.id, NEW.email, display_name, chosen_role::text)
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
        signup_role = COALESCE(public.profiles.signup_role, EXCLUDED.signup_role);

  IF well_known THEN
    INSERT INTO public.workspace_members (workspace_id, profile_id, role, status)
    VALUES (primary_ws, NEW.id, chosen_role, 'active')
    ON CONFLICT DO NOTHING;

    IF chosen_role = 'instructor' THEN
      INSERT INTO public.instructor_profiles (user_id)
      VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
    END IF;

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
  VALUES (new_workspace_id, NEW.id, chosen_role, 'active')
  ON CONFLICT (workspace_id, profile_id, role) DO NOTHING;

  IF chosen_role = 'instructor' THEN
    INSERT INTO public.instructor_profiles (user_id)
    VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

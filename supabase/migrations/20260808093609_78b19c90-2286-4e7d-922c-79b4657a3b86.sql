
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  new_workspace_id uuid;
  base_slug text;
  final_slug text;
  counter int := 0;
  display_name text;
  chosen_role app_role;
  meta_role text;
  email_lc text;
  meta_phone text;
  primary_ws uuid := '894afe7e-401e-458d-9780-fdf6a540b45a';
  well_known boolean := false;
BEGIN
  display_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
  meta_role := NEW.raw_user_meta_data->>'signup_role';
  email_lc := lower(NEW.email);
  meta_phone := NULLIF(btrim(COALESCE(NEW.raw_user_meta_data->>'phone', '')), '');

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

  INSERT INTO public.profiles (id, email, full_name, signup_role, phone)
  VALUES (NEW.id, NEW.email, display_name, chosen_role::text, meta_phone)
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
        phone = COALESCE(public.profiles.phone, EXCLUDED.phone),
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
$function$;

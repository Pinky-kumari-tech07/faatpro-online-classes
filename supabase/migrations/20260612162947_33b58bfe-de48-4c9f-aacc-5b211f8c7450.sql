
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_workspace_id uuid;
  base_slug text;
  final_slug text;
  counter int := 0;
  display_name text;
  chosen_role app_role;
  meta_role text;
BEGIN
  display_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
  meta_role := NEW.raw_user_meta_data->>'signup_role';

  IF meta_role = 'instructor' THEN
    chosen_role := 'instructor';
  ELSIF meta_role IN ('organization_admin','super_admin','staff','parent') THEN
    chosen_role := meta_role::app_role;
  ELSE
    -- Default: any new user (including Google OAuth) is a student.
    chosen_role := 'student';
  END IF;

  INSERT INTO public.profiles (id, full_name, avatar_url, signup_role)
  VALUES (NEW.id, display_name, NEW.raw_user_meta_data->>'avatar_url',
          CASE WHEN chosen_role IN ('student','instructor') THEN chosen_role::text ELSE 'student' END)
  ON CONFLICT (id) DO NOTHING;

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

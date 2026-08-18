
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;
UPDATE public.profiles p SET email = u.email FROM auth.users u WHERE u.id = p.id AND p.email IS NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_workspace_id uuid;
  base_slug text;
  final_slug text;
  counter int := 0;
  display_name text;
BEGIN
  display_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));

  INSERT INTO public.profiles (id, full_name, avatar_url, email)
  VALUES (NEW.id, display_name, NEW.raw_user_meta_data->>'avatar_url', NEW.email)
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

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
  VALUES (new_workspace_id, NEW.id, 'organization_admin', 'active');

  RETURN NEW;
END;
$function$;

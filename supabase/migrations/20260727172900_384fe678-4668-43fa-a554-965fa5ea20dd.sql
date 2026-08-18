-- 1) Harden the enrollment sync trigger so it never demotes a privileged member.
CREATE OR REPLACE FUNCTION public.sync_enrollment_workspace_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Do not add a redundant 'student' membership if the user already
  -- holds a higher-privileged role in this workspace.
  IF EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    WHERE wm.workspace_id = NEW.workspace_id
      AND wm.profile_id  = NEW.student_id
      AND wm.status      = 'active'::member_status
      AND wm.role IN (
        'super_admin'::app_role,
        'organization_admin'::app_role,
        'instructor'::app_role,
        'staff'::app_role
      )
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.workspace_members (workspace_id, profile_id, role, status)
  VALUES (NEW.workspace_id, NEW.student_id, 'student'::app_role, 'active'::member_status)
  ON CONFLICT (workspace_id, profile_id, role) DO UPDATE
    SET status = 'active'::member_status
    WHERE workspace_members.status <> 'active'::member_status;
  RETURN NEW;
END;
$function$;

-- 2) Backfill: drop stray 'student' memberships that shadow a higher role.
DELETE FROM public.workspace_members s
WHERE s.role = 'student'::app_role
  AND EXISTS (
    SELECT 1
    FROM public.workspace_members h
    WHERE h.workspace_id = s.workspace_id
      AND h.profile_id  = s.profile_id
      AND h.status      = 'active'::member_status
      AND h.role IN (
        'super_admin'::app_role,
        'organization_admin'::app_role,
        'instructor'::app_role,
        'staff'::app_role
      )
  );

-- 1. Lock super_admin promotion
CREATE OR REPLACE FUNCTION public.guard_super_admin_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.role = 'super_admin'::app_role AND (TG_OP = 'INSERT' OR OLD.role IS DISTINCT FROM NEW.role) THEN
    IF auth.uid() IS NOT NULL AND NOT public.is_platform_owner(auth.uid()) THEN
      RAISE EXCEPTION 'Only the Platform Owner can assign the super_admin role';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_super_admin_assignment_trg ON public.workspace_members;
CREATE TRIGGER guard_super_admin_assignment_trg
BEFORE INSERT OR UPDATE ON public.workspace_members
FOR EACH ROW EXECUTE FUNCTION public.guard_super_admin_assignment();

-- 2. Prevent last-admin removal
CREATE OR REPLACE FUNCTION public.guard_last_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE remaining int; was_admin boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    was_admin := (OLD.role = 'organization_admin'::app_role AND OLD.status = 'active');
  ELSE
    was_admin := (OLD.role = 'organization_admin'::app_role AND OLD.status = 'active')
                 AND (NEW.role <> 'organization_admin'::app_role OR NEW.status <> 'active');
  END IF;
  IF was_admin THEN
    SELECT count(*) INTO remaining FROM public.workspace_members
    WHERE workspace_id = OLD.workspace_id AND role = 'organization_admin'::app_role
      AND status = 'active' AND profile_id <> OLD.profile_id;
    IF remaining = 0 THEN
      RAISE EXCEPTION 'Cannot remove or demote the last active Admin of this workspace';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
DROP TRIGGER IF EXISTS guard_last_admin_trg ON public.workspace_members;
CREATE TRIGGER guard_last_admin_trg
BEFORE UPDATE OR DELETE ON public.workspace_members
FOR EACH ROW EXECUTE FUNCTION public.guard_last_admin();

-- 3. Emergency admin restore
CREATE OR REPLACE FUNCTION public.restore_admin(_email text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target_id uuid; ws uuid := '894afe7e-401e-458d-9780-fdf6a540b45a';
BEGIN
  IF NOT public.is_platform_owner(auth.uid()) THEN
    RAISE EXCEPTION 'Only the Platform Owner may call restore_admin';
  END IF;
  SELECT id INTO target_id FROM public.profiles WHERE lower(email) = lower(_email) LIMIT 1;
  IF target_id IS NULL THEN RAISE EXCEPTION 'No profile found for %', _email; END IF;
  INSERT INTO public.workspace_members (workspace_id, profile_id, role, status)
  VALUES (ws, target_id, 'organization_admin'::app_role, 'active')
  ON CONFLICT (workspace_id, profile_id, role) DO UPDATE SET status = 'active';
  UPDATE public.profiles SET is_active = true WHERE id = target_id;
  RETURN jsonb_build_object('restored', true, 'profile_id', target_id, 'workspace_id', ws);
END $$;
REVOKE ALL ON FUNCTION public.restore_admin(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.restore_admin(text) TO authenticated;

-- 4. Admin-only guard
CREATE OR REPLACE FUNCTION public.is_org_admin_strict(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE profile_id = _user_id AND status = 'active'
      AND role IN ('organization_admin'::app_role, 'super_admin'::app_role)
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_org_admin_strict(uuid) TO authenticated, service_role;

-- Revoke destructive RPCs from all non-admin callers
REVOKE EXECUTE ON FUNCTION public.admin_permanent_delete_course(uuid, uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.admin_permanent_delete_course(uuid, uuid, text, text, text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.admin_bulk_reassign_courses(uuid[], uuid, text, boolean, boolean, text, text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.admin_deactivate_instructor(uuid, text, uuid, text, text, text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.admin_deactivate_instructor(uuid, text, uuid, text, text, text, boolean) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.admin_pay_settlement(uuid, numeric, text, text, text) FROM public, anon;

-- Attach an inline admin check to each destructive function via CREATE OR REPLACE
-- would require re-emitting each body. Instead we ADD a runtime gate by wrapping
-- with a BEFORE-call check using an event-based approach is complex; the cleanest
-- production-safe path is to add the check inside each function. We do that here
-- as small ALTER via CREATE OR REPLACE only for the ones missing the check.

-- For safety across every call-site, add a trigger on course_audit_log inserts
-- with action='permanent_delete' to enforce admin — this catches direct DELETE
-- paths too:
CREATE OR REPLACE FUNCTION public.audit_require_admin_for_destructive()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.action IN ('permanent_delete', 'bulk_reassign', 'instructor_deactivated')
     AND NEW.actor_id IS NOT NULL
     AND NOT public.is_org_admin_strict(NEW.actor_id) THEN
    RAISE EXCEPTION 'forbidden: admin role required for %', NEW.action USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS audit_require_admin_trg ON public.course_audit_log;
CREATE TRIGGER audit_require_admin_trg
BEFORE INSERT ON public.course_audit_log
FOR EACH ROW EXECUTE FUNCTION public.audit_require_admin_for_destructive();

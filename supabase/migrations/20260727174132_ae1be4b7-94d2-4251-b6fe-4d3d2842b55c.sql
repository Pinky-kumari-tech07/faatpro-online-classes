
-- 1) Audit log table
CREATE TABLE IF NOT EXISTS public.role_change_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  workspace_id uuid,
  previous_role app_role,
  new_role app_role,
  action text NOT NULL CHECK (action IN ('insert','update','delete')),
  source text NOT NULL DEFAULT 'unknown',
  actor_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_role_audit_user ON public.role_change_audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_role_audit_workspace ON public.role_change_audit_log(workspace_id, created_at DESC);

GRANT SELECT ON public.role_change_audit_log TO authenticated;
GRANT ALL ON public.role_change_audit_log TO service_role;

ALTER TABLE public.role_change_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_admins_read"
ON public.role_change_audit_log
FOR SELECT
TO authenticated
USING (public.is_admin_anywhere(auth.uid()));

CREATE POLICY "audit_self_read"
ON public.role_change_audit_log
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- 2) Audit trigger on workspace_members
CREATE OR REPLACE FUNCTION public.log_workspace_member_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  src text;
BEGIN
  BEGIN
    src := current_setting('app.role_source', true);
  EXCEPTION WHEN OTHERS THEN
    src := NULL;
  END;
  IF src IS NULL OR src = '' THEN src := 'unknown'; END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.role_change_audit_log
      (user_id, workspace_id, previous_role, new_role, action, source, actor_id)
    VALUES (NEW.profile_id, NEW.workspace_id, NULL, NEW.role, 'insert', src, auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.role IS DISTINCT FROM NEW.role OR OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO public.role_change_audit_log
        (user_id, workspace_id, previous_role, new_role, action, source, actor_id, metadata)
      VALUES (NEW.profile_id, NEW.workspace_id, OLD.role, NEW.role, 'update', src, auth.uid(),
              jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status));
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.role_change_audit_log
      (user_id, workspace_id, previous_role, new_role, action, source, actor_id)
    VALUES (OLD.profile_id, OLD.workspace_id, OLD.role, NULL, 'delete', src, auth.uid());
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_workspace_member_change ON public.workspace_members;
CREATE TRIGGER trg_log_workspace_member_change
AFTER INSERT OR UPDATE OR DELETE ON public.workspace_members
FOR EACH ROW EXECUTE FUNCTION public.log_workspace_member_change();

-- 3) Role conflict guard: forbid student+privileged in the same workspace
CREATE OR REPLACE FUNCTION public.prevent_role_conflict()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  privileged app_role[] := ARRAY['instructor','staff','organization_admin','super_admin']::app_role[];
BEGIN
  IF NEW.status <> 'active' THEN RETURN NEW; END IF;

  IF NEW.role = 'student' THEN
    IF EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_id = NEW.workspace_id
        AND profile_id  = NEW.profile_id
        AND status = 'active'
        AND role = ANY(privileged)
        AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) THEN
      RAISE EXCEPTION 'Role conflict: user % already has a privileged role in workspace %', NEW.profile_id, NEW.workspace_id
        USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.role = ANY(privileged) THEN
    IF EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_id = NEW.workspace_id
        AND profile_id  = NEW.profile_id
        AND status = 'active'
        AND role = 'student'
        AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) THEN
      -- Auto-remove the student row instead of failing — this is the
      -- expected behaviour when promoting a former student to instructor.
      DELETE FROM public.workspace_members
       WHERE workspace_id = NEW.workspace_id
         AND profile_id = NEW.profile_id
         AND role = 'student';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_role_conflict ON public.workspace_members;
CREATE TRIGGER trg_prevent_role_conflict
BEFORE INSERT OR UPDATE ON public.workspace_members
FOR EACH ROW EXECUTE FUNCTION public.prevent_role_conflict();

-- Backfill: remove any pre-existing student rows that coexist with a privileged role
DELETE FROM public.workspace_members wm
WHERE wm.role = 'student'
  AND wm.status = 'active'
  AND EXISTS (
    SELECT 1 FROM public.workspace_members wm2
    WHERE wm2.workspace_id = wm.workspace_id
      AND wm2.profile_id = wm.profile_id
      AND wm2.status = 'active'
      AND wm2.role IN ('instructor','staff','organization_admin','super_admin')
  );

-- 4) Enhance apply_signup_role with a source tag captured by the audit trigger
CREATE OR REPLACE FUNCTION public.apply_signup_role(desired_role app_role, source text DEFAULT 'unknown')
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

  PERFORM set_config('app.role_source', COALESCE(source, 'unknown'), true);

  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE profile_id = uid AND status = 'active'
      AND role IN ('super_admin','organization_admin','instructor','staff')
  ) INTO has_elevated;

  SELECT signup_role INTO existing_signup FROM public.profiles WHERE id = uid;

  IF has_elevated AND desired_role = 'student' THEN RETURN; END IF;
  IF existing_signup IS NOT NULL AND existing_signup <> 'student' AND desired_role = 'student' THEN
    RETURN;
  END IF;

  UPDATE public.profiles SET signup_role = desired_role::text
   WHERE id = uid AND signup_role IS DISTINCT FROM desired_role::text;

  SELECT workspace_id INTO primary_ws
  FROM public.workspace_members
  WHERE profile_id = uid
  ORDER BY created_at ASC LIMIT 1;

  IF primary_ws IS NOT NULL THEN
    INSERT INTO public.workspace_members (workspace_id, profile_id, role, status)
    VALUES (primary_ws, uid, desired_role, 'active')
    ON CONFLICT (workspace_id, profile_id, role) DO UPDATE
      SET status = 'active'
      WHERE workspace_members.status <> 'active';
  END IF;

  IF desired_role = 'instructor' THEN
    INSERT INTO public.instructor_profiles (user_id)
    VALUES (uid) ON CONFLICT (user_id) DO NOTHING;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_signup_role(app_role, text) FROM public;
GRANT EXECUTE ON FUNCTION public.apply_signup_role(app_role, text) TO authenticated;

-- Drop the old 1-arg signature so callers migrate to the tagged version.
DROP FUNCTION IF EXISTS public.apply_signup_role(app_role);

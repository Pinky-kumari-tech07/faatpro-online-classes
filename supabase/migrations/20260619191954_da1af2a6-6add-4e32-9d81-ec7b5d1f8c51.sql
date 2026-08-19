-- =========================================================
-- RBAC: Permissions catalog (global)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.rbac_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module text NOT NULL,
  action text NOT NULL,
  permission_key text NOT NULL UNIQUE,
  label text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.rbac_permissions TO authenticated;
GRANT SELECT ON public.rbac_permissions TO anon;
GRANT ALL ON public.rbac_permissions TO service_role;
ALTER TABLE public.rbac_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rbac_permissions_read_all" ON public.rbac_permissions
  FOR SELECT USING (true);

-- =========================================================
-- RBAC: Roles (workspace-scoped)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.rbac_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  color text DEFAULT '#6366f1',
  is_system boolean NOT NULL DEFAULT false,
  is_protected boolean NOT NULL DEFAULT false, -- e.g. Super Admin not editable
  status text NOT NULL DEFAULT 'active', -- active|inactive
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, slug)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rbac_roles TO authenticated;
GRANT ALL ON public.rbac_roles TO service_role;
ALTER TABLE public.rbac_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rbac_roles_select_members" ON public.rbac_roles
  FOR SELECT USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "rbac_roles_admin_insert" ON public.rbac_roles
  FOR INSERT WITH CHECK (
    public.has_any_workspace_role(auth.uid(), workspace_id,
      ARRAY['organization_admin'::app_role,'staff'::app_role,'super_admin'::app_role])
  );
CREATE POLICY "rbac_roles_admin_update" ON public.rbac_roles
  FOR UPDATE USING (
    public.has_any_workspace_role(auth.uid(), workspace_id,
      ARRAY['organization_admin'::app_role,'staff'::app_role,'super_admin'::app_role])
    AND is_protected = false
  );
CREATE POLICY "rbac_roles_admin_delete" ON public.rbac_roles
  FOR DELETE USING (
    public.has_any_workspace_role(auth.uid(), workspace_id,
      ARRAY['organization_admin'::app_role,'super_admin'::app_role])
    AND is_system = false
  );

CREATE TRIGGER trg_rbac_roles_updated
  BEFORE UPDATE ON public.rbac_roles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- RBAC: Role <-> Permission
-- =========================================================
CREATE TABLE IF NOT EXISTS public.rbac_role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES public.rbac_roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.rbac_permissions(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role_id, permission_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rbac_role_permissions TO authenticated;
GRANT ALL ON public.rbac_role_permissions TO service_role;
ALTER TABLE public.rbac_role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rbac_rp_select_members" ON public.rbac_role_permissions
  FOR SELECT USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "rbac_rp_admin_write" ON public.rbac_role_permissions
  FOR ALL USING (
    public.has_any_workspace_role(auth.uid(), workspace_id,
      ARRAY['organization_admin'::app_role,'staff'::app_role,'super_admin'::app_role])
  ) WITH CHECK (
    public.has_any_workspace_role(auth.uid(), workspace_id,
      ARRAY['organization_admin'::app_role,'staff'::app_role,'super_admin'::app_role])
  );

-- =========================================================
-- RBAC: User <-> Role
-- =========================================================
CREATE TABLE IF NOT EXISTS public.rbac_user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.rbac_roles(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role_id, workspace_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rbac_user_roles TO authenticated;
GRANT ALL ON public.rbac_user_roles TO service_role;
ALTER TABLE public.rbac_user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rbac_ur_select_self_or_admin" ON public.rbac_user_roles
  FOR SELECT USING (
    user_id = auth.uid()
    OR public.has_any_workspace_role(auth.uid(), workspace_id,
        ARRAY['organization_admin'::app_role,'staff'::app_role,'super_admin'::app_role])
  );
CREATE POLICY "rbac_ur_admin_write" ON public.rbac_user_roles
  FOR ALL USING (
    public.has_any_workspace_role(auth.uid(), workspace_id,
      ARRAY['organization_admin'::app_role,'staff'::app_role,'super_admin'::app_role])
  ) WITH CHECK (
    public.has_any_workspace_role(auth.uid(), workspace_id,
      ARRAY['organization_admin'::app_role,'staff'::app_role,'super_admin'::app_role])
  );

CREATE INDEX IF NOT EXISTS idx_rbac_user_roles_user ON public.rbac_user_roles(user_id, workspace_id);

-- =========================================================
-- Seed: Permission catalog
-- =========================================================
INSERT INTO public.rbac_permissions (module, action, permission_key, label, sort_order)
SELECT m.module, a.action,
       lower(m.module) || '.' || lower(a.action),
       initcap(a.action) || ' ' || m.module,
       m.ord * 100 + a.ord
FROM (VALUES
  ('Dashboard', 1),('Students', 2),('Instructors', 3),('Courses', 4),('Bundles', 5),
  ('Categories', 6),('Assignments', 7),('Quizzes', 8),('Certificates', 9),
  ('Institutions', 10),('Live Classes', 11),('Announcements', 12),('Messages', 13),
  ('Revenue', 14),('Payouts', 15),('Invoices', 16),('Reports', 17),('Settings', 18),
  ('User Management', 19),('Role Management', 20)
) AS m(module, ord)
CROSS JOIN (VALUES
  ('view', 1),('create', 2),('edit', 3),('delete', 4),
  ('approve', 5),('publish', 6),('export', 7),('import', 8),('manage', 9)
) AS a(action, ord)
ON CONFLICT (permission_key) DO NOTHING;

-- Advanced scoped permissions
INSERT INTO public.rbac_permissions (module, action, permission_key, label, sort_order) VALUES
  ('Courses', 'view_own', 'courses.view_own', 'View Own Courses', 410),
  ('Courses', 'edit_own', 'courses.edit_own', 'Edit Own Courses', 411),
  ('Courses', 'archive', 'courses.archive', 'Archive Courses', 412),
  ('Revenue', 'view_own', 'revenue.view_own', 'View Own Revenue', 1410),
  ('Revenue', 'approve_payout', 'revenue.approve_payout', 'Approve Payouts', 1411),
  ('Revenue', 'download_reports', 'revenue.download_reports', 'Download Revenue Reports', 1412)
ON CONFLICT (permission_key) DO NOTHING;

-- =========================================================
-- Initialization function — creates default roles for a workspace
-- =========================================================
CREATE OR REPLACE FUNCTION public.rbac_init_workspace(_workspace_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role_id uuid;
  _created integer := 0;
  _r record;
BEGIN
  IF NOT public.has_any_workspace_role(auth.uid(), _workspace_id,
       ARRAY['organization_admin'::app_role,'super_admin'::app_role]) THEN
    RAISE EXCEPTION 'Not authorized to initialize RBAC for this workspace';
  END IF;

  FOR _r IN SELECT * FROM (VALUES
    ('Super Admin','super-admin','Full unrestricted access','#dc2626', true, true, ARRAY['*']),
    ('Admin','admin','Workspace administrator','#2563eb', true, false, ARRAY['*']),
    ('Finance Manager','finance-manager','Manages revenue, invoices, payouts','#059669', true, false,
      ARRAY['dashboard.view','revenue.%','invoices.%','payouts.%','reports.view','reports.export']),
    ('Academic Manager','academic-manager','Manages courses & academic content','#7c3aed', true, false,
      ARRAY['dashboard.view','courses.%','categories.%','assignments.%','quizzes.%','certificates.%','live classes.%','reports.view']),
    ('Instructor Manager','instructor-manager','Manages instructors','#ea580c', true, false,
      ARRAY['dashboard.view','instructors.%','courses.view','reports.view']),
    ('Student Manager','student-manager','Manages students','#0ea5e9', true, false,
      ARRAY['dashboard.view','students.%','enrollments.%','reports.view']),
    ('Support Executive','support-executive','Handles student support','#f59e0b', true, false,
      ARRAY['dashboard.view','students.view','messages.%','announcements.view']),
    ('Content Manager','content-manager','Publishes content','#10b981', true, false,
      ARRAY['dashboard.view','courses.view','courses.edit','categories.%','announcements.%']),
    ('Report Manager','report-manager','Reports & analytics','#6366f1', true, false,
      ARRAY['dashboard.view','reports.%']),
    ('Staff','staff','General staff','#64748b', true, false,
      ARRAY['dashboard.view','students.view','courses.view','reports.view'])
  ) AS t(name, slug, descr, color, is_sys, is_prot, perms) LOOP
    INSERT INTO public.rbac_roles (workspace_id, name, slug, description, color, is_system, is_protected, created_by)
    VALUES (_workspace_id, _r.name, _r.slug, _r.descr, _r.color, _r.is_sys, _r.is_prot, auth.uid())
    ON CONFLICT (workspace_id, slug) DO NOTHING
    RETURNING id INTO _role_id;

    IF _role_id IS NOT NULL THEN
      _created := _created + 1;
      IF _r.perms[1] = '*' THEN
        INSERT INTO public.rbac_role_permissions (role_id, permission_id, workspace_id)
        SELECT _role_id, id, _workspace_id FROM public.rbac_permissions
        ON CONFLICT DO NOTHING;
      ELSE
        INSERT INTO public.rbac_role_permissions (role_id, permission_id, workspace_id)
        SELECT _role_id, p.id, _workspace_id
        FROM public.rbac_permissions p, unnest(_r.perms) AS pat
        WHERE p.permission_key LIKE replace(pat,'%','%')
        ON CONFLICT DO NOTHING;
      END IF;
      _role_id := NULL;
    END IF;
  END LOOP;

  RETURN _created;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rbac_init_workspace(uuid) TO authenticated;

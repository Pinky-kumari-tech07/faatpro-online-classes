DROP POLICY IF EXISTS coupons_public_active_read ON public.coupons;
DROP POLICY IF EXISTS coupons_read ON public.coupons;

GRANT SELECT ON public.coupons TO anon;
GRANT SELECT ON public.coupons TO authenticated;

CREATE POLICY coupons_public_active_read
ON public.coupons
FOR SELECT
TO anon, authenticated
USING (
  status = 'active'
  AND (starts_at IS NULL OR starts_at::date <= CURRENT_DATE)
  AND (ends_at IS NULL OR ends_at::date >= CURRENT_DATE)
);

CREATE POLICY coupons_admin_read
ON public.coupons
FOR SELECT
TO authenticated
USING (
  public.has_any_workspace_role(
    auth.uid(),
    workspace_id,
    ARRAY['organization_admin'::public.app_role, 'staff'::public.app_role, 'super_admin'::public.app_role]
  )
);
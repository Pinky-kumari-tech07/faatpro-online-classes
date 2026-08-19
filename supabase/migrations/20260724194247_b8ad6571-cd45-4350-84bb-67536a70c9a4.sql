
DROP POLICY IF EXISTS coupons_public_active_read ON public.coupons;

CREATE OR REPLACE FUNCTION public.lookup_active_coupon(_workspace_id uuid, _code text)
RETURNS TABLE (
  id uuid,
  workspace_id uuid,
  code text,
  discount_type coupon_discount_type,
  discount_value numeric,
  starts_at timestamptz,
  ends_at timestamptz,
  max_redemptions integer,
  redeemed_count integer,
  applies_to text,
  course_ids jsonb,
  status coupon_status
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.workspace_id, c.code, c.discount_type, c.discount_value,
         c.starts_at, c.ends_at, c.max_redemptions, c.redeemed_count,
         c.applies_to, c.course_ids, c.status
  FROM public.coupons c
  WHERE c.workspace_id = _workspace_id
    AND lower(c.code) = lower(_code)
    AND c.status = 'active'
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.lookup_active_coupon(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lookup_active_coupon(uuid, text) TO authenticated, service_role;

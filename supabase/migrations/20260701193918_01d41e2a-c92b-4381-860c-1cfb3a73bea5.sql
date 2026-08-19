DROP POLICY IF EXISTS coupons_public_active_read ON public.coupons;

CREATE POLICY coupons_public_active_read
ON public.coupons
FOR SELECT
TO anon, authenticated
USING (
  status = 'active'
  AND (starts_at IS NULL OR starts_at::date <= ((now() AT TIME ZONE 'Asia/Kolkata')::date))
  AND (ends_at IS NULL OR ends_at::date >= ((now() AT TIME ZONE 'Asia/Kolkata')::date))
);
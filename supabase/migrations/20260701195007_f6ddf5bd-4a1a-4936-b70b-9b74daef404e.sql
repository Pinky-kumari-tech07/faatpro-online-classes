CREATE OR REPLACE FUNCTION public.update_checkout_coupon(_payment_id uuid, _coupon_code text DEFAULT NULL)
RETURNS public.payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _payment public.payments;
  _course public.courses;
  _coupon public.coupons;
  _base numeric := 0;
  _after_discount numeric := 0;
  _course_discount numeric := 0;
  _coupon_amount numeric := 0;
  _subtotal numeric := 0;
  _tax numeric := 0;
  _total numeric := 0;
  _today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  _scope jsonb;
  _matches boolean := false;
BEGIN
  SELECT * INTO _payment
  FROM public.payments
  WHERE id = _payment_id
    AND student_id = auth.uid()
    AND status = 'pending'::public.payment_status;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found or cannot be changed';
  END IF;

  IF _payment.course_id IS NULL THEN
    RAISE EXCEPTION 'Coupons are supported for course checkout only';
  END IF;

  SELECT * INTO _course FROM public.courses WHERE id = _payment.course_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Course not found';
  END IF;

  _base := COALESCE(_course.price_amount, 0);
  _after_discount := _base;

  IF _course.pricing_type = 'free' THEN
    _base := 0;
    _after_discount := 0;
  ELSIF (_course.discount_starts_at IS NULL OR _course.discount_starts_at <= now())
    AND (_course.discount_ends_at IS NULL OR _course.discount_ends_at >= now()) THEN
    IF COALESCE(_course.sale_price, 0) > 0 THEN
      _after_discount := _course.sale_price;
    ELSIF _course.discount_type = 'percentage' AND COALESCE(_course.discount_value, 0) > 0 THEN
      _after_discount := GREATEST(0, _base - ((_base * _course.discount_value) / 100));
    ELSIF _course.discount_type = 'fixed' AND COALESCE(_course.discount_value, 0) > 0 THEN
      _after_discount := GREATEST(0, _base - _course.discount_value);
    END IF;
  END IF;

  _course_discount := GREATEST(0, _base - _after_discount);

  IF NULLIF(TRIM(COALESCE(_coupon_code, '')), '') IS NOT NULL THEN
    SELECT * INTO _coupon
    FROM public.coupons
    WHERE workspace_id = _payment.workspace_id
      AND lower(code) = lower(TRIM(_coupon_code))
      AND status = 'active'::public.coupon_status
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Coupon not found';
    END IF;

    IF _coupon.starts_at IS NOT NULL AND (_coupon.starts_at AT TIME ZONE 'Asia/Kolkata')::date > _today THEN
      RAISE EXCEPTION 'Coupon not yet active';
    END IF;

    IF _coupon.ends_at IS NOT NULL AND (_coupon.ends_at AT TIME ZONE 'Asia/Kolkata')::date < _today THEN
      RAISE EXCEPTION 'Coupon expired';
    END IF;

    IF _coupon.max_redemptions IS NOT NULL AND _coupon.redeemed_count >= _coupon.max_redemptions THEN
      RAISE EXCEPTION 'Coupon limit reached';
    END IF;

    IF _coupon.applies_to = 'specific_courses' THEN
      _scope := COALESCE(_coupon.course_ids, '[]'::jsonb);
      IF jsonb_typeof(_scope) = 'array' THEN
        SELECT EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(_scope) AS x(value)
          WHERE x.value = _course.id::text
        ) INTO _matches;
      ELSIF jsonb_typeof(_scope) = 'object' THEN
        SELECT EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(COALESCE(_scope->'courses', '[]'::jsonb)) AS x(value)
          WHERE x.value = _course.id::text
        ) OR EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(COALESCE(_scope->'categories', '[]'::jsonb)) AS x(value)
          WHERE x.value IN (COALESCE(_course.category, ''), COALESCE(_course.subcategory, ''), COALESCE(_course.child_category, ''))
        ) INTO _matches;
      END IF;

      IF NOT COALESCE(_matches, false) THEN
        RAISE EXCEPTION 'Coupon not valid for this course';
      END IF;
    END IF;

    IF _course.allow_coupons IS FALSE THEN
      RAISE EXCEPTION 'Coupons are disabled for this course';
    END IF;

    IF _coupon.discount_type = 'percent'::public.coupon_discount_type THEN
      _coupon_amount := (_after_discount * COALESCE(_coupon.discount_value, 0)) / 100;
    ELSE
      _coupon_amount := COALESCE(_coupon.discount_value, 0);
    END IF;
    _coupon_amount := LEAST(GREATEST(_coupon_amount, 0), _after_discount);
  END IF;

  _subtotal := GREATEST(0, _after_discount - _coupon_amount);
  IF COALESCE(_course.gst_rate, 0) > 0 THEN
    IF COALESCE(_course.tax_inclusive, false) THEN
      _tax := _subtotal - (_subtotal / (1 + (_course.gst_rate / 100)));
    ELSE
      _tax := (_subtotal * _course.gst_rate) / 100;
    END IF;
  END IF;
  _total := CASE WHEN COALESCE(_course.tax_inclusive, false) THEN _subtotal ELSE _subtotal + _tax END;

  UPDATE public.payments
     SET base_price = ROUND(_base, 2),
         discount_amount = ROUND(_course_discount + _coupon_amount, 2),
         coupon_code = CASE WHEN _coupon.id IS NULL THEN NULL ELSE _coupon.code END,
         tax_amount = ROUND(_tax, 2),
         total_amount = ROUND(_total, 2),
         amount = ROUND(_total, 2),
         updated_at = now()
   WHERE id = _payment_id
   RETURNING * INTO _payment;

  RETURN _payment;
END;
$$;

REVOKE ALL ON FUNCTION public.update_checkout_coupon(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_checkout_coupon(uuid, text) TO authenticated;
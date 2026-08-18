
ALTER TABLE public.courses DISABLE TRIGGER USER;

DO $$
DECLARE
  ws        uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-000000000001';
  admin_id  uuid := '973338bc-fbba-4db5-a04b-79f2aa5c56e0';
  instr_a   uuid := '4db1db46-557a-46d4-86eb-47e3a885159e';
  instr_b   uuid := '0ae46826-787e-47a0-b4b5-6eeda3f786b2';
  stu_1     uuid := 'fc2d7143-5c3d-4387-99ae-2d72ada926da';
  stu_2     uuid := 'd42bc729-f495-46e9-8331-b8299d42f0d3';
  stu_3     uuid := '7e7cb876-0c5c-4661-8fb1-a120e7e3afe9';
  stu_4     uuid := 'c5043ac6-48f6-4c94-b62d-108784fbd8ce';
  c_free    uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-000000000002';
  c_basic   uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-000000000003';
  c_gst_inc uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-000000000004';
  c_sale    uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-000000000005';
  c_noshare uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-000000000006';
  c_fixed   uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-000000000007';
  p_id      uuid;
  payout_id uuid;
  total_net numeric(12,2);
BEGIN
  INSERT INTO public.workspaces (id, name, slug, brand_color, tagline)
  VALUES (ws, 'AUDIT-FINANCE (test)', 'audit-finance', '#dc2626',
          'Isolated finance-audit workspace. Do not use for production.')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.gst_settings (
    workspace_id, company_name, company_gstin, pan_number,
    business_address, business_city, business_state, business_pin, business_country,
    invoice_prefix, default_gst_rate
  ) VALUES (ws, 'Audit Test Seller', '29ABCDE1234F1Z5', 'ABCDE1234F',
    '1 Test Road', 'Bengaluru', 'Karnataka', '560001', 'India', 'AUD', 18)
  ON CONFLICT (workspace_id) DO NOTHING;

  INSERT INTO public.workspace_members (workspace_id, profile_id, role, status) VALUES
    (ws, admin_id, 'organization_admin', 'active'),
    (ws, instr_a,  'instructor',         'active'),
    (ws, instr_b,  'instructor',         'active'),
    (ws, stu_1,    'student',            'active'),
    (ws, stu_2,    'student',            'active'),
    (ws, stu_3,    'student',            'active'),
    (ws, stu_4,    'student',            'active')
  ON CONFLICT (workspace_id, profile_id, role) DO NOTHING;

  INSERT INTO public.instructor_profiles (
    workspace_id, user_id, account_holder_name, bank_account_number,
    ifsc_code, bank_name, branch_name, bank_verified
  ) VALUES
    (ws, instr_a, 'Prahalad Kumar', '111122223333', 'HDFC0000123', 'HDFC Bank',  'MG Road',     true),
    (ws, instr_b, 'Instructor B',   '444455556666', 'ICIC0000456', 'ICICI Bank', 'Indiranagar', true)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.courses (id, workspace_id, title, slug, status, pricing_type,
    price_amount, currency, instructor_id, revenue_model, revenue_instructor_pct)
  VALUES
    (c_free,  ws, '[AUDIT] Free Course',      'audit-free',  'published', 'free', 0,    'INR', instr_a, 'revenue_share', 70),
    (c_basic, ws, '[AUDIT] Basic Paid 70/30', 'audit-basic', 'published', 'paid', 1000, 'INR', instr_a, 'revenue_share', 70)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.courses (id, workspace_id, title, slug, status, pricing_type,
    price_amount, currency, instructor_id, revenue_model, revenue_instructor_pct,
    discount_type, discount_value, gst_rate, tax_inclusive)
  VALUES (c_gst_inc, ws, '[AUDIT] Discounted GST-Inclusive', 'audit-gst-inc',
    'published', 'paid', 1000, 'INR', instr_a, 'revenue_share', 70,
    'percentage', 10, 18, true) ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.courses (id, workspace_id, title, slug, status, pricing_type,
    price_amount, sale_price, currency, instructor_id, revenue_model,
    revenue_instructor_pct, gst_rate, tax_inclusive)
  VALUES (c_sale, ws, '[AUDIT] Sale + GST-Exclusive', 'audit-sale',
    'published', 'paid', 2000, 1500, 'INR', instr_b, 'revenue_share', 60, 18, false)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.courses (id, workspace_id, title, slug, status, pricing_type,
    price_amount, currency, instructor_id, revenue_model)
  VALUES (c_noshare, ws, '[AUDIT] No-Share', 'audit-noshare',
    'published', 'paid', 500, 'INR', instr_b, 'no_share') ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.courses (id, workspace_id, title, slug, status, pricing_type,
    price_amount, currency, instructor_id, revenue_model, revenue_fixed_amount)
  VALUES (c_fixed, ws, '[AUDIT] Instructor-Fixed 800', 'audit-fixed',
    'published', 'paid', 1500, 'INR', instr_a, 'instructor_fixed', 800)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.enrollments (workspace_id, course_id, student_id, status)
  VALUES (ws, c_free, stu_1, 'active') ON CONFLICT DO NOTHING;

  INSERT INTO public.payments (workspace_id, student_id, course_id, provider,
    amount, currency, status, base_price, discount_amount, tax_amount, total_amount) VALUES
    (ws, stu_1, c_basic,   'razorpay', 1000, 'INR', 'succeeded', 1000,   0,      0,    1000),
    (ws, stu_2, c_basic,   'razorpay',  900, 'INR', 'succeeded', 1000, 100,      0,     900),
    (ws, stu_3, c_gst_inc, 'razorpay',  900, 'INR', 'succeeded', 1000, 100, 137.29,     900),
    (ws, stu_4, c_sale,    'razorpay', 1770, 'INR', 'succeeded', 2000, 500,    270,    1770),
    (ws, stu_1, c_noshare, 'razorpay',  500, 'INR', 'succeeded',  500,   0,      0,     500),
    (ws, stu_2, c_fixed,   'razorpay', 1500, 'INR', 'succeeded', 1500,   0,      0,    1500),
    (ws, stu_4, c_basic,   'razorpay', 1000, 'INR', 'failed',    1000,   0,      0,    1000),
    (ws, stu_4, c_basic,   'razorpay', 1000, 'INR', 'pending',   1000,   0,      0,    1000),
    (ws, stu_4, c_basic,   'razorpay', 1000, 'INR', 'succeeded', 1000,   0,      0,    1000),
    (ws, stu_1, c_fixed,   'offline',  1500, 'INR', 'succeeded', 1500,   0,      0,    1500),
    (ws, stu_1, c_basic,   'razorpay', 1000, 'INR', 'succeeded', 1000,   0,      0,    1000);

  INSERT INTO public.payments (workspace_id, student_id, course_id, provider,
    amount, currency, status, base_price, discount_amount, tax_amount, total_amount)
  VALUES (ws, stu_3, c_basic, 'razorpay', 1000, 'INR', 'succeeded', 1000, 0, 0, 1000)
  RETURNING id INTO p_id;

  INSERT INTO public.refunds (workspace_id, payment_id, course_id, student_id,
    amount, currency, reason, status, processed_by)
  VALUES (ws, p_id, c_basic, stu_3, 1000, 'INR', 'Audit test — full refund', 'completed', admin_id);

  SELECT COALESCE(SUM(net_earning - COALESCE(settled_amount, 0)), 0)
    INTO total_net
    FROM public.instructor_earnings
   WHERE workspace_id = ws AND instructor_id = instr_a
     AND status = 'active' AND settlement_status = 'pending';

  IF total_net > 0 THEN
    INSERT INTO public.payout_requests (
      workspace_id, instructor_id, amount, currency, status,
      settlement_number, earnings_count, paid_amount, paid_at, payment_reference
    ) VALUES (ws, instr_a, total_net, 'INR', 'paid',
      'AUD-STL-0001', 0, total_net, now(), 'UTR-AUDIT-0001')
    RETURNING id INTO payout_id;

    UPDATE public.instructor_earnings
       SET settlement_status = 'paid',
           settled_amount = net_earning,
           settlement_request_id = payout_id,
           updated_at = now()
     WHERE workspace_id = ws AND instructor_id = instr_a
       AND status = 'active' AND settlement_status = 'pending';

    UPDATE public.payout_requests
       SET earnings_count = (SELECT COUNT(*) FROM public.instructor_earnings
                              WHERE settlement_request_id = payout_id)
     WHERE id = payout_id;

    INSERT INTO public.settlement_transactions (
      workspace_id, settlement_request_id, instructor_id, amount,
      payment_mode, transaction_reference, notes, paid_by
    ) VALUES (ws, payout_id, instr_a, total_net,
      'bank_transfer', 'UTR-AUDIT-0001', 'Audit seed settlement', admin_id);
  END IF;
END $$;

ALTER TABLE public.courses ENABLE TRIGGER USER;

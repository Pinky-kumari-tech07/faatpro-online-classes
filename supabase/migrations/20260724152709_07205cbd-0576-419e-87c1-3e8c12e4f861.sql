-- 1) Skip generating earnings for users who also hold admin/staff/super_admin roles.
CREATE OR REPLACE FUNCTION public.create_earning_from_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _course public.courses;
  _instructor uuid;
  _gross numeric(12,2);
  _tax numeric(12,2);
  _discount numeric(12,2);
  _base numeric(12,2);
  _instr_share numeric(12,2) := 0;
  _plat_share numeric(12,2) := 0;
  _pct numeric := 0;
  _currency text;
  _model public.course_revenue_type;
BEGIN
  IF NEW.status <> 'succeeded' OR NEW.course_id IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO _course FROM public.courses WHERE id = NEW.course_id;
  _instructor := _course.instructor_id;
  _currency := COALESCE(NEW.currency, _course.currency, 'INR');
  IF _instructor IS NULL THEN RETURN NEW; END IF;

  -- Do NOT generate instructor earnings for users who are admins/staff.
  IF EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE profile_id = _instructor
      AND role IN ('organization_admin','super_admin','staff')
      AND status = 'active'
  ) THEN
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM public.instructor_earnings WHERE payment_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  _gross    := COALESCE(NEW.total_amount, NEW.amount, 0);
  _tax      := COALESCE(NEW.tax_amount, 0);
  _discount := GREATEST(COALESCE(NEW.total_amount,0) - COALESCE(NEW.amount,0), 0);
  _base     := GREATEST(_gross - _tax - _discount, 0);
  _model    := COALESCE(_course.revenue_model, 'revenue_share');

  CASE _model
    WHEN 'no_share' THEN
      _instr_share := 0; _plat_share := _base; _pct := 0;
    WHEN 'per_student_fixed' THEN
      _instr_share := LEAST(COALESCE(_course.revenue_per_student_amount,0), _base);
      _plat_share  := _base - _instr_share;
      _pct := CASE WHEN _base > 0 THEN ROUND(_instr_share * 100.0 / _base, 2) ELSE 0 END;
    WHEN 'instructor_fixed' THEN
      _instr_share := LEAST(COALESCE(_course.revenue_fixed_amount,0), _base);
      _plat_share  := _base - _instr_share;
      _pct := CASE WHEN _base > 0 THEN ROUND(_instr_share * 100.0 / _base, 2) ELSE 0 END;
    WHEN 'one_time_contract' THEN
      IF _course.revenue_one_time_paid_at IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM public.instructor_earnings ie
           WHERE ie.course_id = _course.id
             AND ie.revenue_model = 'one_time_contract'
             AND ie.instructor_share > 0
         ) THEN
        _instr_share := LEAST(COALESCE(_course.revenue_one_time_amount, 0), COALESCE(_course.revenue_one_time_amount, 0));
      ELSE
        _instr_share := 0;
      END IF;
      _plat_share := GREATEST(_base - _instr_share, 0);
      _pct := 0;
    ELSE
      _pct := COALESCE(_course.revenue_instructor_pct, 50);
      IF _pct IS NULL OR _pct = 0 THEN
        _pct := public.resolve_commission_percentage(NEW.workspace_id, _instructor, NEW.course_id);
      END IF;
      _instr_share := ROUND(_base * _pct / 100.0, 2);
      _plat_share  := _base - _instr_share;
  END CASE;

  INSERT INTO public.instructor_earnings (
    workspace_id, instructor_id, course_id, student_id, payment_id,
    gross_amount, tax_amount, discount_amount, net_revenue_base,
    commission_percentage, commission_amount, net_earning,
    revenue_model, currency, status, settlement_status, earned_at
  ) VALUES (
    NEW.workspace_id, _instructor, NEW.course_id, NEW.student_id, NEW.id,
    _gross, _tax, _discount, _base,
    _pct, _plat_share, _instr_share,
    _model, _currency, 'active', 'pending',
    COALESCE(NEW.updated_at, NEW.created_at, now())
  );

  IF _model = 'one_time_contract' AND _instr_share > 0 AND _course.revenue_one_time_paid_at IS NULL THEN
    UPDATE public.courses SET revenue_one_time_paid_at = now() WHERE id = _course.id;
  END IF;

  RETURN NEW;
END $function$;

-- 2) Remove any orphan instructor role assignments from users who are also
--    organization admins, super admins or staff. Admins are NOT instructors.
DELETE FROM public.workspace_members wm
WHERE wm.role = 'instructor'
  AND EXISTS (
    SELECT 1 FROM public.workspace_members wm2
    WHERE wm2.profile_id = wm.profile_id
      AND wm2.role IN ('organization_admin','super_admin','staff')
  );

-- 3) Full soft-delete for a student — purges learner activity while preserving
--    financial and audit records (payments, invoices, earnings, audit logs).
CREATE OR REPLACE FUNCTION public.admin_soft_delete_student(_student_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin_anywhere(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  -- Deactivate profile & block login
  UPDATE public.profiles
     SET is_active = false,
         status = 'deleted',
         deleted_at = COALESCE(deleted_at, now())
   WHERE id = _student_id;

  -- Suspend all workspace memberships so the student disappears from lists
  UPDATE public.workspace_members
     SET status = 'suspended'
   WHERE profile_id = _student_id;

  -- Purge learner activity
  DELETE FROM public.assignment_submission_history WHERE student_id = _student_id;
  DELETE FROM public.assignment_submissions WHERE student_id = _student_id;
  DELETE FROM public.quiz_attempts WHERE student_id = _student_id;
  DELETE FROM public.lesson_progress WHERE student_id = _student_id;
  DELETE FROM public.attendance_records WHERE student_id = _student_id;
  DELETE FROM public.live_class_attendance WHERE student_id = _student_id;
  DELETE FROM public.discussion_replies WHERE author_id = _student_id;
  DELETE FROM public.discussions WHERE author_id = _student_id;
  DELETE FROM public.student_notes WHERE student_id = _student_id;
  DELETE FROM public.student_bundles WHERE student_id = _student_id;
  DELETE FROM public.batch_students WHERE student_id = _student_id;
  DELETE FROM public.institution_students WHERE student_id = _student_id;
  DELETE FROM public.enrollments WHERE student_id = _student_id;
  DELETE FROM public.certificates WHERE student_id = _student_id;

  -- Communications
  DELETE FROM public.support_messages
    WHERE sender_id = _student_id
       OR ticket_id IN (SELECT id FROM public.support_tickets WHERE user_id = _student_id);
  DELETE FROM public.support_tickets WHERE user_id = _student_id;
  DELETE FROM public.notifications WHERE profile_id = _student_id;
  DELETE FROM public.messages WHERE sender_id = _student_id;
  DELETE FROM public.conversation_participants WHERE profile_id = _student_id;

  -- Sessions & tracking
  DELETE FROM public.video_access_logs WHERE user_id = _student_id;
  DELETE FROM public.user_sessions WHERE user_id = _student_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_soft_delete_student(uuid) TO authenticated;
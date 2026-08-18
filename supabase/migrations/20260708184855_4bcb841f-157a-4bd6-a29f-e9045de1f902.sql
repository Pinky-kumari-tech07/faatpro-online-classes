
-- Disable trigger side-effects during bulk wipe
SET session_replication_role = 'replica';

TRUNCATE TABLE
  public.assignment_submission_history,
  public.assignment_submissions,
  public.assignments,
  public.attendance_records,
  public.attendance_sessions,
  public.batch_courses,
  public.batch_students,
  public.batches,
  public.bundle_courses,
  public.student_bundles,
  public.course_bundles,
  public.certificates,
  public.conversation_participants,
  public.messages,
  public.conversations,
  public.coupons,
  public.course_instructors,
  public.course_launch_subscribers,
  public.course_prerequisites,
  public.lesson_assets,
  public.lesson_progress,
  public.lessons,
  public.course_sections,
  public.discussion_replies,
  public.discussions,
  public.enrollments,
  public.institution_students,
  public.earning_adjustments,
  public.settlement_audit_log,
  public.settlement_transactions,
  public.payout_requests,
  public.instructor_earnings,
  public.instructor_profiles,
  public.refunds,
  public.invoice_audit_log,
  public.invoices,
  public.invoice_sequences,
  public.payments,
  public.live_classes,
  public.notifications,
  public.quiz_attempts,
  public.quiz_questions,
  public.quizzes,
  public.question_bank,
  public.question_categories,
  public.student_notes,
  public.student_notices,
  public.student_profiles,
  public.support_messages,
  public.support_tickets,
  public.announcements,
  public.user_agreements,
  public.user_sessions,
  public.video_access_logs,
  public.courses,
  public.course_categories
RESTART IDENTITY CASCADE;

SET session_replication_role = 'origin';

-- Delete every auth user that is NOT an active admin/staff/super_admin.
-- Cascades wipe their profiles, workspace_members, and any residual owned rows.
DELETE FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.workspace_members wm
  WHERE wm.profile_id = u.id
    AND wm.status = 'active'
    AND wm.role IN ('organization_admin'::app_role, 'staff'::app_role, 'super_admin'::app_role)
);

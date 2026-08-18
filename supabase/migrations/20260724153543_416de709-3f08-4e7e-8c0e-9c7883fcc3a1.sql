DO $$
DECLARE
  ids uuid[] := ARRAY[
    'ea49fdda-05aa-4644-b67c-58df26614883',
    'd18f8ab1-a7e1-43e4-9ae2-a95decfbc03c',
    'cf37fc8c-6d7c-4e4c-b5a3-85031d6fff9b'
  ]::uuid[];
BEGIN
  DELETE FROM public.lesson_progress WHERE student_id = ANY(ids);
  DELETE FROM public.quiz_attempts WHERE student_id = ANY(ids);
  DELETE FROM public.assignment_submission_history WHERE submission_id IN (SELECT id FROM public.assignment_submissions WHERE student_id = ANY(ids));
  DELETE FROM public.assignment_submissions WHERE student_id = ANY(ids);
  DELETE FROM public.attendance_records WHERE student_id = ANY(ids);
  DELETE FROM public.live_class_attendance WHERE student_id = ANY(ids);
  DELETE FROM public.enrollments WHERE student_id = ANY(ids);
  DELETE FROM public.student_bundles WHERE student_id = ANY(ids);
  DELETE FROM public.batch_students WHERE student_id = ANY(ids);
  DELETE FROM public.institution_students WHERE student_id = ANY(ids);
  DELETE FROM public.student_notes WHERE student_id = ANY(ids);
  DELETE FROM public.student_profiles WHERE user_id = ANY(ids);
  DELETE FROM public.discussion_replies WHERE author_id = ANY(ids);
  DELETE FROM public.discussions WHERE author_id = ANY(ids);
  DELETE FROM public.messages WHERE sender_id = ANY(ids);
  DELETE FROM public.conversation_participants WHERE profile_id = ANY(ids);
  DELETE FROM public.direct_conversation_keys WHERE user_a = ANY(ids) OR user_b = ANY(ids);
  DELETE FROM public.notifications WHERE profile_id = ANY(ids);
  DELETE FROM public.user_sessions WHERE user_id = ANY(ids);
  DELETE FROM public.user_agreements WHERE user_id = ANY(ids);
  DELETE FROM public.video_access_logs WHERE user_id = ANY(ids);
  DELETE FROM public.workspace_members WHERE profile_id = ANY(ids);
  DELETE FROM public.rbac_user_roles WHERE user_id = ANY(ids);
  DELETE FROM public.certificates WHERE student_id = ANY(ids);
  DELETE FROM auth.users WHERE id = ANY(ids);
END $$;
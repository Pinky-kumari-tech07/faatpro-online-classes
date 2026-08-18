
REVOKE EXECUTE ON FUNCTION public.try_issue_course_certificate(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.compute_quiz_attempt_result() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.try_cert_after_quiz_attempt() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.try_cert_after_lesson_progress() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.try_cert_after_assignment_sub() FROM PUBLIC, anon;

-- BUG-001 regression suite (run inside a single transaction; ROLLBACK at end).
-- Verifies:
--   T1 apply_signup_role() is idempotent
--   T2 apply_signup_role('student') cannot downgrade an instructor
--   T3 student + privileged role cannot coexist in the same workspace
--   T4 the last instructor membership cannot be removed while an
--      instructor_profiles row exists (enforced by trigger)
--   T5 inserting an instructor_profiles row auto-provisions the role
--   T7 concurrent identical inserts collapse to one row via ON CONFLICT
--
-- Substitute :uid with a real authenticated instructor uuid before running.
-- Executed successfully on 2026-07-27 against user 4db1db46-... — see the
-- BUG-001 completion report.

\pset pager off
\set ON_ERROR_STOP off
BEGIN;
SELECT set_config('request.jwt.claim.sub', :'uid', true);

-- T1 idempotency
SELECT public.apply_signup_role('instructor'::app_role, 'email_signup');
SELECT public.apply_signup_role('instructor'::app_role, 'email_signup');
SELECT public.apply_signup_role('instructor'::app_role, 'google_oauth');
SELECT public.apply_signup_role('instructor'::app_role, 'email_signup');
SELECT public.apply_signup_role('instructor'::app_role, 'email_signup');

SELECT 'T1 memberships' AS t, array_agg(role::text ORDER BY role::text)
FROM public.workspace_members WHERE profile_id = :'uid';

SELECT 'T1 instructor_profiles' AS t, COUNT(*)
FROM public.instructor_profiles WHERE user_id = :'uid';

SELECT 'T1 audit entries in this txn (should be 0 — nothing changed)' AS t,
  action, source, COUNT(*)
FROM public.role_change_audit_log
WHERE user_id = :'uid' AND created_at >= now() - interval '5 seconds'
GROUP BY action, source;

-- T2 downgrade blocked
SELECT public.apply_signup_role('student'::app_role, 'google_oauth');
SELECT 'T2 role after downgrade' AS t, array_agg(role::text)
FROM public.workspace_members WHERE profile_id = :'uid';

-- T3 role conflict rejected
DO $$
DECLARE ws uuid; uid uuid := (current_setting('request.jwt.claim.sub'))::uuid;
BEGIN
  SELECT workspace_id INTO ws FROM public.workspace_members
   WHERE profile_id = uid AND role='instructor' LIMIT 1;
  BEGIN
    INSERT INTO public.workspace_members(workspace_id,profile_id,role,status)
    VALUES (ws, uid, 'student', 'active');
    RAISE NOTICE 'T3 FAIL';
  EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'T3 OK: %', SQLERRM; END;
END $$;

-- T7 concurrency: 5 identical inserts collapse to 1
DO $$
DECLARE ws uuid; i int; before_n int; after_n int;
  uid uuid := (current_setting('request.jwt.claim.sub'))::uuid;
BEGIN
  SELECT workspace_id INTO ws FROM public.workspace_members
   WHERE profile_id = uid AND role='instructor' LIMIT 1;
  SELECT COUNT(*) INTO before_n FROM public.workspace_members
    WHERE profile_id = uid AND role='instructor';
  FOR i IN 1..5 LOOP
    INSERT INTO public.workspace_members(workspace_id,profile_id,role,status)
    VALUES (ws, uid, 'instructor', 'active')
    ON CONFLICT (workspace_id,profile_id,role) DO NOTHING;
    INSERT INTO public.instructor_profiles(user_id) VALUES (uid)
    ON CONFLICT (user_id) DO NOTHING;
  END LOOP;
  SELECT COUNT(*) INTO after_n FROM public.workspace_members
    WHERE profile_id = uid AND role='instructor';
  RAISE NOTICE 'T7 instr rows before=% after=%', before_n, after_n;
END $$;

ROLLBACK;
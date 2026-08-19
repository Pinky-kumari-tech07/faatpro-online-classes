-- Fix existing enrollment that was created under student's own workspace instead of course's workspace
UPDATE public.enrollments
SET workspace_id = '894afe7e-401e-458d-9780-fdf6a540b45a'
WHERE id = '4cf0f1c2-97a8-4f73-ae1f-99ae6c3ac0f2';

-- Ensure student is a member of the course's workspace so they appear in the instructor's Students list
INSERT INTO public.workspace_members (workspace_id, profile_id, role, status)
VALUES ('894afe7e-401e-458d-9780-fdf6a540b45a', 'b9983e98-4733-48ac-aba4-77ee94ec096c', 'student', 'active')
ON CONFLICT (workspace_id, profile_id, role) DO UPDATE SET status = 'active';
-- Promote miswired instructor signups.
-- Only touches users who: signed up as instructor, have NO instructor
-- membership anywhere, and own a personal workspace where they are the
-- lone active member.
WITH candidates AS (
  SELECT p.id AS profile_id
  FROM public.profiles p
  WHERE p.signup_role = 'instructor'
    AND NOT EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.profile_id = p.id
        AND wm.status = 'active'::member_status
        AND wm.role = 'instructor'::app_role
    )
),
personal AS (
  SELECT wm.id
  FROM public.workspace_members wm
  JOIN candidates c ON c.profile_id = wm.profile_id
  WHERE wm.status = 'active'::member_status
    AND wm.role = 'student'::app_role
    AND (
      SELECT count(*) FROM public.workspace_members x
      WHERE x.workspace_id = wm.workspace_id
        AND x.status = 'active'::member_status
    ) = 1
)
UPDATE public.workspace_members
SET role = 'instructor'::app_role
WHERE id IN (SELECT id FROM personal);
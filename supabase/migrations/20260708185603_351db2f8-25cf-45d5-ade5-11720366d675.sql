
-- 1. Orphan workspace_members (no workspace)
DELETE FROM public.workspace_members wm
WHERE NOT EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = wm.workspace_id);

-- 2. Orphan workspace_members (no profile)
DELETE FROM public.workspace_members wm
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = wm.profile_id);

-- 3. Orphan profiles (no auth user)
DELETE FROM public.profiles p
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id);

-- 4. Stale student memberships in secondary workspaces (no enrollments / batch / institution links).
--    Keeps the primary/original membership row per user+role.
DELETE FROM public.workspace_members wm
USING public.workspace_members keep
WHERE wm.profile_id = keep.profile_id
  AND wm.role = keep.role
  AND wm.id <> keep.id
  AND wm.created_at > keep.created_at
  AND NOT EXISTS (
    SELECT 1 FROM public.enrollments e
    WHERE e.student_id = wm.profile_id AND e.workspace_id = wm.workspace_id
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.batch_students bs
    WHERE bs.student_id = wm.profile_id
      AND EXISTS (SELECT 1 FROM public.batches b WHERE b.id = bs.batch_id AND b.workspace_id = wm.workspace_id)
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.institution_students ins
    WHERE ins.student_id = wm.profile_id AND ins.workspace_id = wm.workspace_id
  );

-- 5. Drop empty workspaces that no longer have any members (except owner-created ones with no data).
DELETE FROM public.workspaces w
WHERE NOT EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = w.id)
  AND NOT EXISTS (SELECT 1 FROM public.courses c WHERE c.workspace_id = w.id)
  AND NOT EXISTS (SELECT 1 FROM public.enrollments e WHERE e.workspace_id = w.id);

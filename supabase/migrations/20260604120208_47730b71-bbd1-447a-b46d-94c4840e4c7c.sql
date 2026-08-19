
CREATE OR REPLACE FUNCTION public.sync_enrollment_workspace_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.workspace_members (workspace_id, profile_id, role, status)
  VALUES (NEW.workspace_id, NEW.student_id, 'student'::app_role, 'active'::member_status)
  ON CONFLICT (workspace_id, profile_id, role) DO UPDATE
    SET status = 'active'::member_status
    WHERE workspace_members.status <> 'active'::member_status;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_enrollment_member ON public.enrollments;
CREATE TRIGGER trg_sync_enrollment_member
AFTER INSERT ON public.enrollments
FOR EACH ROW EXECUTE FUNCTION public.sync_enrollment_workspace_member();

-- Backfill missing members from existing enrollments
INSERT INTO public.workspace_members (workspace_id, profile_id, role, status)
SELECT DISTINCT e.workspace_id, e.student_id, 'student'::app_role, 'active'::member_status
FROM public.enrollments e
WHERE NOT EXISTS (
  SELECT 1 FROM public.workspace_members wm
  WHERE wm.workspace_id = e.workspace_id
    AND wm.profile_id = e.student_id
    AND wm.role = 'student'::app_role
);


CREATE OR REPLACE FUNCTION public.sync_course_instructor_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.workspace_members (workspace_id, profile_id, role, status)
  VALUES (NEW.workspace_id, NEW.instructor_id, 'instructor'::app_role, 'active'::member_status)
  ON CONFLICT (workspace_id, profile_id, role) DO UPDATE
    SET status = 'active'::member_status
    WHERE workspace_members.status <> 'active'::member_status;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_course_instructor_membership ON public.course_instructors;
CREATE TRIGGER trg_sync_course_instructor_membership
AFTER INSERT ON public.course_instructors
FOR EACH ROW EXECUTE FUNCTION public.sync_course_instructor_membership();

CREATE OR REPLACE FUNCTION public.sync_course_owner_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.instructor_id IS NOT NULL THEN
    INSERT INTO public.workspace_members (workspace_id, profile_id, role, status)
    VALUES (NEW.workspace_id, NEW.instructor_id, 'instructor'::app_role, 'active'::member_status)
    ON CONFLICT (workspace_id, profile_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_course_owner_membership ON public.courses;
CREATE TRIGGER trg_sync_course_owner_membership
AFTER INSERT OR UPDATE OF instructor_id ON public.courses
FOR EACH ROW EXECUTE FUNCTION public.sync_course_owner_membership();

INSERT INTO public.workspace_members (workspace_id, profile_id, role, status)
SELECT DISTINCT ci.workspace_id, ci.instructor_id, 'instructor'::app_role, 'active'::member_status
FROM public.course_instructors ci
ON CONFLICT (workspace_id, profile_id, role) DO NOTHING;

INSERT INTO public.workspace_members (workspace_id, profile_id, role, status)
SELECT DISTINCT c.workspace_id, c.instructor_id, 'instructor'::app_role, 'active'::member_status
FROM public.courses c
WHERE c.instructor_id IS NOT NULL
ON CONFLICT (workspace_id, profile_id, role) DO NOTHING;

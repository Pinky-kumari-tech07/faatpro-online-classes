ALTER TABLE public.courses
ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_courses_deleted_at ON public.courses(deleted_at);
CREATE INDEX IF NOT EXISTS idx_courses_active_workspace ON public.courses(workspace_id, status, updated_at DESC) WHERE deleted_at IS NULL;

DROP POLICY IF EXISTS courses_not_deleted_select ON public.courses;
CREATE POLICY courses_not_deleted_select
ON public.courses
AS RESTRICTIVE
FOR SELECT
TO public
USING (deleted_at IS NULL);
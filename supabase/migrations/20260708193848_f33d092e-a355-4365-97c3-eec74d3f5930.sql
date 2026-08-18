
DROP FUNCTION IF EXISTS public.list_course_transfers(uuid, timestamptz, timestamptz);

CREATE OR REPLACE FUNCTION public.list_course_transfers(
  _workspace_id uuid DEFAULT NULL,
  _from timestamptz DEFAULT NULL,
  _to timestamptz DEFAULT NULL
) RETURNS TABLE(
  id uuid, course_id uuid, course_title text, category text,
  from_instructor uuid, from_name text,
  to_instructor uuid, to_name text,
  actor_id uuid, actor_name text,
  reason text, students int, revenue numeric,
  ip_address text, user_agent text, created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT al.id, al.course_id, c.title, c.category,
         (al.details->>'from')::uuid, pf.full_name,
         (al.details->>'to')::uuid, pt.full_name,
         al.actor_id, pa.full_name,
         al.details->>'reason',
         COALESCE((al.details->>'students_snapshot')::int, 0),
         COALESCE((al.details->>'revenue_snapshot')::numeric, 0),
         al.ip_address, al.user_agent, al.created_at
  FROM public.course_audit_log al
  LEFT JOIN public.courses c ON c.id = al.course_id
  LEFT JOIN public.profiles pf ON pf.id = (al.details->>'from')::uuid
  LEFT JOIN public.profiles pt ON pt.id = (al.details->>'to')::uuid
  LEFT JOIN public.profiles pa ON pa.id = al.actor_id
  WHERE al.action = 'instructor_reassigned'
    AND (_workspace_id IS NULL OR al.workspace_id = _workspace_id)
    AND (_from IS NULL OR al.created_at >= _from)
    AND (_to   IS NULL OR al.created_at <= _to)
    AND public.is_admin_or_staff_anywhere(auth.uid())
  ORDER BY al.created_at DESC;
$$;

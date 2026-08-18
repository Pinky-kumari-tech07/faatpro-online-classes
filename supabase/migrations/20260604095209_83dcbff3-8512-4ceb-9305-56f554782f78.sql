
-- Tighten manage policy: only admins/staff/super_admin can create/edit/delete announcements
DROP POLICY IF EXISTS "ann_manage" ON public.announcements;
CREATE POLICY "ann_manage" ON public.announcements
  FOR ALL
  USING (has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role,'staff'::app_role,'super_admin'::app_role]))
  WITH CHECK (has_any_workspace_role(auth.uid(), workspace_id, ARRAY['organization_admin'::app_role,'staff'::app_role,'super_admin'::app_role]));

-- Track which announcement spawned a notification (idempotency)
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS source_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS notifications_announcement_unique
  ON public.notifications (source_id, profile_id)
  WHERE event_type = 'announcement';

CREATE INDEX IF NOT EXISTS idx_notifications_profile_unread
  ON public.notifications (workspace_id, profile_id, created_at DESC);

-- Fan-out function
CREATE OR REPLACE FUNCTION public.fanout_announcement_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  was_published boolean := (TG_OP = 'UPDATE' AND OLD.status = 'published');
BEGIN
  IF NEW.status <> 'published' THEN RETURN NEW; END IF;
  IF was_published THEN RETURN NEW; END IF;

  INSERT INTO public.notifications (workspace_id, profile_id, channel, event_type, title, body, source_id)
  SELECT NEW.workspace_id, wm.profile_id, 'in_app', 'announcement', NEW.title, NEW.body, NEW.id
  FROM public.workspace_members wm
  WHERE wm.workspace_id = NEW.workspace_id
    AND wm.status = 'active'
    AND (
      NEW.target_type = 'workspace'
      OR (NEW.target_type = 'role' AND wm.role = NEW.target_role)
      OR (NEW.target_type = 'course' AND EXISTS (
          SELECT 1 FROM public.enrollments e
          WHERE e.course_id = NEW.target_id AND e.student_id = wm.profile_id
        ))
    )
  ON CONFLICT (source_id, profile_id) WHERE event_type = 'announcement' DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fanout_announcement_ins ON public.announcements;
CREATE TRIGGER trg_fanout_announcement_ins
  AFTER INSERT ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.fanout_announcement_notifications();

DROP TRIGGER IF EXISTS trg_fanout_announcement_upd ON public.announcements;
CREATE TRIGGER trg_fanout_announcement_upd
  AFTER UPDATE OF status ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.fanout_announcement_notifications();

-- Enable realtime
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.announcements REPLICA IDENTITY FULL;
DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

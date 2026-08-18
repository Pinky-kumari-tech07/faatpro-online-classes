ALTER TABLE public.courses REPLICA IDENTITY FULL;
ALTER TABLE public.course_categories REPLICA IDENTITY FULL;
DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.courses; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.course_categories; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
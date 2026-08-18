DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['courses','lessons','course_sections','assignments','quizzes','quiz_questions','enrollments','course_instructors']
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;
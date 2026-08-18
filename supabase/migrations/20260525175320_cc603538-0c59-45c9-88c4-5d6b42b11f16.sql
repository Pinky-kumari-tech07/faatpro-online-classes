UPDATE public.courses SET visibility = 'public' WHERE status = 'published' AND visibility = 'private';
ALTER TABLE public.courses ALTER COLUMN visibility SET DEFAULT 'public';
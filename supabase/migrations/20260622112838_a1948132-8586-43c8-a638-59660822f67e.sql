
-- 1) Extend institutions
ALTER TABLE public.institutions
  ADD COLUMN IF NOT EXISTS type text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS country text DEFAULT 'India';

CREATE UNIQUE INDEX IF NOT EXISTS institutions_workspace_code_unique
  ON public.institutions(workspace_id, code) WHERE code IS NOT NULL;

CREATE OR REPLACE FUNCTION public.institutions_autocode()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  candidate text;
  attempts int := 0;
BEGIN
  IF NEW.code IS NULL OR length(trim(NEW.code)) = 0 THEN
    LOOP
      candidate := 'INST-' || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 6));
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.institutions
        WHERE workspace_id = NEW.workspace_id AND code = candidate
      );
      attempts := attempts + 1;
      IF attempts > 10 THEN EXIT; END IF;
    END LOOP;
    NEW.code := candidate;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_institutions_autocode ON public.institutions;
CREATE TRIGGER trg_institutions_autocode
  BEFORE INSERT ON public.institutions
  FOR EACH ROW EXECUTE FUNCTION public.institutions_autocode();

-- Allow students (any authenticated workspace member) to read active institutions across workspaces
DROP POLICY IF EXISTS "Authenticated can read active institutions" ON public.institutions;
CREATE POLICY "Authenticated can read active institutions"
  ON public.institutions FOR SELECT TO authenticated
  USING (is_active = true);

-- 2) Extend student_profiles
ALTER TABLE public.student_profiles
  ADD COLUMN IF NOT EXISTS institution_id uuid REFERENCES public.institutions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS institution_code text;

-- 3) Extend courses with promotional flags
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS is_best_seller boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_trending boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_new boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_editors_choice boolean NOT NULL DEFAULT false;

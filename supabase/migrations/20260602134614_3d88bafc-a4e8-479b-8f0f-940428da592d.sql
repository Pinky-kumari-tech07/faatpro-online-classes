ALTER TABLE public.certificate_templates
  ADD COLUMN IF NOT EXISTS design_json JSONB,
  ADD COLUMN IF NOT EXISTS orientation TEXT NOT NULL DEFAULT 'portrait';

NOTIFY pgrst, 'reload schema';
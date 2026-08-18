
ALTER TABLE public.batches
  ADD COLUMN IF NOT EXISTS coordinator_name TEXT,
  ADD COLUMN IF NOT EXISTS coordinator_email TEXT,
  ADD COLUMN IF NOT EXISTS coordinator_phone TEXT,
  ADD COLUMN IF NOT EXISTS duration_type TEXT;

-- Backfill duration_type from validity_type for existing rows
UPDATE public.batches
SET duration_type = COALESCE(duration_type, validity_type)
WHERE duration_type IS NULL AND validity_type IS NOT NULL;

-- Backfill coordinator_name from profiles for existing rows
UPDATE public.batches b
SET coordinator_name = p.full_name,
    coordinator_email = COALESCE(b.coordinator_email, p.email),
    coordinator_phone = COALESCE(b.coordinator_phone, p.phone)
FROM public.profiles p
WHERE b.coordinator_id = p.id AND b.coordinator_name IS NULL;

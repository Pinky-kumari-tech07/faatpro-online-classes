
-- 1. Canonical phone normalizer (India-first, E.164 tolerant)
CREATE OR REPLACE FUNCTION public.normalize_phone_number(_raw text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE d text;
BEGIN
  IF _raw IS NULL THEN RETURN NULL; END IF;
  d := regexp_replace(_raw, '\D', '', 'g');
  IF d = '' THEN RETURN NULL; END IF;
  IF length(d) = 12 AND left(d, 2) = '91' THEN d := right(d, 10); END IF;
  IF length(d) = 11 AND left(d, 1) = '0' THEN d := right(d, 10); END IF;
  IF length(d) < 10 OR length(d) > 15 THEN RETURN NULL; END IF;
  RETURN d;
END;
$$;

-- 2. Normalized column
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_normalized text;

-- 3. Backfill, keeping only the newest row per duplicate group
WITH ranked AS (
  SELECT id,
         public.normalize_phone_number(phone) AS np,
         row_number() OVER (
           PARTITION BY public.normalize_phone_number(phone)
           ORDER BY created_at DESC NULLS LAST, id
         ) AS rn
  FROM public.profiles
  WHERE public.normalize_phone_number(phone) IS NOT NULL
)
UPDATE public.profiles p
SET phone_normalized = r.np
FROM ranked r
WHERE p.id = r.id AND r.rn = 1;

-- 4. Race-safe uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_normalized_key
  ON public.profiles (phone_normalized)
  WHERE phone_normalized IS NOT NULL;

-- 5. Keep the normalized column in sync + validate formats
CREATE OR REPLACE FUNCTION public.profiles_normalize_and_validate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE np text;
BEGIN
  IF NEW.email IS NOT NULL THEN
    NEW.email := lower(btrim(NEW.email));
    IF NEW.email = '' THEN
      NEW.email := NULL;
    ELSIF NOT public.is_valid_email(NEW.email) THEN
      RAISE EXCEPTION 'Invalid email address: %', NEW.email
        USING ERRCODE = '23514', HINT = 'invalid_email';
    END IF;
  END IF;

  IF NEW.phone IS NOT NULL AND btrim(NEW.phone) = '' THEN
    NEW.phone := NULL;
  END IF;

  IF NEW.phone IS NULL THEN
    NEW.phone_normalized := NULL;
    RETURN NEW;
  END IF;

  np := public.normalize_phone_number(NEW.phone);
  IF np IS NULL THEN
    RAISE EXCEPTION 'Invalid phone number: %', NEW.phone
      USING ERRCODE = '23514', HINT = 'invalid_phone';
  END IF;

  -- Preserve legacy duplicate rows: only enforce when the value actually changes.
  IF TG_OP = 'UPDATE' AND OLD.phone_normalized IS NULL
     AND public.normalize_phone_number(OLD.phone) = np THEN
    NEW.phone_normalized := NULL;
    RETURN NEW;
  END IF;

  NEW.phone_normalized := np;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_normalize_and_validate ON public.profiles;
CREATE TRIGGER trg_profiles_normalize_and_validate
  BEFORE INSERT OR UPDATE OF email, phone ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_normalize_and_validate();

-- 6. Enumeration-safe availability check used by the signup form
CREATE OR REPLACE FUNCTION public.is_phone_available(_phone text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.normalize_phone_number(_phone) IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.profiles
       WHERE phone_normalized = public.normalize_phone_number(_phone)
     );
$$;

REVOKE ALL ON FUNCTION public.is_phone_available(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_phone_available(text) TO anon, authenticated, service_role;

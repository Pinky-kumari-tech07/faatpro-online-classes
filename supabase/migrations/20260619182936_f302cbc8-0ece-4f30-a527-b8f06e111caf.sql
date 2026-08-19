ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz,
  ADD COLUMN IF NOT EXISTS total_login_count integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON public.profiles(is_active);

-- Allow users to update their OWN last_login_at / total_login_count via existing
-- "update own profile" policy (already present). No new policies needed.
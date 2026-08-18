
-- Extend profiles with instructor/student signup metadata
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS signup_role text,
  ADD COLUMN IF NOT EXISTS expertise text,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS years_experience integer,
  ADD COLUMN IF NOT EXISTS linkedin_url text,
  ADD COLUMN IF NOT EXISTS teaching_sample_url text,
  ADD COLUMN IF NOT EXISTS instructor_status text;

-- Agreement acceptance log
CREATE TABLE IF NOT EXISTS public.user_agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  workspace_id uuid,
  accepted_terms boolean NOT NULL DEFAULT false,
  accepted_privacy boolean NOT NULL DEFAULT false,
  accepted_code_of_conduct boolean NOT NULL DEFAULT false,
  role_at_signup text,
  agreement_version text NOT NULL DEFAULT 'v1',
  ip_address text,
  user_agent text,
  accepted_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_agreements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ua_select_own"
  ON public.user_agreements FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "ua_insert_own"
  ON public.user_agreements FOR INSERT
  WITH CHECK (user_id = auth.uid());

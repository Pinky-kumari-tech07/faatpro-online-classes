CREATE INDEX IF NOT EXISTS idx_payout_requests_workspace_status
  ON public.payout_requests (workspace_id, status, created_at DESC);

CREATE OR REPLACE FUNCTION public.payouts_block_duplicate_open()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('requested', 'approved') THEN
    IF EXISTS (
      SELECT 1 FROM public.payout_requests
      WHERE workspace_id = NEW.workspace_id
        AND instructor_id = NEW.instructor_id
        AND status IN ('requested', 'approved')
        AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) THEN
      RAISE EXCEPTION 'You already have a pending withdrawal request. Please wait for it to be processed.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payouts_block_duplicate_open ON public.payout_requests;
CREATE TRIGGER trg_payouts_block_duplicate_open
BEFORE INSERT OR UPDATE ON public.payout_requests
FOR EACH ROW EXECUTE FUNCTION public.payouts_block_duplicate_open();
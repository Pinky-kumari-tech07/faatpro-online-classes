
ALTER TABLE public.gst_settings
  ADD COLUMN IF NOT EXISTS signatory_designation text,
  ADD COLUMN IF NOT EXISTS invoice_footer_text text,
  ADD COLUMN IF NOT EXISTS invoice_notes text,
  ADD COLUMN IF NOT EXISTS enable_gst boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS enable_invoice_logo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS enable_qr_code boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS enable_digital_signature boolean NOT NULL DEFAULT true;

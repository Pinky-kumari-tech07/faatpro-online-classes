/**
 * Central mapper that turns raw Postgres / PostgREST / Supabase errors into
 * short, human-readable messages. No SQL text, constraint names or driver
 * internals should ever reach the UI.
 */

const CONSTRAINT_MESSAGES: Record<string, string> = {
  payments_amount_positive: "Payment amount must be greater than 0.",
  payments_gateway_txn_required: "A successful gateway payment needs a transaction ID.",
  payments_currency_valid: "That currency is not supported.",
  uniq_paid_course_enrollment: "A successful payment already exists for this student and course.",
  uniq_paid_bundle_enrollment: "A successful payment already exists for this student and bundle.",
  batches_date_order: "End date must be on or after the start date.",
  course_categories_name_valid: "Category name must contain at least one letter.",
  gst_settings_gstin_valid: "GSTIN must be 15 characters in the format 22AAAAA0000A1Z5.",
  gst_settings_rate_range: "GST rate must be between 0 and 28%.",
  gst_settings_email_valid: "Business email must be a valid address.",
  gst_settings_phone_valid: "Business phone must be 10–15 digits.",
  gst_settings_company_name_valid: "Company name must contain at least one letter.",
  live_classes_url_https: "Meeting URL must be a valid https:// link.",
  live_classes_time_order: "End time must be after the start time.",
};

const CODE_MESSAGES: Record<string, string> = {
  "23505": "This record already exists.",
  "23503": "This item is linked to other records and cannot be changed.",
  "23502": "A required field is missing.",
  "23514": "Some of the values entered are not allowed.",
  "22P02": "One of the values has the wrong format.",
  "22003": "A number entered is out of the allowed range.",
  "42501": "You do not have permission to perform this action.",
  "P0001": "", // raised by triggers — prefer the trigger's own message
  PGRST301: "Your session has expired. Please sign in again.",
  PGRST116: "The requested record was not found.",
};

const RAW_LEAK_PATTERNS = [
  /duplicate key value/i,
  /violates .* constraint/i,
  /relation ".*" does not exist/i,
  /^new row for relation/i,
  /permission denied for/i,
  /invalid input syntax/i,
  /null value in column/i,
  /pg[a-z]*:/i,
];

function findConstraint(text: string): string | undefined {
  const match = text.match(/constraint "([^"]+)"/i) ?? text.match(/"([a-z0-9_]+)" *$/i);
  return match?.[1];
}

/** Returns a safe, user-facing message for any thrown/returned error. */
export function mapDbError(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (!error) return fallback;
  const err = error as any;
  const code = String(err?.code ?? "");
  const raw = [err?.message, err?.details, err?.hint].filter(Boolean).join(" ");

  // 1. Explicit constraint mapping (most specific).
  const constraint = err?.constraint ?? findConstraint(raw);
  if (constraint && CONSTRAINT_MESSAGES[constraint]) return CONSTRAINT_MESSAGES[constraint];
  for (const key of Object.keys(CONSTRAINT_MESSAGES)) {
    if (raw.includes(key)) return CONSTRAINT_MESSAGES[key];
  }

  // 2. Messages raised deliberately by our own triggers/RPCs are already friendly.
  if ((code === "P0001" || !code) && raw && !RAW_LEAK_PATTERNS.some((p) => p.test(raw))) {
    return raw.trim();
  }

  // 3. Generic SQLSTATE mapping.
  if (code && CODE_MESSAGES[code]) return CODE_MESSAGES[code];

  // 4. Never leak raw SQL.
  if (raw && RAW_LEAK_PATTERNS.some((p) => p.test(raw))) return fallback;
  return raw?.trim() || fallback;
}

/** Convenience helper for toast blocks. */
export function toastError(error: unknown, fallback?: string) {
  return { description: mapDbError(error, fallback) };
}
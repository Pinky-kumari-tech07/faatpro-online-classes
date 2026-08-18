import { fail, ok, type ValidationResult } from "./types";

/** 15 chars: 2 state digits + 5 letters + 4 digits + 1 letter + 1 alnum + 'Z' + 1 alnum. */
export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{1}Z[A-Z0-9]{1}$/;
export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

/** Indian GST slabs supported by FAATPRO. */
export const GST_SLABS = [0, 0.25, 3, 5, 12, 18, 28];

export function isValidGstin(value: unknown): boolean {
  return GSTIN_REGEX.test(String(value ?? "").trim().toUpperCase());
}

export function validateGstin(
  value: unknown,
  opts: { required?: boolean } = {},
): ValidationResult {
  const v = String(value ?? "").trim().toUpperCase();
  if (!v) return opts.required ? fail("GSTIN is required") : ok();
  if (v.length !== 15) return fail("GSTIN must be exactly 15 characters");
  if (!GSTIN_REGEX.test(v)) return fail("GSTIN format is invalid (e.g. 22AAAAA0000A1Z5)");
  return ok();
}

export function validatePan(value: unknown, opts: { required?: boolean } = {}): ValidationResult {
  const v = String(value ?? "").trim().toUpperCase();
  if (!v) return opts.required ? fail("PAN is required") : ok();
  if (!PAN_REGEX.test(v)) return fail("PAN must be 10 characters (e.g. AAAAA0000A)");
  return ok();
}

/** GST percentage: numeric, 0–28, and must match a legal Indian slab. */
export function validateGstRate(
  value: unknown,
  opts: { allowAnyWithinRange?: boolean } = {},
): ValidationResult {
  const raw = String(value ?? "").trim();
  if (!raw) return fail("GST rate is required");
  const n = Number(raw);
  if (!Number.isFinite(n)) return fail("GST rate must be a number");
  if (n < 0 || n > 28) return fail("GST rate must be between 0 and 28%");
  if (!opts.allowAnyWithinRange && !GST_SLABS.includes(n)) {
    return fail(`GST rate must be a valid Indian slab: ${GST_SLABS.join(", ")}%`);
  }
  return ok();
}

/** HSN/SAC codes are 4, 6 or 8 digits. */
export function validateHsnSac(value: unknown, opts: { required?: boolean } = {}): ValidationResult {
  const v = String(value ?? "").trim();
  if (!v) return opts.required ? fail("HSN/SAC is required") : ok();
  if (!/^[0-9]{4}([0-9]{2}([0-9]{2})?)?$/.test(v)) return fail("HSN/SAC must be 4, 6 or 8 digits");
  return ok();
}
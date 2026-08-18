import { fail, ok, type ValidationResult } from "./types";

/** Optional leading +, then 10–15 digits (E.164 upper bound). Spaces/dashes tolerated. */
export function normalizePhone(value: unknown): string {
  return String(value ?? "").trim().replace(/[\s()\-.]/g, "");
}

export function isValidPhone(value: unknown): boolean {
  const v = normalizePhone(value);
  return /^\+?[0-9]{10,15}$/.test(v);
}

export function validatePhone(
  value: unknown,
  opts: { required?: boolean; label?: string } = {},
): ValidationResult {
  const label = opts.label ?? "Phone";
  const raw = String(value ?? "").trim();
  if (!raw) return opts.required ? fail(`${label} is required`) : ok();
  if (/[A-Za-z]/.test(raw)) return fail(`${label} must contain digits only (an optional + is allowed)`);
  if (!isValidPhone(raw)) return fail(`${label} must be 10–15 digits, optionally starting with +`);
  return ok();
}

/** Indian PIN code: exactly 6 digits, cannot start with 0. */
export function validatePincode(value: unknown, opts: { required?: boolean } = {}): ValidationResult {
  const v = String(value ?? "").trim();
  if (!v) return opts.required ? fail("PIN code is required") : ok();
  if (!/^[1-9][0-9]{5}$/.test(v)) return fail("PIN code must be 6 digits");
  return ok();
}
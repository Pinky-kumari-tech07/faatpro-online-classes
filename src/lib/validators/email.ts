import { fail, ok, type ValidationResult } from "./types";

/** Pragmatic RFC-5322 subset: local@domain.tld, no spaces, single @, real TLD. */
export const EMAIL_REGEX =
  /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/;

export function isValidEmail(value: unknown): boolean {
  const v = String(value ?? "").trim();
  if (!v || v.length > 254) return false;
  if (v.includes("..")) return false;
  return EMAIL_REGEX.test(v);
}

export function validateEmail(
  value: unknown,
  opts: { required?: boolean; label?: string } = {},
): ValidationResult {
  const label = opts.label ?? "Email";
  const v = String(value ?? "").trim();
  if (!v) return opts.required ? fail(`${label} is required`) : ok();
  if (!isValidEmail(v)) return fail(`${label} must be a valid address like name@company.com`);
  return ok();
}

export const normalizeEmail = (value: unknown) => String(value ?? "").trim().toLowerCase();
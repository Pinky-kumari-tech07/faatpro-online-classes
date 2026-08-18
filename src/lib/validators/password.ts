import { fail, ok, type ValidationResult } from "./types";

export const PASSWORD_MIN_LENGTH = 8;

export type PasswordRule = { id: string; label: string; test: (v: string) => boolean };

/**
 * FAATPRO password policy. Kept in one place so signup, reset-password and any
 * admin-created account share exactly the same rules.
 */
export const PASSWORD_RULES: PasswordRule[] = [
  { id: "length", label: `At least ${PASSWORD_MIN_LENGTH} characters`, test: (v) => v.length >= PASSWORD_MIN_LENGTH },
  { id: "upper", label: "One uppercase letter (A–Z)", test: (v) => /[A-Z]/.test(v) },
  { id: "lower", label: "One lowercase letter (a–z)", test: (v) => /[a-z]/.test(v) },
  { id: "digit", label: "One number (0–9)", test: (v) => /[0-9]/.test(v) },
  { id: "symbol", label: "One special character (!@#$…)", test: (v) => /[^A-Za-z0-9]/.test(v) },
];

const COMMON = new Set([
  "password", "password1", "password123", "12345678", "123456789", "1234567890",
  "qwerty123", "welcome1", "admin123", "letmein1", "iloveyou", "abc12345",
]);

export function failedPasswordRules(value: string): PasswordRule[] {
  return PASSWORD_RULES.filter((r) => !r.test(value ?? ""));
}

export function isStrongPassword(value: unknown): boolean {
  return validatePassword(value).valid;
}

export function validatePassword(
  value: unknown,
  opts: { label?: string } = {},
): ValidationResult {
  const label = opts.label ?? "Password";
  const v = String(value ?? "");
  if (!v) return fail(`${label} is required`);
  if (v.length > 72) return fail(`${label} must be 72 characters or fewer`);
  if (COMMON.has(v.toLowerCase())) return fail(`${label} is too common — choose something less predictable`);
  if (/^(.)\1+$/.test(v)) return fail(`${label} cannot be a single repeated character`);
  const missing = failedPasswordRules(v);
  if (missing.length) return fail(`${label} needs: ${missing.map((m) => m.label.toLowerCase()).join(", ")}`);
  return ok();
}

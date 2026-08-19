import { fail, ok, type ValidationResult } from "./types";

/** At least one alphabet character must be present. */
export const HAS_ALPHA = /[A-Za-z]/;

/** Letters, numbers, space and & - ( ) . , ' / */
export const SAFE_NAME_REGEX = /^[A-Za-z0-9 &\-().,'\/]+$/;

export function validateName(
  value: unknown,
  opts: { label?: string; required?: boolean; min?: number; max?: number } = {},
): ValidationResult {
  const label = opts.label ?? "Name";
  const min = opts.min ?? 2;
  const max = opts.max ?? 100;
  const v = String(value ?? "").trim();
  if (!v) return opts.required === false ? ok() : fail(`${label} is required`);
  if (v.length < min) return fail(`${label} must be at least ${min} characters`);
  if (v.length > max) return fail(`${label} must be under ${max} characters`);
  if (!HAS_ALPHA.test(v)) return fail(`${label} must contain at least one letter`);
  if (!SAFE_NAME_REGEX.test(v)) {
    return fail(`${label} can only use letters, numbers, spaces and & - ( ) . , ' /`);
  }
  return ok();
}

/** Category names — same rule set as names, tuned copy. */
export const validateCategoryName = (value: unknown) =>
  validateName(value, { label: "Category name", min: 2, max: 60 });

/** Company / legal entity names. */
export const validateCompanyName = (value: unknown) =>
  validateName(value, { label: "Company name", min: 2, max: 120 });

export function validateSlug(value: unknown, opts: { required?: boolean } = {}): ValidationResult {
  const v = String(value ?? "").trim();
  if (!v) return opts.required ? fail("Slug is required") : ok();
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(v)) {
    return fail("Slug can only use lowercase letters, numbers and hyphens");
  }
  return ok();
}
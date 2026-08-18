import { fail, ok, type ValidationResult } from "./types";

export const SUPPORTED_CURRENCIES = ["INR", "USD", "EUR", "GBP"];

/**
 * Money amount validator. By default a positive amount is required —
 * zero and negative values are rejected everywhere a charge is recorded.
 */
export function validateAmount(
  value: unknown,
  opts: { label?: string; allowZero?: boolean; max?: number; required?: boolean } = {},
): ValidationResult {
  const label = opts.label ?? "Amount";
  const raw = String(value ?? "").trim();
  if (!raw) return opts.required === false ? ok() : fail(`${label} is required`);
  const n = Number(raw);
  if (!Number.isFinite(n)) return fail(`${label} must be a number`);
  if (n < 0) return fail(`${label} cannot be negative`);
  if (!opts.allowZero && n === 0) return fail(`${label} must be greater than 0`);
  if (opts.max != null && n > opts.max) return fail(`${label} cannot exceed ${opts.max}`);
  if (Math.round(n * 100) !== Number((n * 100).toFixed(0))) {
    return fail(`${label} can have at most 2 decimal places`);
  }
  return ok();
}

export function validateCurrency(value: unknown): ValidationResult {
  const v = String(value ?? "").trim().toUpperCase();
  if (!v) return fail("Currency is required");
  if (!SUPPORTED_CURRENCIES.includes(v)) {
    return fail(`Currency must be one of ${SUPPORTED_CURRENCIES.join(", ")}`);
  }
  return ok();
}

/** Percentage 0–100 (commission splits, discounts). */
export function validatePercent(
  value: unknown,
  opts: { label?: string; min?: number; max?: number } = {},
): ValidationResult {
  const label = opts.label ?? "Percentage";
  const min = opts.min ?? 0;
  const max = opts.max ?? 100;
  const raw = String(value ?? "").trim();
  if (!raw) return fail(`${label} is required`);
  const n = Number(raw);
  if (!Number.isFinite(n)) return fail(`${label} must be a number`);
  if (n < min || n > max) return fail(`${label} must be between ${min} and ${max}`);
  return ok();
}
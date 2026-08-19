import { validateEmail } from "./email";
import { validatePhone } from "./phone";
import { validateName } from "./text";
import { collectErrors, fail, ok, type ValidationResult } from "./types";

export function validateDateOrder(
  start: unknown,
  end: unknown,
  opts: { startLabel?: string; endLabel?: string; allowEqual?: boolean } = {},
): ValidationResult {
  const startLabel = opts.startLabel ?? "Start date";
  const endLabel = opts.endLabel ?? "End date";
  if (!start || !end) return ok();
  const s = new Date(String(start)).getTime();
  const e = new Date(String(end)).getTime();
  if (!Number.isFinite(s)) return fail(`${startLabel} is invalid`);
  if (!Number.isFinite(e)) return fail(`${endLabel} is invalid`);
  if (opts.allowEqual === false ? e <= s : e < s) {
    return fail(`${endLabel} must be on or after ${startLabel.toLowerCase()}`);
  }
  return ok();
}

export type BatchInputLike = {
  name?: unknown;
  coordinator_name?: unknown;
  coordinator_email?: unknown;
  coordinator_phone?: unknown;
  start_date?: unknown;
  end_date?: unknown;
  duration_type?: unknown;
};

export function validateBatch(input: BatchInputLike): Record<string, string> {
  const isCustom = String(input.duration_type ?? "") === "custom";
  return collectErrors([
    ["name", validateName(input.name, { label: "Batch name", min: 2, max: 80 })],
    ["coordinator_name", validateName(input.coordinator_name, { label: "Batch coordinator", min: 2, max: 80 })],
    ["coordinator_email", validateEmail(input.coordinator_email, { label: "Coordinator email" })],
    ["coordinator_phone", validatePhone(input.coordinator_phone, { label: "Coordinator phone" })],
    ["start_date", input.start_date ? ok() : fail("Start date is required")],
    ["duration_type", input.duration_type ? ok() : fail("Batch duration is required")],
    ["end_date", isCustom && !input.end_date
      ? fail("End date is required for custom duration")
      : validateDateOrder(input.start_date, input.end_date)],
  ]);
}
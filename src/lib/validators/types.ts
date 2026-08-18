/** Shared result shape for every validator in the FAATPRO validation layer. */
export type ValidationResult = { valid: true } | { valid: false; message: string };

export const ok = (): ValidationResult => ({ valid: true });
export const fail = (message: string): ValidationResult => ({ valid: false, message });

/** Runs a list of [field, result] pairs and returns a field -> message map. */
export function collectErrors(
  entries: Array<[string, ValidationResult]>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const [field, result] of entries) {
    if (result.valid === false) errors[field] = result.message;
  }
  return errors;
}

/** Throws with the first error message — used by service-layer (backend) guards. */
export function assertValid(entries: Array<[string, ValidationResult]>): void {
  const errors = collectErrors(entries);
  const first = Object.values(errors)[0];
  if (first) throw new Error(first);
}
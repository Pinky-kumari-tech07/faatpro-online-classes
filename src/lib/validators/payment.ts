import { validateAmount, validateCurrency } from "./currency";
import { collectErrors, fail, ok, type ValidationResult } from "./types";

/** Providers that settle through a gateway and therefore always carry a reference. */
export const GATEWAY_PROVIDERS = ["razorpay", "stripe", "paypal", "payu", "cashfree"];

export function requiresTransactionId(provider: unknown, status: unknown): boolean {
  const p = String(provider ?? "").toLowerCase();
  const s = String(status ?? "").toLowerCase();
  return GATEWAY_PROVIDERS.includes(p) && s === "succeeded";
}

export function validateTransactionId(
  value: unknown,
  provider: unknown,
  status: unknown,
): ValidationResult {
  const v = String(value ?? "").trim();
  if (!requiresTransactionId(provider, status)) {
    if (v && !/^[A-Za-z0-9_\-]{4,64}$/.test(v)) {
      return fail("Transaction ID can only use letters, numbers, - and _ (4–64 chars)");
    }
    return ok();
  }
  if (!v) return fail("Transaction ID is required for a successful gateway payment");
  if (!/^[A-Za-z0-9_\-]{4,64}$/.test(v)) {
    return fail("Transaction ID can only use letters, numbers, - and _ (4–64 chars)");
  }
  return ok();
}

export type PaymentInput = {
  student_id?: string | null;
  amount?: unknown;
  currency?: unknown;
  provider?: unknown;
  status?: unknown;
  transaction_id?: unknown;
};

/** Single source of truth for payment form + service validation. */
export function validatePayment(input: PaymentInput): Record<string, string> {
  return collectErrors([
    ["student_id", input.student_id ? ok() : fail("Select a student")],
    ["amount", validateAmount(input.amount, { label: "Amount" })],
    ["currency", validateCurrency(input.currency)],
    ["provider", String(input.provider ?? "").trim() ? ok() : fail("Select a payment provider")],
    ["status", String(input.status ?? "").trim() ? ok() : fail("Select a payment status")],
    ["transaction_id", validateTransactionId(input.transaction_id, input.provider, input.status)],
  ]);
}
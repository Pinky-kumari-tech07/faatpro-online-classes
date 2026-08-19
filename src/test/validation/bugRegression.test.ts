import { describe, it, expect } from "vitest";
import {
  validatePayment, validateTransactionId, validateAmount, validateCurrency,
  validateCategoryName, validateBatch, validateDateOrder, validateMeetingUrl,
  validateCompanyName, validateGstin, validateGstRate, validateEmail, validatePhone,
} from "@/lib/validators";
import { mapDbError } from "@/lib/errorMapper";
import { normalizeMeetingUrl } from "@/lib/meetingUrl";

const msg = (r: any) => (r.valid ? "" : r.message);

describe("BUG-001 gateway payment requires transaction id", () => {
  it("rejects succeeded razorpay payment without txn id", () => {
    expect(validateTransactionId("", "razorpay", "succeeded").valid).toBe(false);
    expect(validatePayment({ student_id: "s1", amount: 100, currency: "INR", provider: "razorpay", status: "succeeded" }).transaction_id).toBeTruthy();
  });
  it("allows offline cash without txn id", () => {
    expect(validatePayment({ student_id: "s1", amount: 100, currency: "INR", provider: "offline", status: "succeeded" })).toEqual({});
  });
  it("rejects malformed txn id", () => {
    expect(validateTransactionId("ab", "razorpay", "succeeded").valid).toBe(false);
    expect(validateTransactionId("pay_ABC123456", "razorpay", "succeeded").valid).toBe(true);
  });
});

describe("BUG-003 / BUG-005 amount boundaries", () => {
  it.each([0, -1, -0.01, "0", "abc", "", null, undefined, NaN, Infinity])("rejects %p", (v) => {
    expect(validateAmount(v as any).valid).toBe(false);
  });
  it.each([0.01, 1, 999999])("accepts %p", (v) => {
    expect(validateAmount(v).valid).toBe(true);
  });
  it("rejects unsupported currency", () => {
    expect(validateCurrency("XYZ").valid).toBe(false);
    expect(validateCurrency("inr").valid).toBe(true);
  });
});

describe("BUG-004 no raw database errors leak", () => {
  it.each([
    { code: "23514", message: 'new row for relation "payments" violates check constraint "payments_amount_positive"' },
    { code: "23505", message: "duplicate key value violates unique constraint \"uniq_paid_course_enrollment\"" },
    { code: "42501", message: "permission denied for table payments" },
    { code: "22P02", message: "invalid input syntax for type numeric: \"abc\"" },
  ])("maps $code to a friendly message", (err) => {
    const out = mapDbError(err);
    expect(out).not.toMatch(/constraint|relation|permission denied for|invalid input syntax|duplicate key/i);
    expect(out.length).toBeGreaterThan(5);
  });
  it("falls back safely for unknown errors", () => {
    expect(mapDbError(null)).toMatch(/went wrong/i);
  });
});

describe("BUG-006 category names", () => {
  it.each(["123", "!!!", "   ", "@#$%", ""])("rejects %p", (v) => {
    expect(validateCategoryName(v).valid).toBe(false);
  });
  it("accepts real names", () => {
    expect(validateCategoryName("Data Science & AI").valid).toBe(true);
  });
});

describe("BUG-007 / BUG-014 / BUG-015 email & phone", () => {
  it.each(["abc", "a@b", "a b@c.com", "@x.com", "x@.com"])("rejects email %p", (v) => {
    expect(validateEmail(v, { required: true }).valid).toBe(false);
  });
  it("accepts valid email", () => {
    expect(validateEmail("student.name+1@faatpro.com").valid).toBe(true);
  });
  it.each(["123", "abcdefghij", "12345678901234567890"])("rejects phone %p", (v) => {
    expect(validatePhone(v).valid).toBe(false);
  });
  it("accepts Indian mobile", () => {
    expect(validatePhone("+91 98765 43210").valid).toBe(true);
  });
});

describe("BUG-008 date ordering", () => {
  it("rejects end before start", () => {
    expect(validateDateOrder("2026-05-10", "2026-05-01").valid).toBe(false);
  });
  it("allows equal dates for batches", () => {
    expect(validateDateOrder("2026-05-10", "2026-05-10").valid).toBe(true);
  });
  it("rejects equal times when allowEqual is false", () => {
    expect(validateDateOrder("2026-05-10T10:00", "2026-05-10T10:00", { allowEqual: false }).valid).toBe(false);
  });
  it("batch form surfaces the error", () => {
    const errors = validateBatch({
      name: "Batch A", coordinator_name: "Ravi Kumar", start_date: "2026-05-10",
      end_date: "2026-05-01", duration_type: "custom",
    });
    expect(errors.end_date).toBeTruthy();
  });
});

describe("BUG-009 meeting URL", () => {
  it.each(["abcd123", "meet", "ftp://x.com/a", "javascript:alert(1)", "http://meet.google.com/x"])("rejects %p", (v) => {
    expect(validateMeetingUrl(v, { required: true }).valid).toBe(false);
  });
  it("accepts a real https link", () => {
    expect(validateMeetingUrl("https://meet.google.com/abc-defg-hij").valid).toBe(true);
  });
  it("never fabricates a link from junk text", () => {
    expect(normalizeMeetingUrl("abcd123")).toBe("");
    expect(normalizeMeetingUrl("meet.google.com/abc")).toBe("https://meet.google.com/abc");
  });
});

describe("BUG-011 / BUG-012 / BUG-013 / BUG-016 GST settings", () => {
  it.each(["123", "!!!", "  "])("rejects company name %p", (v) => {
    expect(validateCompanyName(v).valid).toBe(false);
  });
  it.each(["12345", "22AAAAA0000A1Z", "AAAAA00000A1Z5"])("rejects GSTIN %p", (v) => {
    expect(validateGstin(v).valid).toBe(false);
  });
  it("accepts a valid GSTIN", () => {
    expect(validateGstin("22AAAAA0000A1Z5").valid).toBe(true);
  });
  it.each([-1, 29, 100, "abc", ""])("rejects GST rate %p", (v) => {
    expect(validateGstRate(v).valid).toBe(false);
  });
  it("rejects non-slab rates and accepts slabs", () => {
    expect(validateGstRate(7).valid).toBe(false);
    expect(validateGstRate(18).valid).toBe(true);
    expect(msg(validateGstRate(0))).toBe("");
  });
});

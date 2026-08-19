import { supabase } from "@/integrations/supabase/client";

/**
 * SINGLE SOURCE OF TRUTH FOR REVENUE.
 *
 * Dashboard, Reports, GST reports, Analytics, Instructor revenue and every
 * export must derive their numbers from `getRevenueSummary` so the same period
 * can never produce two different totals.
 *
 * Canonical rules:
 *  - Revenue = payments with status 'succeeded'.
 *  - Amount  = total_amount when present, else amount (gross, tax inclusive).
 *  - Net revenue = gross − tax collected.
 *  - Windows are always inclusive whole days in local time
 *    (start-of-day .. end-of-day), never rolling "now minus N".
 */

export type RevenuePeriod = "today" | "yesterday" | "7d" | "30d" | "90d" | "this_month" | "last_month" | "this_year" | "all";

export type RevenueRange = { from: Date | null; to: Date | null };

export type RevenuePaymentRow = {
  id: string;
  status: string;
  provider: string | null;
  currency: string;
  gross: number;
  tax: number;
  discount: number;
  net: number;
  course_id: string | null;
  bundle_id: string | null;
  student_id: string | null;
  created_at: string;
  courseTitle: string;
};

export type RevenueSummary = {
  currency: string;
  gross: number;
  net: number;
  tax: number;
  discount: number;
  sales: number;
  pending: number;
  pendingCount: number;
  refunded: number;
  refundedCount: number;
  rows: RevenuePaymentRow[];
  succeeded: RevenuePaymentRow[];
  range: RevenueRange;
};

export function startOfDayLocal(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfDayLocal(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/** Canonical period -> inclusive whole-day range used by every revenue surface. */
export function resolveRevenueRange(period: RevenuePeriod): RevenueRange {
  const now = new Date();
  const days = (n: number) => {
    const from = new Date(now);
    from.setDate(from.getDate() - (n - 1));
    return { from: startOfDayLocal(from), to: endOfDayLocal(now) };
  };
  switch (period) {
    case "today": return { from: startOfDayLocal(now), to: endOfDayLocal(now) };
    case "yesterday": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { from: startOfDayLocal(y), to: endOfDayLocal(y) };
    }
    case "7d": return days(7);
    case "30d": return days(30);
    case "90d": return days(90);
    case "this_month": return { from: startOfDayLocal(new Date(now.getFullYear(), now.getMonth(), 1)), to: endOfDayLocal(now) };
    case "last_month": {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: startOfDayLocal(from), to: endOfDayLocal(to) };
    }
    case "this_year": return { from: startOfDayLocal(new Date(now.getFullYear(), 0, 1)), to: endOfDayLocal(now) };
    case "all":
    default: return { from: null, to: null };
  }
}

export function paymentGross(p: any): number {
  const n = Number(p?.total_amount ?? p?.amount ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function normalizeRow(p: any): RevenuePaymentRow {
  const gross = paymentGross(p);
  const tax = Number(p?.tax_amount ?? 0) || 0;
  return {
    id: p.id,
    status: String(p.status ?? ""),
    provider: p.provider ?? null,
    currency: p.currency ?? "INR",
    gross,
    tax,
    discount: Number(p?.discount_amount ?? 0) || 0,
    net: Math.max(0, gross - tax),
    course_id: p.course_id ?? null,
    bundle_id: p.bundle_id ?? null,
    student_id: p.student_id ?? null,
    created_at: p.created_at,
    courseTitle: p?.courses?.title ?? "—",
  };
}

export async function getRevenueSummary(params: {
  workspaceId: string;
  range?: RevenueRange;
  period?: RevenuePeriod;
  courseId?: string | null;
  studentId?: string | null;
}): Promise<RevenueSummary> {
  const range = params.range ?? resolveRevenueRange(params.period ?? "all");
  let q = supabase
    .from("payments")
    .select("id, status, provider, amount, total_amount, tax_amount, discount_amount, currency, course_id, bundle_id, student_id, created_at, courses:course_id(title)")
    .eq("workspace_id", params.workspaceId);
  if (range.from) q = q.gte("created_at", range.from.toISOString());
  if (range.to) q = q.lte("created_at", range.to.toISOString());
  if (params.courseId && params.courseId !== "all") q = q.eq("course_id", params.courseId);
  if (params.studentId) q = q.eq("student_id", params.studentId);

  const { data, error } = await q.order("created_at", { ascending: true });
  if (error) throw error;

  return summarizeRevenueRows(data ?? [], range);
}

/** Pure aggregation — exported so exports/tests can reuse identical math. */
export function summarizeRevenueRows(raw: any[], range: RevenueRange = { from: null, to: null }): RevenueSummary {
  const rows = raw.map(normalizeRow);
  const succeeded = rows.filter((r) => r.status === "succeeded");
  const pendingRows = rows.filter((r) => r.status === "pending" || r.status === "created");
  const refundedRows = rows.filter((r) => r.status === "refunded");
  const sum = (list: RevenuePaymentRow[], key: "gross" | "net" | "tax" | "discount") =>
    Math.round(list.reduce((s, r) => s + r[key], 0) * 100) / 100;

  return {
    currency: succeeded[0]?.currency ?? rows[0]?.currency ?? "INR",
    gross: sum(succeeded, "gross"),
    net: sum(succeeded, "net"),
    tax: sum(succeeded, "tax"),
    discount: sum(succeeded, "discount"),
    sales: succeeded.length,
    pending: sum(pendingRows, "gross"),
    pendingCount: pendingRows.length,
    refunded: sum(refundedRows, "gross"),
    refundedCount: refundedRows.length,
    rows,
    succeeded,
    range,
  };
}

/** Revenue grouped by course — used by Reports tables and CSV/PDF exports. */
export function revenueByCourse(summary: RevenueSummary) {
  const map = new Map<string, { courseId: string; title: string; revenue: number; sales: number }>();
  for (const r of summary.succeeded) {
    const id = r.course_id ?? "unknown";
    const e = map.get(id) ?? { courseId: id, title: r.courseTitle, revenue: 0, sales: 0 };
    e.revenue += r.gross;
    e.sales += 1;
    map.set(id, e);
  }
  return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
}

/** Daily revenue series — used by dashboard and report charts. */
export function revenueByDay(summary: RevenueSummary) {
  const map = new Map<string, { date: string; revenue: number }>();
  for (const r of summary.succeeded) {
    const key = new Date(r.created_at).toISOString().slice(0, 10);
    const e = map.get(key) ?? { date: key, revenue: 0 };
    e.revenue += r.gross;
    map.set(key, e);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v);
}
import { supabase } from "@/integrations/supabase/client";

export type RevenueRange = "today" | "week" | "month" | "last_month" | "year" | "all" | "custom";

export interface RangeBounds {
  from: Date | null;
  to: Date | null;
}

export function resolveRange(range: RevenueRange, custom?: RangeBounds): RangeBounds {
  const now = new Date();
  const start = (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  };
  const end = (d: Date) => {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
  };
  switch (range) {
    case "today":
      return { from: start(now), to: end(now) };
    case "week": {
      const d = new Date(now);
      d.setDate(d.getDate() - 6);
      return { from: start(d), to: end(now) };
    }
    case "month":
      return { from: start(new Date(now.getFullYear(), now.getMonth(), 1)), to: end(now) };
    case "last_month": {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: start(first), to: end(last) };
    }
    case "year":
      return { from: start(new Date(now.getFullYear(), 0, 1)), to: end(now) };
    case "custom":
      return { from: custom?.from ?? null, to: custom?.to ?? null };
    case "all":
    default:
      return { from: null, to: null };
  }
}

export interface EarningRow {
  id: string;
  workspace_id: string;
  instructor_id: string;
  course_id: string;
  student_id: string | null;
  payment_id: string | null;
  gross_amount: number;
  commission_percentage: number;
  commission_amount: number;
  net_earning: number;
  currency: string;
  status: "active" | "refunded" | "adjusted" | "reversed";
  earned_at: string;
  course?: { id: string; title: string; thumbnail_url: string | null; status: string } | null;
  student?: { id: string; full_name: string | null; email: string | null } | null;
}

export interface CourseRevenueSummary {
  course_id: string;
  title: string;
  thumbnail_url: string | null;
  status: string;
  students: number;
  gross: number;
  commission: number;
  net: number;
  refunds: number;
  currency: string;
}

export interface OverallSummary {
  gross: number;
  commission: number;
  net: number;
  refunds: number;
  adjustments: number;
  students: number;
  courses: number;
  paid: number;
  pendingPayout: number;
  available: number;
  currency: string;
}

export const revenueService = {
  async listEarnings(instructorId: string, bounds: RangeBounds): Promise<EarningRow[]> {
    let q = supabase
      .from("instructor_earnings")
      .select(
        "id, workspace_id, instructor_id, course_id, student_id, payment_id, gross_amount, commission_percentage, commission_amount, net_earning, currency, status, earned_at, course:courses(id, title, thumbnail_url, status), student:profiles!instructor_earnings_student_id_fkey(id, full_name, email)"
      )
      .eq("instructor_id", instructorId)
      .order("earned_at", { ascending: false });
    if (bounds.from) q = q.gte("earned_at", bounds.from.toISOString());
    if (bounds.to) q = q.lte("earned_at", bounds.to.toISOString());
    const { data, error } = await q;
    if (error) throw error;
    return (data as any[]) ?? [];
  },

  async listAdjustments(instructorId: string) {
    const { data, error } = await supabase
      .from("earning_adjustments")
      .select("id, course_id, kind, amount, currency, reason, created_at")
      .eq("instructor_id", instructorId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async listRefundsForInstructor(instructorId: string, bounds: RangeBounds) {
    const { data: courseIds } = await supabase
      .from("courses")
      .select("id")
      .eq("instructor_id", instructorId);
    const ids = (courseIds ?? []).map((c: any) => c.id);
    if (!ids.length) return [];
    let q = supabase
      .from("refunds")
      .select("id, payment_id, course_id, student_id, amount, currency, reason, status, created_at")
      .in("course_id", ids)
      .order("created_at", { ascending: false });
    if (bounds.from) q = q.gte("created_at", bounds.from.toISOString());
    if (bounds.to) q = q.lte("created_at", bounds.to.toISOString());
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  },

  async listPayouts(instructorId: string) {
    const { data, error } = await supabase
      .from("payout_requests")
      .select("id, amount, currency, status, notes, paid_at, payment_reference, created_at")
      .eq("instructor_id", instructorId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async requestPayout(workspaceId: string, instructorId: string, amount: number, currency: string, notes?: string) {
    const { data, error } = await supabase
      .from("payout_requests")
      .insert({ workspace_id: workspaceId, instructor_id: instructorId, amount, currency, notes })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async cancelPayout(payoutId: string) {
    const { error } = await supabase
      .from("payout_requests")
      .update({ status: "cancelled" })
      .eq("id", payoutId);
    if (error) throw error;
  },

  // ---------------- Admin helpers ----------------
  async listWorkspacePayouts(workspaceId: string, status?: string) {
    let q = supabase
      .from("payout_requests")
      .select(
        "id, amount, currency, status, notes, paid_at, payment_reference, reviewed_at, reviewed_by, created_at, instructor_id, workspace_id, instructor:profiles!payout_requests_instructor_id_fkey(id, full_name, email, avatar_url)"
      )
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });
    if (status && status !== "all") q = q.eq("status", status as any);
    const { data, error } = await q;
    if (error) throw error;
    return (data as any[]) ?? [];
  },

  async getInstructorBalance(instructorId: string) {
    const [earningsRes, adjustmentsRes, payoutsRes] = await Promise.all([
      supabase
        .from("instructor_earnings")
        .select("net_earning, gross_amount, commission_amount, currency, status")
        .eq("instructor_id", instructorId),
      supabase
        .from("earning_adjustments")
        .select("kind, amount")
        .eq("instructor_id", instructorId),
      supabase
        .from("payout_requests")
        .select("status, amount")
        .eq("instructor_id", instructorId),
    ]);
    const earnings = (earningsRes.data ?? []) as any[];
    const adjustments = (adjustmentsRes.data ?? []) as any[];
    const payouts = (payoutsRes.data ?? []) as any[];
    const net = earnings.reduce((a, e) => a + (Number(e.net_earning) || 0), 0);
    const gross = earnings.reduce((a, e) => a + (Number(e.gross_amount) || 0), 0);
    const adj = adjustments.reduce(
      (a, x) => a + (x.kind === "credit" ? Number(x.amount) || 0 : -(Number(x.amount) || 0)),
      0
    );
    const paid = payouts.filter((p) => p.status === "paid").reduce((a, p) => a + Number(p.amount), 0);
    const pending = payouts
      .filter((p) => p.status === "requested" || p.status === "approved")
      .reduce((a, p) => a + Number(p.amount), 0);
    return {
      gross,
      net,
      paid,
      pending,
      available: Math.max(0, net + adj - paid - pending),
      currency: earnings[0]?.currency ?? "INR",
    };
  },

  async approvePayout(payoutId: string, reviewerId: string) {
    const { error } = await supabase
      .from("payout_requests")
      .update({ status: "approved", reviewed_by: reviewerId, reviewed_at: new Date().toISOString() })
      .eq("id", payoutId);
    if (error) throw error;
  },

  async rejectPayout(payoutId: string, reviewerId: string, notes?: string) {
    const patch: any = {
      status: "rejected",
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
    };
    if (notes) patch.notes = notes;
    const { error } = await supabase.from("payout_requests").update(patch).eq("id", payoutId);
    if (error) throw error;
  },

  async markPayoutPaid(payoutId: string, reviewerId: string, paymentReference?: string, notes?: string) {
    const patch: any = {
      status: "paid",
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      paid_at: new Date().toISOString(),
    };
    if (paymentReference) patch.payment_reference = paymentReference;
    if (notes) patch.notes = notes;
    const { error } = await supabase.from("payout_requests").update(patch).eq("id", payoutId);
    if (error) throw error;
  },

  summarize(earnings: EarningRow[], refunds: { amount: number }[], adjustments: { kind: string; amount: number }[], payouts: { status: string; amount: number }[]): OverallSummary {
    let gross = 0,
      commission = 0,
      net = 0;
    const studentSet = new Set<string>();
    const courseSet = new Set<string>();
    earnings.forEach((e) => {
      gross += Number(e.gross_amount) || 0;
      commission += Number(e.commission_amount) || 0;
      net += Number(e.net_earning) || 0;
      if (e.student_id) studentSet.add(e.student_id);
      courseSet.add(e.course_id);
    });
    const refundsTotal = refunds.reduce((a, r) => a + (Number(r.amount) || 0), 0);
    const adjustmentsTotal = adjustments.reduce(
      (a, x) => a + (x.kind === "credit" ? Number(x.amount) || 0 : -(Number(x.amount) || 0)),
      0
    );
    const paid = payouts.filter((p) => p.status === "paid").reduce((a, p) => a + Number(p.amount), 0);
    const pendingPayout = payouts
      .filter((p) => p.status === "requested" || p.status === "approved")
      .reduce((a, p) => a + Number(p.amount), 0);
    const currency = earnings[0]?.currency ?? "INR";
    return {
      gross,
      commission,
      net,
      refunds: refundsTotal,
      adjustments: adjustmentsTotal,
      students: studentSet.size,
      courses: courseSet.size,
      paid,
      pendingPayout,
      available: Math.max(0, net + adjustmentsTotal - paid - pendingPayout),
      currency,
    };
  },

  summarizeByCourse(earnings: EarningRow[], refunds: { course_id: string | null; amount: number }[]): CourseRevenueSummary[] {
    const map = new Map<string, CourseRevenueSummary>();
    earnings.forEach((e) => {
      const row =
        map.get(e.course_id) ?? {
          course_id: e.course_id,
          title: e.course?.title ?? "Untitled course",
          thumbnail_url: e.course?.thumbnail_url ?? null,
          status: e.course?.status ?? "draft",
          students: 0,
          gross: 0,
          commission: 0,
          net: 0,
          refunds: 0,
          currency: e.currency,
        };
      row.students += 1;
      row.gross += Number(e.gross_amount) || 0;
      row.commission += Number(e.commission_amount) || 0;
      row.net += Number(e.net_earning) || 0;
      map.set(e.course_id, row);
    });
    refunds.forEach((r) => {
      if (!r.course_id) return;
      const row = map.get(r.course_id);
      if (row) row.refunds += Number(r.amount) || 0;
    });
    return Array.from(map.values()).sort((a, b) => b.net - a.net);
  },

  monthlyTrend(earnings: EarningRow[]) {
    const map = new Map<string, { label: string; gross: number; net: number; commission: number; students: number }>();
    earnings.forEach((e) => {
      const d = new Date(e.earned_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
      const row = map.get(key) ?? { label, gross: 0, net: 0, commission: 0, students: 0 };
      row.gross += Number(e.gross_amount) || 0;
      row.net += Number(e.net_earning) || 0;
      row.commission += Number(e.commission_amount) || 0;
      row.students += 1;
      map.set(key, row);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v);
  },
};

export function formatMoney(amount: number, currency: string = "INR") {
  try {
    return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  } catch {
    return `${currency} ${Math.round(amount || 0).toLocaleString()}`;
  }
}

export function exportToCSV(filename: string, rows: Record<string, any>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const escape = (v: any) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* -------------------------------------------------------------------------- */
/* Instructor Revenue & Settlement — Phase 1 helpers                          */
/* -------------------------------------------------------------------------- */

export type RevenueType =
  | "revenue_share"
  | "custom_share"
  | "instructor_fixed"
  | "per_student_fixed"
  | "one_time_contract"
  | "no_share";

export type SettlementFrequency =
  | "instant" | "weekly" | "monthly" | "quarterly" | "manual" | "one_time";

export const REVENUE_TYPE_LABELS: Record<RevenueType, string> = {
  revenue_share: "Revenue Share (50/50)",
  custom_share: "Custom Share",
  instructor_fixed: "Instructor Fixed Amount",
  per_student_fixed: "Per Student Fixed",
  one_time_contract: "One-Time Contract",
  no_share: "No Revenue Share",
};

export interface CourseRevenueModel {
  id: string;
  title: string;
  price_amount: number | null;
  currency: string | null;
  instructor_id: string | null;
  revenue_model: RevenueType;
  revenue_platform_pct: number | null;
  revenue_instructor_pct: number | null;
  revenue_fixed_amount: number | null;
  revenue_per_student_amount: number | null;
  revenue_one_time_amount: number | null;
  revenue_one_time_paid_at: string | null;
  revenue_min_settlement: number | null;
  revenue_max_settlement: number | null;
  settlement_frequency: SettlementFrequency;
  instructor?: { full_name: string | null; email: string | null } | null;
}

export const settlementService = {
  /* ------------ Revenue Models on Courses ------------ */
  async listCourseRevenueModels(workspaceId: string): Promise<CourseRevenueModel[]> {
    const { data, error } = await supabase
      .from("courses")
      .select(
        "id, title, price_amount, currency, instructor_id, revenue_model, revenue_platform_pct, revenue_instructor_pct, revenue_fixed_amount, revenue_per_student_amount, revenue_one_time_amount, revenue_one_time_paid_at, revenue_min_settlement, revenue_max_settlement, settlement_frequency, instructor:profiles!courses_instructor_id_fkey(full_name, email)"
      )
      .eq("workspace_id", workspaceId)
      .order("title");
    if (error) throw error;
    return (data as any[]) ?? [];
  },

  async updateCourseRevenueModel(courseId: string, patch: Partial<CourseRevenueModel>) {
    const { error } = await supabase.from("courses").update(patch as any).eq("id", courseId);
    if (error) throw error;
  },

  /* ------------ Admin earnings feed ------------ */
  async listWorkspaceEarnings(workspaceId: string, filters?: {
    instructorId?: string; courseId?: string; status?: string; from?: string; to?: string;
  }) {
    let q = supabase
      .from("instructor_earnings")
      .select(
        "id, workspace_id, instructor_id, course_id, student_id, payment_id, gross_amount, tax_amount, discount_amount, net_revenue_base, commission_percentage, commission_amount, net_earning, revenue_model, settlement_status, status, currency, earned_at, settled_amount, refunded_amount, course:courses(id, title, revenue_model), student:profiles!instructor_earnings_student_id_fkey(id, full_name, email), instructor:profiles!instructor_earnings_instructor_id_fkey(id, full_name, email)"
      )
      .eq("workspace_id", workspaceId)
      .order("earned_at", { ascending: false })
      .limit(500);
    if (filters?.instructorId) q = q.eq("instructor_id", filters.instructorId);
    if (filters?.courseId) q = q.eq("course_id", filters.courseId);
    if (filters?.status && filters.status !== "all") q = q.eq("settlement_status", filters.status as any);
    if (filters?.from) q = q.gte("earned_at", filters.from);
    if (filters?.to) q = q.lte("earned_at", filters.to);
    const { data, error } = await q;
    if (error) throw error;
    return (data as any[]) ?? [];
  },

  /* ------------ Settlement Requests ------------ */
  async listSettlements(workspaceId: string, status?: string) {
    let q = supabase
      .from("payout_requests")
      .select(
        "id, settlement_number, amount, paid_amount, currency, status, notes, remarks, earnings_count, bank_snapshot, paid_at, payment_reference, reviewed_at, reviewed_by, created_at, instructor_id, workspace_id, instructor:profiles!payout_requests_instructor_id_fkey(id, full_name, email, avatar_url)"
      )
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });
    if (status && status !== "all") q = q.eq("status", status as any);
    const { data, error } = await q;
    if (error) throw error;
    return (data as any[]) ?? [];
  },

  async getSettlementDetail(id: string) {
    const [req, earnings, txns, audit] = await Promise.all([
      supabase
        .from("payout_requests")
        .select(
          "*, instructor:profiles!payout_requests_instructor_id_fkey(id, full_name, email, avatar_url)"
        )
        .eq("id", id).single(),
      supabase
        .from("instructor_earnings")
        .select(
          "id, gross_amount, tax_amount, discount_amount, net_revenue_base, commission_amount, net_earning, revenue_model, currency, earned_at, course:courses(id, title), student:profiles!instructor_earnings_student_id_fkey(id, full_name, email)"
        )
        .eq("settlement_request_id", id),
      supabase
        .from("settlement_transactions")
        .select("*")
        .eq("settlement_request_id", id)
        .order("paid_at", { ascending: false }),
      supabase
        .from("settlement_audit_log")
        .select("*, actor:profiles!settlement_audit_log_actor_id_fkey(full_name, email)")
        .eq("settlement_request_id", id)
        .order("created_at", { ascending: false }),
    ]);
    if (req.error) throw req.error;
    return {
      request: req.data,
      earnings: earnings.data ?? [],
      transactions: txns.data ?? [],
      audit: audit.data ?? [],
    };
  },

  async instructorRequestSettlement(workspaceId: string, notes?: string) {
    const { data, error } = await supabase.rpc("instructor_request_settlement", {
      _workspace_id: workspaceId, _notes: notes ?? null,
    });
    if (error) throw error;
    return data as string;
  },

  async updateSettlementStatus(id: string, status: "approved" | "rejected" | "on_hold" | "requested", remarks?: string) {
    const { error } = await supabase.rpc("admin_update_settlement_status", {
      _request_id: id, _new_status: status, _remarks: remarks ?? null,
    });
    if (error) throw error;
  },

  async recordPayment(id: string, amount: number, mode: string, reference?: string, notes?: string) {
    const { data, error } = await supabase.rpc("admin_pay_settlement", {
      _request_id: id, _amount: amount, _mode: mode, _reference: reference ?? null, _notes: notes ?? null,
    });
    if (error) throw error;
    return data as string;
  },

  async verifyInstructorBank(instructorProfileId: string, verified: boolean, notes?: string) {
    const { error } = await supabase.rpc("admin_verify_instructor_bank", {
      _instructor_profile_id: instructorProfileId, _verified: verified, _notes: notes ?? null,
    });
    if (error) throw error;
  },

  async getInstructorBankProfile(userId: string, workspaceId: string) {
    const { data, error } = await supabase
      .from("instructor_profiles")
      .select("id, account_holder_name, bank_account_number, ifsc_code, bank_name, branch_name, upi_id, bank_document_url, bank_verified, bank_verified_at, verification_notes, user_id, workspace_id")
      .eq("user_id", userId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },
};

export const SETTLEMENT_STATUS_META: Record<string, { label: string; tone: string }> = {
  requested: { label: "Pending", tone: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" },
  approved:  { label: "Approved", tone: "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300" },
  paid:      { label: "Paid", tone: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300" },
  on_hold:   { label: "On Hold", tone: "bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300" },
  rejected:  { label: "Rejected", tone: "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300" },
  cancelled: { label: "Cancelled", tone: "bg-muted text-muted-foreground" },
};
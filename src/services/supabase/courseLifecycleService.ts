import { supabase } from "@/integrations/supabase/client";

async function getAuditContext(): Promise<{ ip: string | null; ua: string | null }> {
  let ip: string | null = null;
  try {
    const r = await fetch("https://api.ipify.org?format=json");
    if (r.ok) ip = (await r.json()).ip ?? null;
  } catch { /* best-effort */ }
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : null;
  return { ip, ua };
}

export interface CourseDeletionRequest {
  id: string;
  workspace_id: string;
  course_id: string;
  requested_by: string;
  reason: string | null;
  status: "pending" | "approved" | "rejected" | "archived" | "deleted" | "cancelled";
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  executed_at: string | null;
  execution_type: string | null;
  created_at: string;
  updated_at: string;
  course?: { id: string; title: string; status: string; instructor_id: string | null } | null;
  requester?: { id: string; full_name: string | null; email: string | null } | null;
}

export const courseLifecycleService = {
  async requestDeletion(courseId: string, reason: string) {
    const { data, error } = await supabase.rpc("request_course_deletion", {
      _course_id: courseId,
      _reason: reason,
    });
    if (error) throw error;
    return data as string;
  },

  async listRequests(status: "all" | "pending" | "approved" | "rejected" | "archived" | "deleted" = "pending") {
    let q = (supabase as any)
      .from("course_deletion_requests")
      .select(
        "*, course:courses(id, title, status, instructor_id), requester:profiles!course_deletion_requests_requested_by_fkey(id, full_name, email)"
      )
      .order("created_at", { ascending: false });
    if (status !== "all") q = q.eq("status", status);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as CourseDeletionRequest[];
  },

  async review(requestId: string, approve: boolean, notes: string) {
    const { error } = await supabase.rpc("review_course_deletion", {
      _request_id: requestId,
      _approve: approve,
      _notes: notes,
    });
    if (error) throw error;
  },

  async archive(courseId: string, requestId?: string) {
    const { error } = await supabase.rpc("admin_archive_course", {
      _course_id: courseId,
      _request_id: requestId ?? null,
    });
    if (error) throw error;
  },

  async suspend(courseId: string, reason: string) {
    const { error } = await supabase.rpc("admin_suspend_course", {
      _course_id: courseId,
      _reason: reason,
    });
    if (error) throw error;
  },

  async restore(courseId: string) {
    const { error } = await supabase.rpc("admin_restore_course", { _course_id: courseId });
    if (error) throw error;
  },

  async permanentDelete(courseId: string, requestId?: string, remarks?: string) {
    let ip: string | null = null;
    try {
      const r = await fetch("https://api.ipify.org?format=json");
      if (r.ok) ip = (await r.json()).ip ?? null;
    } catch { /* best-effort */ }
    const { data, error } = await supabase.rpc("admin_permanent_delete_course", {
      _course_id: courseId,
      _request_id: requestId ?? null,
      _ip: ip,
      _user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      _remarks: remarks ?? null,
    });
    if (error) throw error;
    return data as {
      deleted: boolean;
      archived: boolean;
      message?: string;
      enrollments?: number;
      payments?: number;
      certificates?: number;
      invoices?: number;
    } | null;
  },

  async instructorDeleteDraft(courseId: string) {
    const { data, error } = await supabase.rpc("instructor_delete_draft_course" as any, {
      _course_id: courseId,
    });
    if (error) throw error;
    return data as { deleted: boolean; archived: boolean } | null;
  },

  async reassignInstructor(params: {
    courseId: string;
    newInstructorId: string;
    reason?: string;
    effectiveDate?: string | null;
    notify?: boolean;
    transferLiveClasses?: boolean;
  }) {
    const ctx = await getAuditContext();
    const { data, error } = await supabase.rpc("admin_reassign_course_instructor", {
      _course_id: params.courseId,
      _new_instructor_id: params.newInstructorId,
      _reason: params.reason ?? null,
      _effective_date: params.effectiveDate ?? null,
      _notify: params.notify ?? true,
      _transfer_live_classes: params.transferLiveClasses ?? false,
      _ip: ctx.ip,
      _user_agent: ctx.ua,
    });
    if (error) throw error;
    return data as any;
  },

  async bulkReassign(params: {
    courseIds: string[];
    newInstructorId: string;
    reason?: string;
    transferLiveClasses?: boolean;
    notify?: boolean;
  }) {
    const ctx = await getAuditContext();
    const { data, error } = await supabase.rpc("admin_bulk_reassign_courses", {
      _course_ids: params.courseIds,
      _new_instructor_id: params.newInstructorId,
      _reason: params.reason ?? null,
      _transfer_live_classes: params.transferLiveClasses ?? false,
      _notify: params.notify ?? true,
      _ip: ctx.ip,
      _user_agent: ctx.ua,
    });
    if (error) throw error;
    return data as { transferred: number; errors: any[] };
  },

  async deactivateInstructor(params: {
    instructorId: string;
    mode: "deactivate" | "transfer" | "archive";
    newInstructorId?: string;
    reason?: string;
    force?: boolean;
  }) {
    const ctx = await getAuditContext();
    const { data, error } = await supabase.rpc("admin_deactivate_instructor", {
      _instructor_id: params.instructorId,
      _mode: params.mode,
      _new_instructor_id: params.newInstructorId ?? null,
      _reason: params.reason ?? null,
      _ip: ctx.ip,
      _user_agent: ctx.ua,
      _force: params.force ?? false,
    });
    if (error) throw error;
    return data as any;
  },

  async reactivateInstructor(instructorId: string, reason?: string) {
    const ctx = await getAuditContext();
    const { data, error } = await supabase.rpc("admin_reactivate_instructor", {
      _instructor_id: instructorId,
      _ip: ctx.ip,
      _user_agent: ctx.ua,
      _reason: reason ?? null,
    });
    if (error) throw error;
    return data as any;
  },

  async deactivationSummary(instructorId: string) {
    const { data, error } = await supabase.rpc("instructor_deactivation_summary", {
      _instructor_id: instructorId,
    });
    if (error) throw error;
    return (data as any) ?? null;
  },

  async bulkTransferPreview(courseIds: string[]) {
    const { data, error } = await supabase.rpc("bulk_transfer_preview", {
      _course_ids: courseIds,
    });
    if (error) throw error;
    return (data as any) ?? { courses: 0, students: 0, revenue: 0 };
  },

  async listCoursesWithStats(instructorId: string) {
    const { data, error } = await supabase.rpc("list_courses_with_stats", {
      _instructor_id: instructorId,
    });
    if (error) throw error;
    return (data ?? []) as Array<{ id: string; title: string; category: string | null; status: string; students: number; revenue: number }>;
  },

  async listTransfers(from?: string, to?: string) {
    const { data, error } = await supabase.rpc("list_course_transfers", {
      _workspace_id: null,
      _from: from ?? null,
      _to: to ?? null,
    });
    if (error) throw error;
    return (data ?? []) as any[];
  },

  async listCoursesByInstructor(instructorId: string) {
    const { data, error } = await (supabase as any)
      .from("courses")
      .select("id, title, status, category, instructor_id")
      .eq("instructor_id", instructorId)
      .is("deleted_at", null)
      .order("title");
    if (error) throw error;
    return data ?? [];
  },

  async listActiveInstructors() {
    // Use a SECURITY DEFINER RPC so admins can see approved instructors across
    // every workspace (per-workspace RLS on workspace_members would otherwise
    // hide instructors whose personal workspace the admin doesn't belong to).
    const { data, error } = await (supabase as any).rpc("list_assignable_instructors");
    if (error) throw error;
    return (data ?? []) as { id: string; full_name: string | null; email: string | null }[];
  },

  async listAuditLog(courseId: string) {
    const { data, error } = await (supabase as any)
      .from("course_audit_log")
      .select("*, actor:profiles!course_audit_log_actor_id_fkey(full_name, email)")
      .eq("course_id", courseId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async getSummary(courseId: string) {
    const { data, error } = await supabase.rpc("course_deletion_summary", {
      _course_id: courseId,
    });
    if (error) throw error;
    return (data as any) ?? null;
  },
};
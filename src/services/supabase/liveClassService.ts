import { supabase } from "@/integrations/supabase/client";
import type { LiveClass, LiveClassStatus, Paginated } from "@/types";

export interface LiveClassFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: LiveClassStatus | "all";
  from?: string;
  to?: string;
  studentId?: string; // when set, restrict to courses the student is enrolled in
  courseId?: string;
}

export const liveClassService = {
  async list(workspaceId: string | null, f: LiveClassFilters = {}): Promise<Paginated<LiveClass>> {
    const page = f.page ?? 1;
    const pageSize = f.pageSize ?? 20;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let courseIds: string[] | null = null;
    if (f.studentId) {
      // Students can be enrolled in courses across workspaces. Don't scope
      // by their personal workspace — pull every enrolled course.
      const { data: enrolls } = await supabase
        .from("enrollments")
        .select("course_id")
        .eq("student_id", f.studentId);
      courseIds = (enrolls ?? []).map((e: any) => e.course_id);
      if (courseIds.length === 0) {
        return { rows: [], total: 0, page, pageSize };
      }
    }

    let q = supabase
      .from("live_classes")
      .select("*, courses(title), instructor:profiles!live_classes_instructor_id_fkey(full_name)", { count: "exact" })
      .order("starts_at", { ascending: false })
      .range(from, to);

    // Only scope by workspace when we aren't following a student's enrollments.
    if (workspaceId && !f.studentId) q = q.eq("workspace_id", workspaceId);
    if (f.status && f.status !== "all") q = q.eq("status", f.status);
    if (f.search) q = q.ilike("title", `%${f.search}%`);
    if (f.from) q = q.gte("starts_at", f.from);
    if (f.to) q = q.lte("starts_at", f.to);
    if (courseIds) q = q.in("course_id", courseIds);
    if (f.courseId) q = q.eq("course_id", f.courseId);

    const { data, count, error } = await q;
    if (error) throw error;
    return { rows: (data ?? []) as any, total: count ?? 0, page, pageSize };
  },

  async create(input: Partial<LiveClass> & { workspace_id: string; course_id: string; title: string; starts_at: string }) {
    const { data, error } = await supabase.from("live_classes").insert(input as any).select().single();
    if (error) throw error;
    return data;
  },

  async update(id: string, patch: Partial<LiveClass>) {
    const { data, error } = await supabase.from("live_classes").update(patch as any).eq("id", id).select().single();
    if (error) throw error;
    return data;
  },

  async cancel(id: string) {
    return this.update(id, { status: "cancelled" });
  },

  async remove(id: string) {
    const { error } = await supabase.from("live_classes").delete().eq("id", id);
    if (error) throw error;
  },

  async recordJoin(classId: string) {
    const { error } = await supabase.rpc("record_live_class_join", { _class_id: classId });
    if (error) throw error;
  },
};
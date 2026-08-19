import { supabase } from "@/integrations/supabase/client";

export interface ActivityItem {
  id: string;
  type: "course" | "enrollment" | "assignment" | "quiz" | "live_class" | "certificate";
  title: string;
  subtitle?: string;
  at: string;
}

export const activityService = {
  async recent(workspaceId: string, limit = 12): Promise<ActivityItem[]> {
    const [courses, enrolls, subs, attempts, live, certs] = await Promise.all([
      supabase.from("courses").select("id, title, created_at, status")
        .eq("workspace_id", workspaceId).is("deleted_at", null).order("created_at", { ascending: false }).range(0, 5),
      supabase.from("enrollments").select("id, enrolled_at, courses(title), profiles:student_id(full_name)")
        .eq("workspace_id", workspaceId).order("enrolled_at", { ascending: false }).range(0, 5),
      supabase.from("assignment_submissions").select("id, submitted_at, assignments(title)")
        .eq("workspace_id", workspaceId).order("submitted_at", { ascending: false }).range(0, 5),
      supabase.from("quiz_attempts").select("id, submitted_at, quizzes(title)")
        .eq("workspace_id", workspaceId).order("submitted_at", { ascending: false }).range(0, 5),
      supabase.from("live_classes").select("id, title, starts_at, status")
        .eq("workspace_id", workspaceId).order("starts_at", { ascending: false }).range(0, 5),
      supabase.from("certificates").select("id, issued_at, courses(title), profiles:student_id(full_name)")
        .eq("workspace_id", workspaceId).order("issued_at", { ascending: false }).range(0, 5),
    ]);
    const items: ActivityItem[] = [];
    (courses.data ?? []).forEach((c: any) => items.push({ id: `c-${c.id}`, type: "course", title: `Course “${c.title}” ${c.status === "published" ? "published" : "created"}`, at: c.created_at }));
    (enrolls.data ?? []).forEach((e: any) => items.push({ id: `e-${e.id}`, type: "enrollment", title: `${e.profiles?.full_name ?? "A learner"} enrolled in ${e.courses?.title ?? "a course"}`, at: e.enrolled_at }));
    (subs.data ?? []).forEach((s: any) => items.push({ id: `s-${s.id}`, type: "assignment", title: `Assignment submission: ${s.assignments?.title ?? ""}`, at: s.submitted_at }));
    (attempts.data ?? []).forEach((a: any) => items.push({ id: `q-${a.id}`, type: "quiz", title: `Quiz attempted: ${a.quizzes?.title ?? ""}`, at: a.submitted_at }));
    (live.data ?? []).forEach((l: any) => items.push({ id: `l-${l.id}`, type: "live_class", title: `Live class scheduled: ${l.title}`, at: l.starts_at }));
    (certs.data ?? []).forEach((c: any) => items.push({ id: `cert-${c.id}`, type: "certificate", title: `Certificate issued to ${c.profiles?.full_name ?? "student"} (${c.courses?.title ?? ""})`, at: c.issued_at }));
    return items.sort((a, b) => +new Date(b.at) - +new Date(a.at)).slice(0, limit);
  },
};
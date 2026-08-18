import { supabase } from "@/integrations/supabase/client";

export type AttStatus = "present" | "absent" | "late" | "excused";
export type SessionStatus = "draft" | "submitted" | "locked";
export type AttType =
  | "live_class" | "recorded_lesson" | "offline_classroom"
  | "workshop" | "practical" | "exam" | "seminar";

export const ATT_TYPE_LABELS: Record<AttType, string> = {
  live_class: "Live class",
  recorded_lesson: "Recorded lesson",
  offline_classroom: "Offline classroom",
  workshop: "Workshop",
  practical: "Practical",
  exam: "Exam",
  seminar: "Seminar",
};

export const STATUS_STYLE: Record<AttStatus, { label: string; tone: string; dot: string }> = {
  present: { label: "Present", tone: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  absent:  { label: "Absent",  tone: "bg-rose-50 text-rose-700 border-rose-200",           dot: "bg-rose-500" },
  late:    { label: "Late",    tone: "bg-amber-50 text-amber-700 border-amber-200",         dot: "bg-amber-500" },
  excused: { label: "Excused", tone: "bg-sky-50 text-sky-700 border-sky-200",               dot: "bg-sky-500" },
};

export async function listWorkspaceBatches(workspaceId: string) {
  const { data, error } = await supabase
    .from("batches")
    .select("id, name, code, status")
    .eq("workspace_id", workspaceId)
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export async function listBatchCourses(batchId: string) {
  const { data, error } = await supabase
    .from("batch_courses")
    .select("course_id, position, courses:course_id(id,title)")
    .eq("batch_id", batchId)
    .order("position");
  if (error) throw error;
  return (data ?? [])
    .map((r: any) => ({ id: r.courses?.id ?? r.course_id, title: r.courses?.title ?? "Untitled" }))
    .filter((c) => !!c.id);
}

export async function listBatchLessons(courseId: string) {
  const { data, error } = await supabase
    .from("lessons")
    .select("id,title,position")
    .eq("course_id", courseId)
    .order("position");
  if (error) throw error;
  return data ?? [];
}

export async function listBatchRoster(batchId: string) {
  const { data, error } = await supabase
    .from("batch_students")
    .select("student_id, roll_number, registration_number, profiles:student_id(id, full_name, email)")
    .eq("batch_id", batchId);
  if (error) throw error;
  return (data ?? [])
    .map((r: any) => ({
      student_id: r.student_id,
      roll_number: r.roll_number ?? r.registration_number ?? "—",
      name: r.profiles?.full_name ?? r.profiles?.email ?? "Student",
      email: r.profiles?.email ?? "",
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function loadOrCreateSettings(workspaceId: string) {
  const { data } = await supabase.from("attendance_settings")
    .select("*").eq("workspace_id", workspaceId).maybeSingle();
  if (data) return data;
  const { data: created, error } = await supabase.from("attendance_settings")
    .insert({ workspace_id: workspaceId }).select().single();
  if (error) throw error;
  return created;
}

export function isLockedClient(session: {
  status: SessionStatus; submitted_at: string | null;
}, lockHours: number) {
  if (session.status === "locked") return true;
  if (session.status !== "submitted" || !session.submitted_at) return false;
  const ms = new Date(session.submitted_at).getTime() + lockHours * 3600_000;
  return Date.now() > ms;
}

export function fmtDate(d?: string | null) {
  return d ? new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  }) : "—";
}

export function fmtDateTime(d?: string | null) {
  return d ? new Date(d).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  }) : "—";
}
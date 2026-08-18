import { supabase } from "@/integrations/supabase/client";

export type ValidityType =
  | "days_30"
  | "days_90"
  | "months_6"
  | "year_1"
  | "year_2"
  | "year_3"
  | "custom";

export const VALIDITY_OPTIONS: { value: ValidityType; label: string; days?: number }[] = [
  { value: "days_30", label: "30 Days", days: 30 },
  { value: "days_90", label: "90 Days", days: 90 },
  { value: "months_6", label: "6 Months", days: 182 },
  { value: "year_1", label: "1 Year", days: 365 },
  { value: "year_2", label: "2 Years", days: 730 },
  { value: "year_3", label: "3 Years", days: 1095 },
  { value: "custom", label: "Custom", days: undefined },
];

/** Compute end date (YYYY-MM-DD) from start + duration. Returns null for custom. */
export function computeBatchEndDate(startDate: string | null | undefined, duration: ValidityType): string | null {
  if (!startDate || duration === "custom") return null;
  const opt = VALIDITY_OPTIONS.find((o) => o.value === duration);
  if (!opt?.days) return null;
  const d = new Date(startDate);
  if (isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + opt.days - 1);
  return d.toISOString().slice(0, 10);
}

export interface Batch {
  id: string;
  workspace_id: string;
  name: string;
  code: string;
  description: string | null;
  coordinator_id: string | null;
  coordinator_name: string | null;
  coordinator_email: string | null;
  coordinator_phone: string | null;
  start_date: string | null;
  end_date: string | null;
  validity_type: ValidityType;
  duration_type: ValidityType | null;
  validity_custom_end: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface BatchInput {
  name: string;
  code?: string | null;
  description?: string | null;
  coordinator_id?: string | null;
  coordinator_name?: string | null;
  coordinator_email?: string | null;
  coordinator_phone?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  validity_type?: ValidityType;
  duration_type?: ValidityType;
  validity_custom_end?: string | null;
  status?: string;
}

export interface BatchStudentRow {
  id: string;
  batch_id: string;
  student_id: string;
  institution_id: string | null;
  roll_number: string | null;
  registration_number: string | null;
  department: string | null;
  semester: string | null;
  gender: string | null;
  admission_date: string | null;
  notes: string | null;
  added_at: string;
}

export const batchService = {
  async list(workspaceId: string): Promise<Batch[]> {
    const { data, error } = await supabase
      .from("batches" as any)
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data as any) ?? [];
  },
  async get(id: string): Promise<Batch> {
    const { data, error } = await supabase
      .from("batches" as any)
      .select("*")
      .eq("id", id)
      .single();
    if (error) throw error;
    return data as any;
  },
  async create(workspaceId: string, input: BatchInput): Promise<Batch> {
    const { data, error } = await supabase
      .from("batches" as any)
      .insert({ ...input, workspace_id: workspaceId } as any)
      .select("*")
      .single();
    if (error) throw error;
    return data as any;
  },
  async update(id: string, input: BatchInput): Promise<Batch> {
    const { data, error } = await supabase
      .from("batches" as any)
      .update(input as any)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return data as any;
  },
  async remove(id: string) {
    const { error } = await supabase.from("batches" as any).delete().eq("id", id);
    if (error) throw error;
  },

  async listCourses(batchId: string) {
    const { data, error } = await supabase
      .from("batch_courses" as any)
      .select("id, course_id, position, courses:course_id(id,title,slug,thumbnail_url)")
      .eq("batch_id", batchId)
      .order("position");
    if (error) throw error;
    return (data as any) ?? [];
  },
  async addCourse(batchId: string, courseId: string) {
    const { error } = await supabase
      .from("batch_courses" as any)
      .insert({ batch_id: batchId, course_id: courseId } as any);
    if (error && !/duplicate|unique/i.test(error.message)) throw error;
  },
  async removeCourse(batchId: string, courseId: string) {
    const { error } = await supabase
      .from("batch_courses" as any)
      .delete()
      .eq("batch_id", batchId)
      .eq("course_id", courseId);
    if (error) throw error;
  },

  async listStudents(batchId: string) {
    const { data, error } = await supabase
      .from("batch_students" as any)
      .select("*, profiles:student_id(id,full_name,email,phone,avatar_url), institutions:institution_id(id,name,code)")
      .eq("batch_id", batchId)
      .order("added_at", { ascending: false });
    if (error) throw error;
    return (data as any) ?? [];
  },
  async addStudent(batchId: string, studentId: string, extras: Partial<BatchStudentRow> = {}) {
    const { error } = await supabase
      .from("batch_students" as any)
      .insert({ batch_id: batchId, student_id: studentId, ...extras } as any);
    if (error) throw error;
  },
  async addStudents(rows: Array<Partial<BatchStudentRow> & { batch_id: string; student_id: string }>) {
    if (!rows.length) return;
    const { error } = await supabase.from("batch_students" as any).insert(rows as any);
    if (error) throw error;
  },
  async removeStudent(batchId: string, studentId: string) {
    const { error } = await supabase
      .from("batch_students" as any)
      .delete()
      .eq("batch_id", batchId)
      .eq("student_id", studentId);
    if (error) throw error;
  },
};
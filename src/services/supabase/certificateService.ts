import { supabase } from "@/integrations/supabase/client";
import type { Certificate, CertificateTemplate, Paginated } from "@/types";

function randomCode(len = 12) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export const certificateService = {
  async listTemplates(workspaceId: string): Promise<CertificateTemplate[]> {
    const { data, error } = await supabase
      .from("certificate_templates")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as CertificateTemplate[];
  },

  async createTemplate(input: Partial<CertificateTemplate> & { workspace_id: string; name: string }) {
    const { data, error } = await supabase.from("certificate_templates").insert(input as any).select().single();
    if (error) throw error;
    return data;
  },

  async updateTemplate(id: string, patch: Partial<CertificateTemplate>) {
    const { error } = await supabase.from("certificate_templates").update(patch as any).eq("id", id);
    if (error) throw error;
  },

  async deleteTemplate(id: string) {
    const { error } = await supabase.from("certificate_templates").delete().eq("id", id);
    if (error) throw error;
  },

  async duplicateTemplate(id: string) {
    const { data: src, error: e1 } = await supabase
      .from("certificate_templates").select("*").eq("id", id).single();
    if (e1) throw e1;
    const { id: _id, created_at, updated_at, is_default, name, ...rest } = src as any;
    const { data, error } = await supabase
      .from("certificate_templates")
      .insert({ ...rest, name: `${name} (copy)`, is_default: false })
      .select().single();
    if (error) throw error;
    return data;
  },

  async setDefaultTemplate(workspaceId: string, id: string) {
    const { error: e1 } = await supabase
      .from("certificate_templates").update({ is_default: false }).eq("workspace_id", workspaceId);
    if (e1) throw e1;
    const { error: e2 } = await supabase
      .from("certificate_templates").update({ is_default: true }).eq("id", id);
    if (e2) throw e2;
  },

  async uploadTemplateAsset(workspaceId: string, file: File, kind: "background" | "logo" | "signature") {
    const ext = file.name.split(".").pop() || "png";
    const path = `${workspaceId}/${kind}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from("certificate-assets").upload(path, file, { upsert: false });
    if (error) throw error;
    const { data } = supabase.storage.from("certificate-assets").getPublicUrl(path);
    return data.publicUrl;
  },

  async calculateCompletionPercentage(studentId: string, courseId: string): Promise<number | null> {
    const { count: total } = await supabase
      .from("lessons").select("id", { count: "exact", head: true }).eq("course_id", courseId);
    if (!total || total === 0) return null;
    const { count: done } = await supabase
      .from("lesson_progress").select("id", { count: "exact", head: true })
      .eq("student_id", studentId).eq("is_completed", true)
      .in("lesson_id", (await supabase.from("lessons").select("id").eq("course_id", courseId)).data?.map((l: any) => l.id) ?? []);
    return Math.round(((done ?? 0) / total) * 100);
  },

  async getCompletionStatus(studentId: string, courseId: string): Promise<{
    total_lessons: number; completed_lessons: number;
    total_quizzes: number; passed_quizzes: number;
    total_assignments: number; passed_assignments: number;
    completion_percentage: number; is_complete: boolean;
  } | null> {
    const { data, error } = await (supabase.rpc as any)("course_completion_status", {
      _student: studentId, _course: courseId,
    });
    if (error) return null;
    return (data as any) ?? null;
  },

  async revokeCertificate(id: string) {
    const { error } = await supabase.from("certificates").update({ revoked_at: new Date().toISOString() } as any).eq("id", id);
    if (error) throw error;
  },

  async listIssued(
    workspaceId: string | null,
    opts: { page?: number; pageSize?: number; studentId?: string } = {}
  ): Promise<Paginated<Certificate & { courses?: any; profiles?: any }>> {
    const page = opts.page ?? 1;
    const pageSize = opts.pageSize ?? 20;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    let q = supabase
      .from("certificates")
      .select("*, courses(title), profiles(full_name)", { count: "exact" })
      .order("issued_at", { ascending: false })
      .range(from, to);
    if (workspaceId) q = q.eq("workspace_id", workspaceId);
    if (opts.studentId) q = q.eq("student_id", opts.studentId);
    const { data, count, error } = await q;
    if (error) throw error;
    return { rows: (data ?? []) as any, total: count ?? 0, page, pageSize };
  },

  async issue(input: {
    workspace_id: string;
    course_id: string;
    student_id: string;
    template_id?: string | null;
    completion_percentage?: number | null;
    completion_date?: string | null;
    certificate_number?: string;
  }) {
    const certificate_number = input.certificate_number || `CERT-${new Date().getFullYear()}-${randomCode(6)}`;
    const verification_code = randomCode(14);
    const { certificate_number: _cn, ...rest } = input;
    // Resolve template server-side when caller didn't pin one:
    // course-assigned -> workspace default -> oldest workspace template.
    let resolvedTemplateId: string | null = rest.template_id ?? null;
    if (!resolvedTemplateId) {
      const { data: tpl } = await (supabase.rpc as any)("resolve_certificate_template", {
        _workspace_id: rest.workspace_id,
        _course_id: rest.course_id,
      });
      resolvedTemplateId = (tpl as any) ?? null;
    }
    const { data, error } = await supabase
      .from("certificates")
      .insert({ ...rest, template_id: resolvedTemplateId, certificate_number, verification_code } as any)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async verify(code: string) {
    const { data, error } = await supabase.rpc("verify_certificate", { _code: code });
    if (error) throw error;
    return (data?.[0] ?? null) as
      | {
          certificate_number: string;
          issued_at: string;
          student_name: string;
          course_title: string;
          workspace_name: string;
          completion_percentage: number | null;
          completion_date: string | null;
          verification_code: string;
          accent_color: string;
          revoked_at: string | null;
        }
      | null;
  },
};
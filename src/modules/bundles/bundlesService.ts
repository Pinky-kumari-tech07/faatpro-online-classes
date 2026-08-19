import { supabase } from "@/integrations/supabase/client";

export type BundleStatus = "draft" | "published" | "private";
export type AccessType = "lifetime" | "days" | "months" | "years";
export type CertificateMode = "individual" | "bundle" | "both";

export interface CourseBundle {
  id: string;
  workspace_id: string;
  name: string;
  slug: string;
  short_description: string | null;
  description: string | null;
  thumbnail_url: string | null;
  banner_url: string | null;
  category: string | null;
  tags: string[];
  instructor_id: string | null;
  regular_price: number;
  sale_price: number | null;
  currency: string;
  access_type: AccessType;
  access_duration: number | null;
  status: BundleStatus;
  certificate_mode: CertificateMode;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
}

export interface BundleCourse {
  id: string;
  bundle_id: string;
  course_id: string;
  is_mandatory: boolean;
  position: number;
}

export const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);

export async function listBundles(workspaceId: string) {
  const { data, error } = await supabase
    .from("course_bundles")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as CourseBundle[];
}

export async function getBundle(id: string) {
  const { data, error } = await supabase
    .from("course_bundles")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as CourseBundle | null;
}

export async function getBundleCourses(bundleId: string) {
  const { data, error } = await supabase
    .from("bundle_courses")
    .select("id, bundle_id, course_id, is_mandatory, position, courses:course_id(id, title, thumbnail_url, price_amount, currency, status)")
    .eq("bundle_id", bundleId)
    .order("position", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createBundle(input: Partial<CourseBundle> & { workspace_id: string; name: string; slug: string }) {
  const { data, error } = await supabase
    .from("course_bundles")
    .insert(input as any)
    .select("*")
    .single();
  if (error) throw error;
  return data as CourseBundle;
}

export async function updateBundle(id: string, patch: Partial<CourseBundle>) {
  const { data, error } = await supabase
    .from("course_bundles")
    .update(patch as any)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as CourseBundle;
}

export async function deleteBundle(id: string) {
  const { error } = await supabase.from("course_bundles").delete().eq("id", id);
  if (error) throw error;
}

export async function setBundleCourses(
  bundleId: string,
  workspaceId: string,
  courseIds: string[],
) {
  // Replace strategy
  const { error: delErr } = await supabase.from("bundle_courses").delete().eq("bundle_id", bundleId);
  if (delErr) throw delErr;
  if (!courseIds.length) return;
  const rows = courseIds.map((cid, i) => ({
    bundle_id: bundleId,
    course_id: cid,
    workspace_id: workspaceId,
    position: i,
    is_mandatory: true,
  }));
  const { error } = await supabase.from("bundle_courses").insert(rows);
  if (error) throw error;
}

export async function listWorkspaceCourses(workspaceId: string) {
  const { data, error } = await supabase
    .from("courses")
    .select("id, title, thumbnail_url, price_amount, currency, status, instructor_id, category")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .order("title", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function listMyBundles(studentId: string) {
  const { data, error } = await supabase
    .from("student_bundles")
    .select("id, status, assigned_at, access_expires_at, source, bundle:bundle_id(id, name, slug, thumbnail_url, short_description, certificate_mode)")
    .eq("student_id", studentId)
    .order("assigned_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function bundleStudents(bundleId: string) {
  const { data, error } = await supabase
    .from("student_bundles")
    .select("id, student_id, source, assigned_at, access_expires_at, status, profiles:student_id(id, full_name, email, avatar_url)")
    .eq("bundle_id", bundleId)
    .order("assigned_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function enrollStudentInBundle(
  studentId: string,
  bundleId: string,
  source: "manual" | "bulk" | "purchase" | "institution" = "manual",
) {
  const { data, error } = await supabase.rpc("enroll_student_in_bundle", {
    _student_id: studentId,
    _bundle_id: bundleId,
    _source: source,
    _payment_id: null,
    _institution_id: null,
  });
  if (error) throw error;
  return data as number;
}

export async function bulkEnrollStudentsInBundle(studentIds: string[], bundleId: string) {
  let total = 0;
  for (const sid of studentIds) {
    try {
      total += await enrollStudentInBundle(sid, bundleId, "bulk");
    } catch (e) {
      console.error("bulk enroll error", sid, e);
    }
  }
  return total;
}

export async function assignBundleToInstitution(
  bundleId: string,
  institutionId: string,
  program?: string | null,
  semester?: string | null,
) {
  const { data, error } = await supabase.rpc("assign_bundle_to_institution", {
    _bundle_id: bundleId,
    _institution_id: institutionId,
    _program: program ?? null,
    _semester: semester ?? null,
  });
  if (error) throw error;
  return data as number;
}

export async function bundleProgressForStudent(studentId: string, bundleId: string) {
  // average of enrollment progress for courses in bundle
  const { data: bcs } = await supabase
    .from("bundle_courses")
    .select("course_id")
    .eq("bundle_id", bundleId);
  const courseIds = (bcs ?? []).map((b) => b.course_id);
  if (!courseIds.length) return { progress: 0, completed: 0, total: 0 };
  const { data: enrolls } = await supabase
    .from("enrollments")
    .select("course_id, status, completed_at")
    .eq("student_id", studentId)
    .in("course_id", courseIds);
  const completed = (enrolls ?? []).filter((e) => e.status === "completed").length;
  return {
    progress: courseIds.length ? Math.round((completed / courseIds.length) * 100) : 0,
    completed,
    total: courseIds.length,
  };
}

export async function bundleAnalytics(bundleId: string) {
  const [{ data: students }, { data: payments }] = await Promise.all([
    supabase.from("student_bundles").select("id, student_id").eq("bundle_id", bundleId),
    supabase.from("payments").select("total_amount, amount, currency, status").eq("bundle_id", bundleId).eq("status", "succeeded" as any),
  ]);
  const enrolled = students?.length ?? 0;
  const revenue = (payments ?? []).reduce((s, p: any) => s + Number(p.total_amount ?? p.amount ?? 0), 0);
  return { enrolled, revenue, currency: payments?.[0]?.currency ?? "INR" };
}

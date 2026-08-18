import { supabase } from "@/integrations/supabase/client";

export interface InstitutionRow {
  id: string;
  name: string;
  code: string | null;
  is_active: boolean;
}

export async function fetchInstitutions(workspaceId: string): Promise<InstitutionRow[]> {
  const { data, error } = await supabase
    .from("institutions")
    .select("id, name, code, is_active")
    .eq("workspace_id", workspaceId)
    .order("name");
  if (error) throw error;
  return (data ?? []) as InstitutionRow[];
}

export interface InstitutionFilters {
  workspaceId: string;
  institutionId?: string;
  courseId?: string;
  instructorId?: string;
  category?: string;
  academicYear?: string;
  from?: Date;
  to?: Date;
}

/**
 * Fetches all the raw rows needed for institution analytics in parallel,
 * then groups them in-memory. Optimised for moderate workspaces (<100k rows).
 */
export async function fetchInstitutionAnalytics(f: InstitutionFilters) {
  const fromIso = f.from?.toISOString();
  const toIso = f.to?.toISOString();

  // 1. Institutions in scope
  let instQ = supabase.from("institutions").select("*").eq("workspace_id", f.workspaceId);
  if (f.institutionId) instQ = instQ.eq("id", f.institutionId);
  const institutions = (await instQ).data ?? [];
  const instIds = institutions.map((i: any) => i.id);

  if (instIds.length === 0) {
    return {
      institutions: [], mapping: [], enrollments: [], profiles: new Map(),
      lessons: [], lessonProgress: [], certificates: [], payments: [],
      attempts: [], submissions: [], courses: [], assignments: [],
    } as any;
  }

  // 2. institution_students mapping (all students in those institutions)
  let mapQ = supabase.from("institution_students").select("*").in("institution_id", instIds);
  if (f.academicYear) mapQ = mapQ.eq("academic_year", f.academicYear);
  const mapping = (await mapQ).data ?? [];
  const studentIds = Array.from(new Set(mapping.map((m: any) => m.student_id)));

  // 3. Enrollments (filter by institution_id; respect date range / course / instructor)
  let enrQ = supabase
    .from("enrollments")
    .select("id, student_id, course_id, status, enrolled_at, completed_at, institution_id")
    .in("institution_id", instIds);
  if (fromIso) enrQ = enrQ.gte("enrolled_at", fromIso);
  if (toIso) enrQ = enrQ.lte("enrolled_at", toIso);
  if (f.courseId) enrQ = enrQ.eq("course_id", f.courseId);
  const enrollments = (await enrQ).data ?? [];
  const courseIdsFromEnr = Array.from(new Set(enrollments.map((e: any) => e.course_id)));

  // 4. Courses (with instructor + category for filtering display)
  let courseQ = supabase
    .from("courses")
    .select("id, title, instructor_id, category")
    .eq("workspace_id", f.workspaceId);
  if (f.instructorId) courseQ = courseQ.eq("instructor_id", f.instructorId);
  if (f.category) courseQ = courseQ.eq("category", f.category);
  const courses = (await courseQ).data ?? [];
  const allowedCourseIds = new Set(courses.map((c: any) => c.id));

  // Apply course/instructor/category filters by intersecting with allowed courses
  const filteredEnr = enrollments.filter((e: any) =>
    courseIdsFromEnr.includes(e.course_id) && allowedCourseIds.has(e.course_id));

  const courseIds = Array.from(new Set(filteredEnr.map((e: any) => e.course_id)));

  // 5. Profiles
  const { data: profs } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone, last_login_at, is_active")
    .in("id", studentIds.length ? studentIds : ["00000000-0000-0000-0000-000000000000"]);
  const profiles = new Map<string, any>((profs ?? []).map((p: any) => [p.id, p]));

  // 6. Lessons + progress for completion %
  const { data: lessons } = await supabase
    .from("lessons").select("id, course_id")
    .in("course_id", courseIds.length ? courseIds : ["00000000-0000-0000-0000-000000000000"]);
  const { data: lessonProgress } = await supabase
    .from("lesson_progress").select("student_id, lesson_id, is_completed")
    .in("student_id", studentIds.length ? studentIds : ["00000000-0000-0000-0000-000000000000"])
    .eq("is_completed", true);

  // 7. Certificates
  let certQ = supabase
    .from("certificates")
    .select("id, student_id, course_id, certificate_number, issued_at, completion_date, revoked_at")
    .eq("workspace_id", f.workspaceId)
    .in("student_id", studentIds.length ? studentIds : ["00000000-0000-0000-0000-000000000000"]);
  if (fromIso) certQ = certQ.gte("issued_at", fromIso);
  if (toIso) certQ = certQ.lte("issued_at", toIso);
  const certificates = (await certQ).data ?? [];

  // 8. Payments (revenue)
  let payQ = supabase
    .from("payments")
    .select("id, student_id, course_id, status, amount, total_amount, currency, created_at")
    .eq("workspace_id", f.workspaceId)
    .in("student_id", studentIds.length ? studentIds : ["00000000-0000-0000-0000-000000000000"]);
  if (fromIso) payQ = payQ.gte("created_at", fromIso);
  if (toIso) payQ = payQ.lte("created_at", toIso);
  const payments = (await payQ).data ?? [];

  // 9. Quiz attempts + assignment submissions (averages)
  const { data: attempts } = await supabase
    .from("quiz_attempts").select("student_id, quiz_id, percentage, passed")
    .in("student_id", studentIds.length ? studentIds : ["00000000-0000-0000-0000-000000000000"]);
  const { data: submissions } = await supabase
    .from("assignment_submissions")
    .select("student_id, assignment_id, grade, assignments:assignment_id(course_id, max_points)")
    .in("student_id", studentIds.length ? studentIds : ["00000000-0000-0000-0000-000000000000"]);
  const { data: assignments } = await supabase
    .from("assignments").select("id, course_id, max_points")
    .in("course_id", courseIds.length ? courseIds : ["00000000-0000-0000-0000-000000000000"]);

  return {
    institutions, mapping, enrollments: filteredEnr, profiles,
    lessons: lessons ?? [], lessonProgress: lessonProgress ?? [],
    certificates, payments,
    attempts: attempts ?? [], submissions: submissions ?? [],
    courses, assignments: assignments ?? [],
  };
}

/** Aggregates the raw rows from fetchInstitutionAnalytics into per-institution KPIs. */
export function aggregateByInstitution(raw: any) {
  const lessonsByCourse = new Map<string, string[]>();
  for (const l of raw.lessons) {
    const arr = lessonsByCourse.get(l.course_id) ?? [];
    arr.push(l.id); lessonsByCourse.set(l.course_id, arr);
  }
  const completedSet = new Set<string>();
  for (const p of raw.lessonProgress) completedSet.add(`${p.student_id}:${p.lesson_id}`);

  // Map student → institution
  const studentInst = new Map<string, string>();
  for (const m of raw.mapping) studentInst.set(m.student_id, m.institution_id);

  return raw.institutions.map((inst: any) => {
    const mapping = raw.mapping.filter((m: any) => m.institution_id === inst.id);
    const studentIds = mapping.map((m: any) => m.student_id);
    const studentSet = new Set(studentIds);

    const profs = studentIds.map((id: string) => raw.profiles.get(id)).filter(Boolean);
    const active = profs.filter((p: any) => p.is_active !== false).length;
    const inactive = profs.length - active;

    const enrollments = raw.enrollments.filter((e: any) => studentSet.has(e.student_id));
    const completedEnrollments = enrollments.filter((e: any) => e.status === "completed").length;
    const uniqueCourses = new Set(enrollments.map((e: any) => e.course_id)).size;

    // Progress %
    let totalProgress = 0; let progressCount = 0;
    for (const e of enrollments) {
      const total = (lessonsByCourse.get(e.course_id) ?? []).length;
      if (total === 0) continue;
      const done = (lessonsByCourse.get(e.course_id) ?? [])
        .filter((lid: string) => completedSet.has(`${e.student_id}:${lid}`)).length;
      totalProgress += (done / total) * 100;
      progressCount += 1;
    }
    const avgProgress = progressCount === 0 ? 0 : Math.round(totalProgress / progressCount);
    const completionRate = enrollments.length === 0 ? 0
      : Math.round((completedEnrollments / enrollments.length) * 100);

    const certs = raw.certificates.filter((c: any) => studentSet.has(c.student_id) && !c.revoked_at);
    const payments = raw.payments.filter((p: any) =>
      studentSet.has(p.student_id) && p.status === "succeeded");
    const revenue = payments.reduce((s: number, p: any) =>
      s + Number(p.total_amount ?? p.amount ?? 0), 0);

    const attempts = raw.attempts.filter((a: any) => studentSet.has(a.student_id));
    const avgQuiz = attempts.length === 0 ? 0
      : Math.round(attempts.reduce((s: number, a: any) => s + Number(a.percentage ?? 0), 0) / attempts.length);

    const submissions = raw.submissions.filter((s: any) => studentSet.has(s.student_id));

    return {
      ...inst,
      total_students: profs.length,
      active_students: active,
      inactive_students: inactive,
      total_enrollments: enrollments.length,
      unique_courses: uniqueCourses,
      revenue,
      currency: payments[0]?.currency ?? "INR",
      completion_rate: completionRate,
      certificates: certs.length,
      assignments_submitted: submissions.length,
      quiz_attempts: attempts.length,
      avg_progress: avgProgress,
      avg_quiz: avgQuiz,
    };
  });
}
import { supabase } from "@/integrations/supabase/client";

export interface BatchSummary {
  id: string;
  name: string;
  code: string;
  description: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  validity_type: string;
  coordinator_id: string | null;
  coordinator_name: string | null;
  coordinator_email: string | null;
  coordinator_phone: string | null;
  institutions_count: number;
  total_students: number;
  active_students: number;
  completed_students: number;
  in_progress_students: number;
  not_started_students: number;
  expired_enrollments: number;
  average_completion: number;
  certificates_issued: number;
  certificates_pending: number;
  courses_count: number;
}

export interface BatchPortfolio {
  totals: {
    totalBatches: number;
    activeBatches: number;
    completedBatches: number;
    upcomingBatches: number;
    totalStudents: number;
    activeStudents: number;
    completedStudents: number;
    expiredEnrollments: number;
    averageCompletion: number;
    certificatesIssued: number;
    certificatesPending: number;
  };
  rows: BatchSummary[];
}

function classify(b: any): "active" | "completed" | "upcoming" {
  const now = new Date();
  const start = b.start_date ? new Date(b.start_date) : null;
  const end = b.end_date ? new Date(b.end_date) : null;
  if (start && start > now) return "upcoming";
  if (end && end < now) return "completed";
  if (b.status === "archived") return "completed";
  return "active";
}

export async function fetchBatchPortfolio(workspaceId: string): Promise<BatchPortfolio> {
  const { data: batches, error } = await supabase
    .from("batches" as any)
    .select("id,name,code,description,status,start_date,end_date,validity_type,duration_type,coordinator_id,coordinator_name,coordinator_email,coordinator_phone")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const list = (batches ?? []) as any[];

  // Legacy: also load any coordinators stored as profile references.
  const coordIds = Array.from(new Set(list.map((b) => b.coordinator_id).filter(Boolean)));
  const coordMap = new Map<string, any>();
  if (coordIds.length) {
    const { data: profs } = await supabase.from("profiles").select("id,full_name,email,phone").in("id", coordIds);
    (profs ?? []).forEach((p: any) => coordMap.set(p.id, p));
  }

  const rows: BatchSummary[] = await Promise.all(
    list.map(async (b) => {
      const [bs, bc, enrolls, certs] = await Promise.all([
        supabase.from("batch_students" as any).select("student_id,institution_id").eq("batch_id", b.id),
        supabase.from("batch_courses" as any).select("course_id").eq("batch_id", b.id),
        supabase.from("enrollments").select("id,student_id,course_id,status,access_expires_at,completed_at").eq("batch_id", b.id),
        supabase.from("certificates").select("id,student_id,course_id").in(
          "course_id",
          ((await supabase.from("batch_courses" as any).select("course_id").eq("batch_id", b.id)).data ?? []).map((x: any) => x.course_id),
        ),
      ]);

      const students = (bs.data ?? []) as any[];
      const courses = (bc.data ?? []) as any[];
      const enr = (enrolls.data ?? []) as any[];
      const cert = (certs.data ?? []) as any[];
      const studentIds = new Set(students.map((s) => s.student_id));
      const certByStudent = new Set(cert.filter((c) => studentIds.has(c.student_id)).map((c) => `${c.student_id}-${c.course_id}`));

      const totalCourses = courses.length || 1;
      const now = Date.now();
      let completedStudents = 0;
      let inProgress = 0;
      let notStarted = 0;
      let expired = 0;
      let active = 0;
      let completionSum = 0;

      // progress per student: completed enrollments / batch courses
      const byStudent = new Map<string, any[]>();
      enr.forEach((e) => {
        if (!studentIds.has(e.student_id)) return;
        if (!byStudent.has(e.student_id)) byStudent.set(e.student_id, []);
        byStudent.get(e.student_id)!.push(e);
      });

      students.forEach((s) => {
        const ee = byStudent.get(s.student_id) ?? [];
        const isExpired = ee.length > 0 && ee.every((e) => e.access_expires_at && new Date(e.access_expires_at).getTime() < now);
        const completedCount = ee.filter((e) => e.status === "completed" || e.completed_at).length;
        if (isExpired) expired += ee.length;
        const pct = totalCourses ? (completedCount / totalCourses) * 100 : 0;
        completionSum += pct;
        if (completedCount >= totalCourses && totalCourses > 0) completedStudents += 1;
        else if (completedCount > 0) inProgress += 1;
        else if (ee.length === 0) notStarted += 1;
        else notStarted += 1;
        if (!isExpired) active += 1;
      });

      const certsIssued = cert.filter((c) => studentIds.has(c.student_id)).length;
      const expectedCerts = students.length * totalCourses;

      const instCount = new Set(students.map((s) => s.institution_id).filter(Boolean)).size;

      return {
        id: b.id,
        name: b.name,
        code: b.code,
        description: b.description,
        status: b.status,
        start_date: b.start_date,
        end_date: b.end_date,
        validity_type: b.duration_type ?? b.validity_type,
        coordinator_id: b.coordinator_id,
        coordinator_name: b.coordinator_name ?? (b.coordinator_id ? (coordMap.get(b.coordinator_id) as any)?.full_name ?? null : null),
        coordinator_email: b.coordinator_email ?? (b.coordinator_id ? (coordMap.get(b.coordinator_id) as any)?.email ?? null : null),
        coordinator_phone: b.coordinator_phone ?? (b.coordinator_id ? (coordMap.get(b.coordinator_id) as any)?.phone ?? null : null),
        institutions_count: instCount,
        total_students: students.length,
        active_students: active,
        completed_students: completedStudents,
        in_progress_students: inProgress,
        not_started_students: notStarted,
        expired_enrollments: expired,
        average_completion: students.length ? Math.round((completionSum / students.length) * 10) / 10 : 0,
        certificates_issued: certsIssued,
        certificates_pending: Math.max(0, expectedCerts - certsIssued),
        courses_count: courses.length,
      };
    }),
  );

  const totalStudents = rows.reduce((s, r) => s + r.total_students, 0);
  const totals = {
    totalBatches: rows.length,
    activeBatches: list.filter((b) => classify(b) === "active").length,
    completedBatches: list.filter((b) => classify(b) === "completed").length,
    upcomingBatches: list.filter((b) => classify(b) === "upcoming").length,
    totalStudents,
    activeStudents: rows.reduce((s, r) => s + r.active_students, 0),
    completedStudents: rows.reduce((s, r) => s + r.completed_students, 0),
    expiredEnrollments: rows.reduce((s, r) => s + r.expired_enrollments, 0),
    averageCompletion: rows.length
      ? Math.round((rows.reduce((s, r) => s + r.average_completion, 0) / rows.length) * 10) / 10
      : 0,
    certificatesIssued: rows.reduce((s, r) => s + r.certificates_issued, 0),
    certificatesPending: rows.reduce((s, r) => s + r.certificates_pending, 0),
  };

  return { totals, rows };
}

export interface BatchDetailReport {
  batch: any;
  coordinatorName: string | null;
  coordinatorEmail: string | null;
  coordinatorPhone: string | null;
  courses: any[];
  students: Array<{
    student_id: string;
    name: string;
    email: string;
    phone: string | null;
    institution: string | null;
    department: string | null;
    roll_number: string | null;
    registration_number: string | null;
    enrolled_courses: number;
    completed_courses: number;
    progress_pct: number;
    enrollment_date: string | null;
    expires_at: string | null;
    last_login: string | null;
    certificate_status: string;
    status: string;
  }>;
  courseAnalytics: Array<{
    course_id: string;
    title: string;
    enrolled: number;
    started: number;
    in_progress: number;
    completed: number;
    avg_completion: number;
    certs: number;
    dropout_rate: number;
  }>;
}

export async function fetchBatchDetailReport(batchId: string): Promise<BatchDetailReport> {
  const { data: batch, error } = await supabase
    .from("batches" as any).select("*").eq("id", batchId).single();
  if (error) throw error;

  const [bs, bc] = await Promise.all([
    supabase.from("batch_students" as any)
      .select("*, profiles:student_id(id,full_name,email,phone,last_login_at), institutions:institution_id(id,name)")
      .eq("batch_id", batchId),
    supabase.from("batch_courses" as any).select("course_id, courses:course_id(id,title,slug)").eq("batch_id", batchId),
  ]);

  const students = (bs.data ?? []) as any[];
  const courses = ((bc.data ?? []) as any[]).map((x) => x.courses).filter(Boolean);
  const courseIds = courses.map((c) => c.id);

  let coordinatorName: string | null = (batch as any).coordinator_name ?? null;
  let coordinatorEmail: string | null = (batch as any).coordinator_email ?? null;
  let coordinatorPhone: string | null = (batch as any).coordinator_phone ?? null;
  if (!coordinatorName && (batch as any).coordinator_id) {
    const { data } = await supabase.from("profiles").select("full_name,email,phone").eq("id", (batch as any).coordinator_id).maybeSingle();
    coordinatorName = data?.full_name ?? null;
    coordinatorEmail = (data as any)?.email ?? null;
    coordinatorPhone = (data as any)?.phone ?? null;
  }

  const studentIds = students.map((s) => s.student_id);

  const [{ data: enrolls }, { data: certs }] = await Promise.all([
    studentIds.length && courseIds.length
      ? supabase.from("enrollments").select("id,student_id,course_id,status,enrolled_at,access_expires_at,completed_at")
          .in("student_id", studentIds).in("course_id", courseIds)
      : Promise.resolve({ data: [] as any[] } as any),
    studentIds.length && courseIds.length
      ? supabase.from("certificates").select("id,student_id,course_id")
          .in("student_id", studentIds).in("course_id", courseIds)
      : Promise.resolve({ data: [] as any[] } as any),
  ]);

  const enrollList = (enrolls ?? []) as any[];
  const certList = (certs ?? []) as any[];
  const certSet = new Set(certList.map((c) => `${c.student_id}-${c.course_id}`));

  const totalCourses = courses.length || 1;

  const studentRows = students.map((s) => {
    const p = s.profiles ?? {};
    const inst = s.institutions ?? null;
    const ee = enrollList.filter((e) => e.student_id === s.student_id);
    const completed = ee.filter((e) => e.status === "completed" || e.completed_at).length;
    const pct = courses.length ? Math.round((completed / courses.length) * 100) : 0;
    const expired = ee.length > 0 && ee.every((e) => e.access_expires_at && new Date(e.access_expires_at).getTime() < Date.now());
    const studentCerts = certList.filter((c) => c.student_id === s.student_id).length;
    return {
      student_id: s.student_id,
      name: p.full_name ?? "—",
      email: p.email ?? "—",
      phone: p.phone ?? null,
      institution: inst?.name ?? null,
      department: s.department ?? null,
      roll_number: s.roll_number ?? null,
      registration_number: s.registration_number ?? null,
      enrolled_courses: ee.length,
      completed_courses: completed,
      progress_pct: pct,
      enrollment_date: ee[0]?.enrolled_at ?? s.added_at ?? null,
      expires_at: ee[0]?.access_expires_at ?? null,
      last_login: p.last_login_at ?? null,
      certificate_status:
        studentCerts === 0 ? "Pending" : studentCerts >= courses.length ? "Issued" : `${studentCerts}/${totalCourses}`,
      status: expired ? "Expired" : completed >= courses.length && courses.length > 0 ? "Completed" : completed > 0 ? "In Progress" : "Not Started",
    };
  });

  const courseAnalytics = courses.map((c) => {
    const ee = enrollList.filter((e) => e.course_id === c.id);
    const enrolled = ee.length;
    const completed = ee.filter((e) => e.status === "completed" || e.completed_at).length;
    const started = ee.length;
    const inProgress = enrolled - completed;
    const certCount = certList.filter((cc) => cc.course_id === c.id).length;
    const avg = enrolled ? Math.round((completed / enrolled) * 1000) / 10 : 0;
    const dropout = enrolled ? Math.round(((enrolled - completed - inProgress) / enrolled) * 1000) / 10 : 0;
    return {
      course_id: c.id,
      title: c.title,
      enrolled,
      started,
      in_progress: inProgress,
      completed,
      avg_completion: avg,
      certs: certCount,
      dropout_rate: Math.max(0, dropout),
    };
  });

  return { batch, coordinatorName, coordinatorEmail, coordinatorPhone, courses, students: studentRows, courseAnalytics };
}
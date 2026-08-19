import { supabase } from "@/integrations/supabase/client";
import { getRevenueSummary, resolveRevenueRange } from "./revenueSummaryService";

export type DateRange = "today" | "7d" | "30d" | "90d";

/**
 * Uses the canonical revenue window (inclusive whole days) so the dashboard and
 * the Reports module always describe the exact same period.
 */
function rangeStart(r: DateRange): Date {
  return resolveRevenueRange(r).from ?? new Date(0);
}

function bucketDays(r: DateRange): number {
  return r === "today" ? 1 : r === "7d" ? 7 : r === "30d" ? 30 : 90;
}

export const dashboardService = {
  async getAdminStats(workspaceId: string) {
    const [courses, members, enrollments] = await Promise.all([
      supabase.from("courses").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).is("deleted_at", null),
      supabase.from("workspace_members").select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId).eq("status", "active"),
      supabase.from("enrollments").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    ]);
    return {
      coursesCount: courses.count ?? 0,
      membersCount: members.count ?? 0,
      enrollmentsCount: enrollments.count ?? 0,
    };
  },

  async getInstructorStats(workspaceId: string, instructorId: string) {
    const [{ count: courseCount }, { count: submissionsCount }] = await Promise.all([
      supabase.from("courses").select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId).eq("instructor_id", instructorId).is("deleted_at", null),
      supabase.from("assignment_submissions").select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId).is("graded_at", null),
    ]);
    return {
      assignedCourses: courseCount ?? 0,
      pendingSubmissions: submissionsCount ?? 0,
    };
  },

  async getStudentDashboard(workspaceId: string, studentId: string) {
    const { data: enrollments } = await supabase
      .from("enrollments")
      .select("*, courses(id, title, thumbnail_url, summary)")
      .eq("workspace_id", workspaceId)
      .eq("student_id", studentId)
      .order("enrolled_at", { ascending: false })
      .range(0, 11);
    return { enrollments: (enrollments ?? []).filter((e: any) => e.courses) };
  },

  async getAdminDashboardStats(workspaceId: string, range: DateRange) {
    const revRange = resolveRevenueRange(range);
    const sinceIso = (revRange.from ?? new Date(0)).toISOString();
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const [
      coursesAll, coursesMonth,
      students, enrollmentsRange, enrollmentsAll, enrollmentsCompleted,
      submissions, pendingGrading,
      attempts, liveAll, liveUpcoming,
      rangeRevenue, allRevenue, offlinePending,
      integration,
    ] = await Promise.all([
      supabase.from("courses").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).is("deleted_at", null),
      supabase.from("courses").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).is("deleted_at", null).gte("created_at", monthStart.toISOString()),
      supabase.from("workspace_members").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("role", "student").eq("status", "active"),
      supabase.from("enrollments").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).gte("enrolled_at", sinceIso),
      supabase.from("enrollments").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
      supabase.from("enrollments").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("status", "completed"),
      supabase.from("assignment_submissions").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).gte("submitted_at", sinceIso),
      supabase.from("assignment_submissions").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).is("graded_at", null),
      supabase.from("quiz_attempts").select("score, max_score").eq("workspace_id", workspaceId).gte("submitted_at", sinceIso),
      supabase.from("live_classes").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
      supabase.from("live_classes").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).gte("starts_at", new Date().toISOString()),
      getRevenueSummary({ workspaceId, range: revRange }),
      getRevenueSummary({ workspaceId, period: "all" }),
      supabase.from("payments").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("provider", "offline").eq("status", "pending" as any),
      supabase.from("workspace_integrations").select("provider, enabled").eq("workspace_id", workspaceId).in("provider", ["razorpay"]),
    ]);

    const totalAttempts = (attempts.data ?? []).length;
    const quizAvg = totalAttempts
      ? Math.round(((attempts.data ?? []).reduce((s, a: any) => s + (a.max_score ? (a.score / a.max_score) : 0), 0) / totalAttempts) * 100)
      : 0;
    const revenueRange = rangeRevenue.gross;
    const revenueAll = allRevenue.gross;
    const currency = rangeRevenue.currency ?? allRevenue.currency ?? "INR";
    const completionRate = (enrollmentsAll.count ?? 0) > 0
      ? Math.round(((enrollmentsCompleted.count ?? 0) / (enrollmentsAll.count ?? 1)) * 100)
      : 0;
    const paymentsConfigured = (integration.data ?? []).some((i: any) => i.enabled);

    return {
      coursesCount: coursesAll.count ?? 0,
      coursesNewThisMonth: coursesMonth.count ?? 0,
      activeStudents: students.count ?? 0,
      enrollmentsRange: enrollmentsRange.count ?? 0,
      enrollmentsTotal: enrollmentsAll.count ?? 0,
      completionRate,
      submissionsRange: submissions.count ?? 0,
      pendingGrading: pendingGrading.count ?? 0,
      quizAvg,
      liveClassesTotal: liveAll.count ?? 0,
      liveUpcoming: liveUpcoming.count ?? 0,
      revenueRange,
      revenueAll,
      currency,
      paymentsConfigured,
      offlinePending: offlinePending.count ?? 0,
    };
  },

  async getEnrollmentTrend(workspaceId: string, range: DateRange) {
    const since = rangeStart(range);
    const { data } = await supabase
      .from("enrollments")
      .select("enrolled_at")
      .eq("workspace_id", workspaceId)
      .gte("enrolled_at", since.toISOString())
      .order("enrolled_at", { ascending: true });
    const days = bucketDays(range);
    const buckets: { label: string; date: string; enrollments: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
      buckets.push({
        label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        date: d.toISOString().slice(0, 10),
        enrollments: 0,
      });
    }
    const idx = Object.fromEntries(buckets.map((b, i) => [b.date, i]));
    (data ?? []).forEach((r: any) => {
      const k = new Date(r.enrolled_at).toISOString().slice(0, 10);
      if (idx[k] !== undefined) buckets[idx[k]].enrollments++;
    });
    return buckets;
  },

  async getRevenueTrend(workspaceId: string, range: DateRange) {
    const since = rangeStart(range);
    const { data } = await supabase
      .from("payments")
      .select("amount, total_amount, created_at, status")
      .eq("workspace_id", workspaceId)
      .eq("status", "succeeded" as any)
      .gte("created_at", since.toISOString());
    const days = bucketDays(range);
    const buckets: { label: string; date: string; revenue: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
      buckets.push({
        label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        date: d.toISOString().slice(0, 10),
        revenue: 0,
      });
    }
    const idx = Object.fromEntries(buckets.map((b, i) => [b.date, i]));
    (data ?? []).forEach((r: any) => {
      const k = new Date(r.created_at).toISOString().slice(0, 10);
      if (idx[k] !== undefined) buckets[idx[k]].revenue += Number(r.total_amount ?? r.amount ?? 0);
    });
    return buckets;
  },

  async getCoursePerformance(workspaceId: string, limit = 5) {
    const { data: courses } = await supabase
      .from("courses")
      .select("id, title, status, price_amount, currency, instructor_id, profiles:profiles!courses_instructor_id_fkey(full_name)")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(limit);
    const ids = (courses ?? []).map((c: any) => c.id);
    if (ids.length === 0) return [];
    const { data: quizzesRows } = await supabase.from("quizzes")
      .select("id, course_id").eq("workspace_id", workspaceId).in("course_id", ids);
    const quizCourseMap = Object.fromEntries((quizzesRows ?? []).map((q: any) => [q.id, q.course_id]));
    const quizIds = (quizzesRows ?? []).map((q: any) => q.id);
    const [enr, attemptsRes, pays] = await Promise.all([
      supabase.from("enrollments").select("course_id, status").eq("workspace_id", workspaceId).in("course_id", ids),
      quizIds.length
        ? supabase.from("quiz_attempts").select("quiz_id, score, max_score").eq("workspace_id", workspaceId).in("quiz_id", quizIds)
        : Promise.resolve({ data: [] as any[] }),
      supabase.from("payments").select("course_id, amount, total_amount").eq("workspace_id", workspaceId).eq("status", "succeeded" as any).in("course_id", ids),
    ]);
    const attemptsByCourse: Record<string, any[]> = {};
    ((attemptsRes as any).data ?? []).forEach((a: any) => {
      const cid = quizCourseMap[a.quiz_id];
      if (!cid) return;
      (attemptsByCourse[cid] ||= []).push(a);
    });
    return (courses ?? []).map((c: any) => {
      const courseEnrolls = (enr.data ?? []).filter((e: any) => e.course_id === c.id);
      const completed = courseEnrolls.filter((e: any) => e.status === "completed").length;
      const total = courseEnrolls.length;
      const courseAttempts = attemptsByCourse[c.id] ?? [];
      const quizAvg = courseAttempts.length
        ? Math.round((courseAttempts.reduce((s: number, a: any) => s + (a.max_score ? a.score / a.max_score : 0), 0) / courseAttempts.length) * 100)
        : 0;
      const revenue = (pays.data ?? []).filter((p: any) => p.course_id === c.id).reduce((s: number, p: any) => s + Number(p.total_amount ?? p.amount ?? 0), 0);
      return {
        id: c.id,
        title: c.title,
        instructor: c.profiles?.full_name ?? "Unassigned",
        status: c.status,
        enrollments: total,
        completion: total ? Math.round((completed / total) * 100) : 0,
        avgProgress: total ? Math.round((completed / total) * 100) : 0,
        quizAvg,
        revenue,
        currency: c.currency || "INR",
      };
    });
  },

  async getStudentEngagement(workspaceId: string, limit = 5) {
    const { data: members } = await supabase.from("workspace_members")
      .select("profile_id, profiles:profile_id(id, full_name)")
      .eq("workspace_id", workspaceId).eq("role", "student").eq("status", "active").limit(50);
    const ids = (members ?? []).map((m: any) => m.profile_id);
    if (ids.length === 0) return [];
    const [enr, progress, pendSubs, attempts] = await Promise.all([
      supabase.from("enrollments").select("student_id, status, course_id").eq("workspace_id", workspaceId).in("student_id", ids),
      supabase.from("lesson_progress").select("student_id, is_completed, last_viewed_at").eq("workspace_id", workspaceId).in("student_id", ids),
      supabase.from("assignment_submissions").select("student_id").eq("workspace_id", workspaceId).is("graded_at", null).in("student_id", ids),
      supabase.from("quiz_attempts").select("student_id, score, max_score").eq("workspace_id", workspaceId).in("student_id", ids),
    ]);
    const rows = (members ?? []).map((m: any) => {
      const sid = m.profile_id;
      const sEnrolls = (enr.data ?? []).filter((e: any) => e.student_id === sid);
      const sProgress = (progress.data ?? []).filter((p: any) => p.student_id === sid);
      const completed = sProgress.filter((p: any) => p.is_completed).length;
      const avgProgress = sProgress.length ? Math.round((completed / sProgress.length) * 100) : 0;
      const lastActive = sProgress.length
        ? sProgress.map((p: any) => +new Date(p.last_viewed_at)).sort((a, b) => b - a)[0]
        : 0;
      const pending = (pendSubs.data ?? []).filter((p: any) => p.student_id === sid).length;
      const sAttempts = (attempts.data ?? []).filter((a: any) => a.student_id === sid);
      const quizAvg = sAttempts.length
        ? Math.round((sAttempts.reduce((s: number, a: any) => s + (a.max_score ? a.score / a.max_score : 0), 0) / sAttempts.length) * 100)
        : 0;
      const inactiveDays = lastActive ? Math.floor((Date.now() - lastActive) / 86400000) : 999;
      const risk: "on_track" | "needs_attention" | "inactive" =
        sEnrolls.length === 0 || inactiveDays > 14 ? "inactive"
        : (avgProgress < 30 || pending > 0 || quizAvg < 50) ? "needs_attention"
        : "on_track";
      return {
        id: sid,
        name: m.profiles?.full_name ?? "Unnamed",
        enrolled: sEnrolls.length,
        avgProgress,
        lastActive: lastActive ? new Date(lastActive).toISOString() : null,
        pending,
        quizAvg,
        risk,
      };
    });
    const order = { needs_attention: 0, inactive: 1, on_track: 2 } as const;
    return rows.sort((a, b) => order[a.risk] - order[b.risk]).slice(0, limit);
  },

  async getTodayOperations(workspaceId: string) {
    const now = new Date();
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const tomorrow = new Date(todayStart); tomorrow.setDate(tomorrow.getDate() + 1);
    const inSevenDays = new Date(); inSevenDays.setDate(inSevenDays.getDate() + 7);

    const [live, dueAssignments, pendingSubs, recentAttempts, newEnrolls] = await Promise.all([
      supabase.from("live_classes")
        .select("id, title, starts_at, meeting_url, status, course_id")
        .eq("workspace_id", workspaceId)
        .gte("starts_at", todayStart.toISOString())
        .lte("starts_at", tomorrow.toISOString())
        .order("starts_at", { ascending: true }).limit(5),
      supabase.from("assignments")
        .select("id, title, due_at, course_id")
        .eq("workspace_id", workspaceId)
        .gte("due_at", now.toISOString())
        .lte("due_at", inSevenDays.toISOString())
        .order("due_at", { ascending: true }).limit(5),
      supabase.from("assignment_submissions")
        .select("id, submitted_at, assignments(title, course_id), profiles:student_id(full_name)")
        .eq("workspace_id", workspaceId).is("graded_at", null)
        .order("submitted_at", { ascending: false }).limit(5),
      supabase.from("quiz_attempts")
        .select("id, submitted_at, score, max_score, quizzes(title), profiles:student_id(full_name)")
        .eq("workspace_id", workspaceId)
        .order("submitted_at", { ascending: false }).limit(5),
      supabase.from("enrollments")
        .select("id, enrolled_at, courses(title), profiles:student_id(full_name)")
        .eq("workspace_id", workspaceId)
        .order("enrolled_at", { ascending: false }).limit(5),
    ]);

    return {
      liveToday: live.data ?? [],
      dueAssignments: dueAssignments.data ?? [],
      pendingSubmissions: pendingSubs.data ?? [],
      recentAttempts: recentAttempts.data ?? [],
      newEnrollments: newEnrolls.data ?? [],
    };
  },

  async getInstructorDashboardStats(workspaceId: string, instructorId: string, range: DateRange) {
    const sinceIso = rangeStart(range).toISOString();
    // Instructors can own a course directly (courses.instructor_id) OR be
    // assigned via the course_instructors join table. Include both.
    const [ownedRes, assignedRes] = await Promise.all([
      supabase.from("courses")
        .select("id, title")
        .eq("workspace_id", workspaceId)
        .eq("instructor_id", instructorId)
        .is("deleted_at", null),
      supabase.from("course_instructors")
        .select("course_id, courses!inner(id, title, workspace_id, deleted_at)")
        .eq("instructor_id", instructorId)
        .eq("courses.workspace_id", workspaceId)
        .is("courses.deleted_at", null),
    ]);
    const map = new Map<string, { id: string; title: string }>();
    (ownedRes.data ?? []).forEach((c: any) => map.set(c.id, { id: c.id, title: c.title }));
    (assignedRes.data ?? []).forEach((row: any) => {
      const c = row.courses;
      if (c?.id) map.set(c.id, { id: c.id, title: c.title });
    });
    const myCourses = Array.from(map.values());
    const ids = myCourses.map((c) => c.id);
    if (ids.length === 0) {
      return { courses: [], activeStudents: 0, pendingSubmissions: 0, quizAvg: 0, upcomingLive: 0, enrollmentsRange: 0 };
    }
    const { data: qRows } = await supabase.from("quizzes").select("id").eq("workspace_id", workspaceId).in("course_id", ids);
    const qIds = (qRows ?? []).map((q: any) => q.id);
    const { data: aRows } = await supabase.from("assignments").select("id").eq("workspace_id", workspaceId).in("course_id", ids);
    const aIds = (aRows ?? []).map((a: any) => a.id);
    const [enrolls, attempts, live, enrollRange] = await Promise.all([
      supabase.from("enrollments").select("student_id", { count: "exact" }).eq("workspace_id", workspaceId).in("course_id", ids),
      qIds.length
        ? supabase.from("quiz_attempts").select("score, max_score").eq("workspace_id", workspaceId).in("quiz_id", qIds).gte("submitted_at", sinceIso)
        : Promise.resolve({ data: [] as any[] }),
      supabase.from("live_classes").select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId).in("course_id", ids).gte("starts_at", new Date().toISOString()),
      supabase.from("enrollments").select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId).in("course_id", ids).gte("enrolled_at", sinceIso),
    ]);
    const uniqueStudents = new Set((enrolls.data ?? []).map((e: any) => e.student_id));
    const { count: pendingCount } = aIds.length
      ? await supabase.from("assignment_submissions")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", workspaceId).is("graded_at", null).in("assignment_id", aIds)
      : { count: 0 } as any;
    const ats = ((attempts as any).data ?? []) as any[];
    const quizAvg = ats.length
      ? Math.round((ats.reduce((s: number, a: any) => s + (a.max_score ? a.score / a.max_score : 0), 0) / ats.length) * 100)
      : 0;
    return {
      courses: myCourses,
      activeStudents: uniqueStudents.size,
      pendingSubmissions: pendingCount ?? 0,
      quizAvg,
      upcomingLive: live.count ?? 0,
      enrollmentsRange: enrollRange.count ?? 0,
    };
  },

  async getStudentDashboardStats(workspaceId: string, studentId: string) {
    // First load enrollments so we can scope live-class lookups by enrolled
    // courses rather than the student's personal workspace.
    const enrolls = await supabase.from("enrollments")
      .select("id, status, course_id, courses(id, title, slug, thumbnail_url, summary)")
      .eq("student_id", studentId)
      .order("enrolled_at", { ascending: false });
    const enrolledIds = (enrolls.data ?? []).map((e: any) => e.course_id).filter(Boolean);

    const [progress, submissions, attempts, certs, live, upcomingAssignments] = await Promise.all([
      supabase.from("lesson_progress")
        .select("lesson_id, is_completed, last_viewed_at, progress_seconds, enrollment_id, lessons(id, title, course_id)")
        .eq("workspace_id", workspaceId).eq("student_id", studentId)
        .order("last_viewed_at", { ascending: false }),
      supabase.from("assignment_submissions")
        .select("id, assignment_id, graded_at, assignments(title, due_at, course_id)")
        .eq("workspace_id", workspaceId).eq("student_id", studentId),
      supabase.from("quiz_attempts")
        .select("id, score, max_score, submitted_at, quizzes(title)")
        .eq("workspace_id", workspaceId).eq("student_id", studentId)
        .order("submitted_at", { ascending: false }).limit(5),
      supabase.from("certificates").select("id, certificate_number, issued_at, course_id, courses(title), verification_code")
        .eq("workspace_id", workspaceId).eq("student_id", studentId)
        .order("issued_at", { ascending: false }).limit(5),
      enrolledIds.length
        ? supabase.from("live_classes")
            .select("id, title, starts_at, meeting_url, timezone, courses(title), instructor:profiles!live_classes_instructor_id_fkey(full_name)")
            .in("course_id", enrolledIds)
            .gte("starts_at", new Date().toISOString())
            .order("starts_at", { ascending: true }).limit(5)
        : Promise.resolve({ data: [] as any[] }),
      supabase.from("assignments").select("id, title, due_at, course_id")
        .eq("workspace_id", workspaceId)
        .gte("due_at", new Date().toISOString())
        .order("due_at", { ascending: true }).limit(5),
    ]);
    const enrolled = (enrolls.data ?? []).filter((e: any) => e.courses);
    const prog = progress.data ?? [];
    const enrolledCourseIds = enrolled.map((e: any) => e.course_id);

    const { data: lessonsRows } = enrolledCourseIds.length
      ? await supabase.from("lessons").select("id, course_id").in("course_id", enrolledCourseIds)
      : ({ data: [] as any[] } as any);
    const totalsByCourse: Record<string, number> = {};
    (lessonsRows ?? []).forEach((l: any) => {
      totalsByCourse[l.course_id] = (totalsByCourse[l.course_id] ?? 0) + 1;
    });
    const completedByCourse: Record<string, number> = {};
    prog.forEach((p: any) => {
      const cid = p.lessons?.course_id;
      if (!cid || !p.is_completed) return;
      completedByCourse[cid] = (completedByCourse[cid] ?? 0) + 1;
    });
    const progressByCourse: Record<string, number> = {};
    enrolledCourseIds.forEach((cid: string) => {
      const total = totalsByCourse[cid] ?? 0;
      const done = completedByCourse[cid] ?? 0;
      progressByCourse[cid] = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
    });
    const completedCourseIds = new Set(
      enrolledCourseIds.filter((cid: string) => progressByCourse[cid] >= 100)
    );
    const certificateByCourse: Record<string, any> = {};
    (certs.data ?? []).forEach((c: any) => {
      if (c.course_id) certificateByCourse[c.course_id] = c;
    });

    const completedLessons = prog.filter((p: any) => p.is_completed).length;
    const overallProgress = prog.length ? Math.round((completedLessons / prog.length) * 100) : 0;
    const last =
      prog.find((p: any) => p.lessons?.course_id && !completedCourseIds.has(p.lessons.course_id)) ||
      prog[0];

    const submittedAssignmentIds = new Set(
      (submissions.data ?? []).map((s: any) => s.assignment_id)
    );
    const enrolledCourseIdSet = new Set(enrolledCourseIds);
    const filteredUpcomingAssignments = (upcomingAssignments.data ?? []).filter((a: any) =>
      enrolledCourseIdSet.has(a.course_id) &&
      !completedCourseIds.has(a.course_id) &&
      !submittedAssignmentIds.has(a.id)
    );
    const pendingAssignments = (submissions.data ?? []).filter((s: any) =>
      s.graded_at === null &&
      s.assignments?.course_id &&
      !completedCourseIds.has(s.assignments.course_id)
    );
    return {
      enrollments: enrolled,
      overallProgress,
      completedLessons,
      totalLessons: prog.length,
      progressByCourse,
      completedCourseIds: Array.from(completedCourseIds),
      certificateByCourse,
      lastLesson: last
        ? {
            lessonId: last.lesson_id,
            title: last.lessons?.title,
            courseId: last.lessons?.course_id,
            seconds: last.progress_seconds,
            courseCompleted: last.lessons?.course_id ? completedCourseIds.has(last.lessons.course_id) : false,
          }
        : null,
      pendingAssignments,
      upcomingAssignments: filteredUpcomingAssignments,
      recentAttempts: attempts.data ?? [],
      certificates: certs.data ?? [],
      upcomingLive: live.data ?? [],
    };
  },
};
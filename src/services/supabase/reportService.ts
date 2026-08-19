import { supabase } from "@/integrations/supabase/client";

export const reportService = {
  async overview(workspaceId: string) {
    const [enroll, completions, subs, attempts, live] = await Promise.all([
      supabase.from("enrollments").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
      supabase.from("enrollments").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("status", "completed"),
      supabase.from("assignment_submissions").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
      supabase.from("quiz_attempts").select("score, max_score, percentage, passed").eq("workspace_id", workspaceId).range(0, 999),
      supabase.from("live_classes").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    ]);
    const att = attempts.data ?? [];
    const avg = att.length
      ? Math.round(
          (att.reduce((s, a: any) => s + (a.percentage != null ? Number(a.percentage) : (a.max_score ? (Number(a.score) / Number(a.max_score)) * 100 : 0)), 0) /
            att.length) * 10
        ) / 10
      : 0;
    return {
      activeLearners: enroll.count ?? 0,
      completions: completions.count ?? 0,
      submissions: subs.count ?? 0,
      quizAverage: avg,
      liveClasses: live.count ?? 0,
    };
  },

  async courses(workspaceId: string, page = 1, pageSize = 20) {
    const from = (page - 1) * pageSize;
    const { data, count } = await supabase
      .from("courses")
      .select("id, title, slug, status, visibility, instructor_id, workspace_id", { count: "exact" })
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .order("title", { ascending: true })
      .range(from, from + pageSize - 1);
    const rows = await Promise.all(
      (data ?? []).map(async (c: any) => {
        const [{ count: enrolls }, { count: complete }, { count: quizzes }, { count: assigns }] = await Promise.all([
          supabase.from("enrollments").select("id", { count: "exact", head: true }).eq("course_id", c.id),
          supabase.from("enrollments").select("id", { count: "exact", head: true }).eq("course_id", c.id).eq("status", "completed"),
          supabase.from("quizzes").select("id", { count: "exact", head: true }).eq("course_id", c.id),
          supabase.from("assignments").select("id", { count: "exact", head: true }).eq("course_id", c.id),
        ]);
        return {
          ...c,
          enrollments: enrolls ?? 0,
          completions: complete ?? 0,
          quizzes: quizzes ?? 0,
          assignments: assigns ?? 0,
          avgProgress: enrolls ? Math.round(((complete ?? 0) / (enrolls || 1)) * 100) : 0,
        };
      })
    );
    return { rows, total: count ?? 0, page, pageSize };
  },

  async students(workspaceId: string, page = 1, pageSize = 1000) {
    // Build the roster from TWO sources, then dedupe by profile id:
    //   1) workspace_members where role='student'
    //   2) distinct enrollments.student_id for this workspace (covers
    //      self-enrolled students who don't have a 'student' membership row)
    const [membersRes, enrollsRes] = await Promise.all([
      supabase.from("workspace_members")
        .select("id, profile_id, status, created_at")
        .eq("workspace_id", workspaceId)
        .eq("role", "student"),
      supabase.from("enrollments")
        .select("student_id")
        .eq("workspace_id", workspaceId),
    ]);
    if (membersRes.error) console.error("[reports.students] members error:", membersRes.error);
    if (enrollsRes.error) console.error("[reports.students] enrollments error:", enrollsRes.error);

    const memberMap = new Map<string, { status: string; createdAt?: string }>();
    for (const m of membersRes.data ?? []) {
      if (!m.profile_id) continue;
      memberMap.set(m.profile_id, { status: m.status ?? "active", createdAt: m.created_at });
    }
    for (const e of enrollsRes.data ?? []) {
      if (!e.student_id || memberMap.has(e.student_id)) continue;
      memberMap.set(e.student_id, { status: "active" });
    }

    const studentIds = Array.from(memberMap.keys());
    console.log(
      `[reports.students] ws=${workspaceId} members=${membersRes.data?.length ?? 0} ` +
      `enrollStudents=${new Set((enrollsRes.data ?? []).map((e: any) => e.student_id)).size} ` +
      `unique=${studentIds.length}`
    );
    if (!studentIds.length) return { rows: [], total: 0, page, pageSize };

    const { data: profs } = await supabase
      .from("profiles")
      .select("id, full_name, email, created_at")
      .in("id", studentIds);
    const profMap = new Map((profs ?? []).map((p: any) => [p.id, p]));

    const rows = await Promise.all(
      studentIds.map(async (sid) => {
        const meta = memberMap.get(sid)!;
        const prof: any = profMap.get(sid);
        const [enrRes, pendingRes, completedRes, attemptsRes] = await Promise.all([
          supabase.from("enrollments").select("id", { count: "exact", head: true })
            .eq("workspace_id", workspaceId).eq("student_id", sid),
          supabase.from("assignment_submissions").select("id", { count: "exact", head: true })
            .eq("workspace_id", workspaceId).eq("student_id", sid).is("graded_at", null),
          supabase.from("assignment_submissions").select("id", { count: "exact", head: true })
            .eq("workspace_id", workspaceId).eq("student_id", sid).not("graded_at", "is", null),
          supabase.from("quiz_attempts").select("passed")
            .eq("workspace_id", workspaceId).eq("student_id", sid),
        ]);
        const attempts = attemptsRes.data ?? [];
        const passed = attempts.filter((a: any) => a.passed === true).length;
        const quizPct = attempts.length ? Math.round((passed / attempts.length) * 100) : 0;
        return {
          id: sid,
          studentId: sid,
          name: prof?.full_name ?? "Student",
          email: prof?.email ?? "—",
          status: meta.status,
          registeredAt: prof?.created_at ?? meta.createdAt,
          enrollments: enrRes.count ?? 0,
          pending: pendingRes.count ?? 0,
          completed: completedRes.count ?? 0,
          quizPct,
        };
      })
    );
    return { rows, total: studentIds.length, page, pageSize };
  },

  async quizzes(workspaceId: string, page = 1, pageSize = 20) {
    const from = (page - 1) * pageSize;
    const { data, count } = await supabase
      .from("quizzes")
      .select("id, title, course_id, courses(title)", { count: "exact" })
      .eq("workspace_id", workspaceId)
      .range(from, from + pageSize - 1);
    const rows = await Promise.all(
      (data ?? []).map(async (q: any) => {
        const { data: atts } = await supabase
          .from("quiz_attempts")
          .select("score, max_score, percentage, passed")
          .eq("quiz_id", q.id);
        const list = atts ?? [];
        const avg = list.length
          ? Math.round(
              (list.reduce((s, a: any) => s + (a.percentage != null ? Number(a.percentage) : (a.max_score ? (Number(a.score) / Number(a.max_score)) * 100 : 0)), 0) / list.length) * 10
            ) / 10
          : 0;
        const passing = list.filter((a: any) => a.passed === true).length;
        return {
          id: q.id,
          title: q.title,
          courseTitle: q.courses?.title ?? "—",
          attempts: list.length,
          average: avg,
          passRate: list.length ? Math.round((passing / list.length) * 100) : 0,
        };
      })
    );
    return { rows, total: count ?? 0, page, pageSize };
  },
};
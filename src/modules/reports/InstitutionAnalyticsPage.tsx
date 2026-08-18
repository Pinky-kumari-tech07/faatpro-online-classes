import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format, subDays, startOfMonth, endOfMonth, startOfDay, endOfDay, startOfYear } from "date-fns";
import {
  Building2, Users, GraduationCap, Award, FileText, TrendingUp, Wallet,
  Calendar as CalendarIcon, Download, ArrowLeft, Trophy,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { useWorkspace } from "@/shared/hooks/useWorkspace";
import { supabase } from "@/integrations/supabase/client";
import StatCard from "@/modules/dashboard/components/StatCard";
import { fetchInstitutionAnalytics, aggregateByInstitution, fetchInstitutions } from "./institutionReportService";
import { exportToCsv, exportToXlsx, formatRelativeTime } from "@/modules/students/exportUtils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip as RTooltip, PieChart, Pie, Cell, Legend,
} from "recharts";

type Preset = "today" | "yesterday" | "7d" | "30d" | "this_month" | "last_month" | "academic_year" | "custom";

function presetRange(p: Preset): { from: Date; to: Date } {
  const now = new Date();
  switch (p) {
    case "today": return { from: startOfDay(now), to: endOfDay(now) };
    case "yesterday": return { from: startOfDay(subDays(now, 1)), to: endOfDay(subDays(now, 1)) };
    case "7d": return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) };
    case "30d": return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) };
    case "this_month": return { from: startOfMonth(now), to: endOfDay(now) };
    case "last_month": {
      const lm = subDays(startOfMonth(now), 1);
      return { from: startOfMonth(lm), to: endOfMonth(lm) };
    }
    case "academic_year": return { from: startOfYear(now), to: endOfDay(now) };
    default: return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) };
  }
}

const COLORS = ["hsl(var(--primary))", "#10b981", "#f59e0b", "#ef4444", "#6366f1", "#06b6d4"];

export default function InstitutionAnalyticsPage() {
  const { membership } = useWorkspace();
  const wsId = membership!.workspace.id;

  const [preset, setPreset] = useState<Preset>("30d");
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  const [institutionId, setInstitutionId] = useState<string>("all");
  const [courseId, setCourseId] = useState<string>("all");
  const [instructorId, setInstructorId] = useState<string>("all");
  const [category, setCategory] = useState<string>("all");
  const [academicYear, setAcademicYear] = useState<string>("all");

  const range = useMemo(() => {
    if (preset === "custom" && customFrom && customTo)
      return { from: startOfDay(customFrom), to: endOfDay(customTo) };
    return presetRange(preset);
  }, [preset, customFrom, customTo]);

  // Reference lists for filter selectors
  const { data: institutions } = useQuery({
    queryKey: ["inst-list", wsId],
    queryFn: () => fetchInstitutions(wsId),
  });
  const { data: courseList } = useQuery({
    queryKey: ["inst-course-list", wsId],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("id, title, instructor_id, category")
        .eq("workspace_id", wsId).is("deleted_at", null).order("title");
      return data ?? [];
    },
  });
  const instructorOptions = useMemo(() => {
    const m = new Map<string, string>();
    (courseList ?? []).forEach((c: any) => { if (c.instructor_id) m.set(c.instructor_id, c.instructor_id); });
    return Array.from(m.keys());
  }, [courseList]);
  const { data: instructorProfiles } = useQuery({
    queryKey: ["inst-instructor-profiles", instructorOptions.join(",")],
    enabled: instructorOptions.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name").in("id", instructorOptions);
      return data ?? [];
    },
  });
  const categories = useMemo(() => {
    const s = new Set<string>();
    (courseList ?? []).forEach((c: any) => { if (c.category) s.add(c.category); });
    return Array.from(s);
  }, [courseList]);
  const academicYears = useMemo(() => {
    const now = new Date().getFullYear();
    return [`${now - 1}-${now}`, `${now}-${now + 1}`, `${now + 1}-${now + 2}`];
  }, []);

  // Main analytics fetch
  const { data: raw, isLoading } = useQuery({
    queryKey: ["inst-analytics", wsId, institutionId, courseId, instructorId, category, academicYear,
      range.from.toISOString(), range.to.toISOString()],
    queryFn: () => fetchInstitutionAnalytics({
      workspaceId: wsId,
      institutionId: institutionId === "all" ? undefined : institutionId,
      courseId: courseId === "all" ? undefined : courseId,
      instructorId: instructorId === "all" ? undefined : instructorId,
      category: category === "all" ? undefined : category,
      academicYear: academicYear === "all" ? undefined : academicYear,
      from: range.from, to: range.to,
    }),
  });

  const rows = useMemo(() => raw ? aggregateByInstitution(raw) : [], [raw]);

  // Aggregate totals across visible institutions
  const totals = useMemo(() => {
    const acc = {
      students: 0, active: 0, inactive: 0, enrollments: 0, uniqueCourses: 0,
      revenue: 0, certificates: 0, submissions: 0, attempts: 0,
      avgCompletion: 0, avgProgress: 0,
    };
    rows.forEach((r: any) => {
      acc.students += r.total_students; acc.active += r.active_students;
      acc.inactive += r.inactive_students; acc.enrollments += r.total_enrollments;
      acc.uniqueCourses += r.unique_courses; acc.revenue += r.revenue;
      acc.certificates += r.certificates; acc.submissions += r.assignments_submitted;
      acc.attempts += r.quiz_attempts;
    });
    if (rows.length > 0) {
      acc.avgCompletion = Math.round(rows.reduce((s: number, r: any) => s + r.completion_rate, 0) / rows.length);
      acc.avgProgress = Math.round(rows.reduce((s: number, r: any) => s + r.avg_progress, 0) / rows.length);
    }
    return acc;
  }, [rows]);

  const currency = rows[0]?.currency ?? "INR";
  const fmtMoney = (n: number) =>
    new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(n);

  // ---------- Derived datasets ----------

  // Course-wise rows (one per institution × course)
  const courseRows = useMemo(() => {
    if (!raw) return [];
    const lessonsByCourse = new Map<string, string[]>();
    raw.lessons.forEach((l: any) => {
      const a = lessonsByCourse.get(l.course_id) ?? []; a.push(l.id); lessonsByCourse.set(l.course_id, a);
    });
    const completedSet = new Set<string>();
    raw.lessonProgress.forEach((p: any) => completedSet.add(`${p.student_id}:${p.lesson_id}`));
    const courseMap = new Map((raw.courses ?? []).map((c: any) => [c.id, c]));
    const instructorMap = new Map((instructorProfiles ?? []).map((p: any) => [p.id, p.full_name]));
    const instMap = new Map((raw.institutions ?? []).map((i: any) => [i.id, i.name]));

    const key = (ci: string, ii: string) => `${ci}__${ii}`;
    const acc = new Map<string, any>();

    raw.enrollments.forEach((e: any) => {
      const k = key(e.course_id, e.institution_id);
      const row = acc.get(k) ?? {
        course_id: e.course_id, institution_id: e.institution_id,
        course_title: (courseMap.get(e.course_id) as any)?.title ?? "—",
        institution_name: instMap.get(e.institution_id) ?? "—",
        instructor: instructorMap.get((courseMap.get(e.course_id) as any)?.instructor_id) ?? "—",
        enrolled: 0, completed: 0, in_progress: 0, not_started: 0,
        progress_sum: 0, progress_n: 0,
      };
      row.enrolled += 1;
      const total = (lessonsByCourse.get(e.course_id) ?? []).length;
      const done = total === 0 ? 0 : (lessonsByCourse.get(e.course_id) ?? [])
        .filter((lid: string) => completedSet.has(`${e.student_id}:${lid}`)).length;
      const pct = total === 0 ? 0 : Math.round((done / total) * 100);
      if (e.status === "completed" || pct >= 100) row.completed += 1;
      else if (pct === 0) row.not_started += 1;
      else row.in_progress += 1;
      row.progress_sum += pct; row.progress_n += 1;
      acc.set(k, row);
    });

    return Array.from(acc.values()).map((r) => {
      const certs = raw.certificates.filter((c: any) => c.course_id === r.course_id).length;
      const courseAttempts = raw.attempts; // not joined to course here; approximate
      const revenue = raw.payments
        .filter((p: any) => p.status === "succeeded" && p.course_id === r.course_id)
        .reduce((s: number, p: any) => s + Number(p.total_amount ?? p.amount ?? 0), 0);
      return {
        ...r,
        completion_pct: r.enrolled === 0 ? 0 : Math.round((r.completed / r.enrolled) * 100),
        certificates: certs,
        avg_quiz: courseAttempts.length === 0 ? 0
          : Math.round(courseAttempts.reduce((s: number, a: any) => s + Number(a.percentage ?? 0), 0) / courseAttempts.length),
        avg_assignment: 0,
        revenue,
      };
    });
  }, [raw, instructorProfiles]);

  // Student-wise rows
  const studentRows = useMemo(() => {
    if (!raw) return [];
    const instMap = new Map((raw.institutions ?? []).map((i: any) => [i.id, i.name]));
    const lessonsByCourse = new Map<string, string[]>();
    raw.lessons.forEach((l: any) => {
      const a = lessonsByCourse.get(l.course_id) ?? []; a.push(l.id); lessonsByCourse.set(l.course_id, a);
    });
    const completedSet = new Set<string>();
    raw.lessonProgress.forEach((p: any) => completedSet.add(`${p.student_id}:${p.lesson_id}`));

    return raw.mapping.map((m: any) => {
      const prof = raw.profiles.get(m.student_id) ?? {};
      const enrollments = raw.enrollments.filter((e: any) => e.student_id === m.student_id);
      const total = enrollments.reduce((acc: number, e: any) => acc + (lessonsByCourse.get(e.course_id) ?? []).length, 0);
      const done = enrollments.reduce((acc: number, e: any) =>
        acc + (lessonsByCourse.get(e.course_id) ?? []).filter((lid: string) => completedSet.has(`${e.student_id}:${lid}`)).length, 0);
      const progress = total === 0 ? 0 : Math.round((done / total) * 100);
      const certs = raw.certificates.filter((c: any) => c.student_id === m.student_id && !c.revoked_at).length;
      const allCompleted = enrollments.length > 0 && enrollments.every((e: any) => e.status === "completed");
      return {
        id: m.id,
        student_name: prof.full_name ?? "—",
        registration_number: m.registration_number ?? "—",
        institution_name: instMap.get(m.institution_id) ?? "—",
        program: [m.program, m.semester].filter(Boolean).join(" / ") || "—",
        academic_year: m.academic_year ?? "—",
        courses_enrolled: enrollments.length,
        progress,
        completion_status: allCompleted ? "Completed" : (enrollments.length > 0 ? "In progress" : "Not started"),
        certificates: certs,
        last_login: prof.last_login_at,
        enrollment_date: m.enrollment_date,
      };
    });
  }, [raw]);

  // Certificate rows
  const certificateRows = useMemo(() => {
    if (!raw) return [];
    const instMap = new Map((raw.institutions ?? []).map((i: any) => [i.id, i.name]));
    const courseMap = new Map((raw.courses ?? []).map((c: any) => [c.id, c]));
    const studentInst = new Map<string, string>();
    raw.mapping.forEach((m: any) => studentInst.set(m.student_id, m.institution_id));
    return raw.certificates.map((c: any) => {
      const prof = raw.profiles.get(c.student_id) ?? {};
      return {
        certificate_id: c.certificate_number,
        student_name: prof.full_name ?? "—",
        course_name: (courseMap.get(c.course_id) as any)?.title ?? "—",
        institution_name: instMap.get(studentInst.get(c.student_id) ?? "") ?? "—",
        issue_date: c.issued_at,
        completion_date: c.completion_date,
        status: c.revoked_at ? "Revoked" : "Active",
      };
    });
  }, [raw]);

  // ---------- Chart data ----------
  const completionByInstitutionChart = rows.map((r: any) => ({ name: r.name, completion: r.completion_rate }));
  const progressDistribution = useMemo(() => {
    const buckets = [
      { name: "0%", value: 0 }, { name: "1-25%", value: 0 }, { name: "26-50%", value: 0 },
      { name: "51-75%", value: 0 }, { name: "76-99%", value: 0 }, { name: "100%", value: 0 },
    ];
    studentRows.forEach((s: any) => {
      const p = s.progress;
      if (p === 0) buckets[0].value += 1;
      else if (p <= 25) buckets[1].value += 1;
      else if (p <= 50) buckets[2].value += 1;
      else if (p <= 75) buckets[3].value += 1;
      else if (p < 100) buckets[4].value += 1;
      else buckets[5].value += 1;
    });
    return buckets;
  }, [studentRows]);

  const dailyKey = (d: string) => format(new Date(d), "yyyy-MM-dd");
  const labelKey = (d: string) => format(new Date(d), "MMM d");

  const certificatesTrend = useMemo(() => {
    const m = new Map<string, { date: string; count: number }>();
    (raw?.certificates ?? []).forEach((c: any) => {
      if (!c.issued_at) return;
      const k = dailyKey(c.issued_at);
      const e = m.get(k) ?? { date: labelKey(c.issued_at), count: 0 };
      e.count += 1; m.set(k, e);
    });
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  }, [raw]);

  const enrollmentTrend = useMemo(() => {
    const m = new Map<string, { date: string; count: number }>();
    (raw?.enrollments ?? []).forEach((e: any) => {
      const k = dailyKey(e.enrolled_at);
      const r = m.get(k) ?? { date: labelKey(e.enrolled_at), count: 0 };
      r.count += 1; m.set(k, r);
    });
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  }, [raw]);

  const revenueTrend = useMemo(() => {
    const m = new Map<string, { date: string; revenue: number }>();
    (raw?.payments ?? []).filter((p: any) => p.status === "succeeded").forEach((p: any) => {
      const k = dailyKey(p.created_at);
      const e = m.get(k) ?? { date: labelKey(p.created_at), revenue: 0 };
      e.revenue += Number(p.total_amount ?? p.amount ?? 0); m.set(k, e);
    });
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  }, [raw]);

  // Leaderboards
  const leaders = (key: "total_students" | "completion_rate" | "certificates" | "revenue" | "avg_quiz") =>
    [...rows].sort((a: any, b: any) => Number(b[key]) - Number(a[key])).slice(0, 5);

  // ---------- Exports ----------
  const exportData = (kind: "summary" | "course" | "student" | "certificate", fmt: "csv" | "xlsx" | "pdf") => {
    const ts = format(new Date(), "yyyyMMdd-HHmm");
    let data: any[] = [];
    let title = "";
    if (kind === "summary") {
      title = "Institution Summary";
      data = rows.map((r: any) => ({
        Institution: r.name, Code: r.code ?? "",
        "Total Students": r.total_students, Active: r.active_students, Inactive: r.inactive_students,
        Enrollments: r.total_enrollments, "Unique Courses": r.unique_courses,
        "Avg Completion %": r.completion_rate, "Avg Progress %": r.avg_progress,
        Certificates: r.certificates, "Quiz Attempts": r.quiz_attempts,
        "Assignments Submitted": r.assignments_submitted, Revenue: r.revenue,
      }));
    } else if (kind === "course") {
      title = "Course-wise Report";
      data = courseRows.map((r: any) => ({
        Institution: r.institution_name, Course: r.course_title, Instructor: r.instructor,
        Enrolled: r.enrolled, Completed: r.completed, "In Progress": r.in_progress,
        "Not Started": r.not_started, "Completion %": r.completion_pct,
        Certificates: r.certificates, "Avg Quiz": r.avg_quiz, Revenue: r.revenue,
      }));
    } else if (kind === "student") {
      title = "Student-wise Report";
      data = studentRows.map((s: any) => ({
        "Student Name": s.student_name, "Reg #": s.registration_number,
        Institution: s.institution_name, Program: s.program, "Academic Year": s.academic_year,
        "Courses Enrolled": s.courses_enrolled, "Progress %": s.progress,
        Status: s.completion_status, Certificates: s.certificates,
        "Last Login": s.last_login ? new Date(s.last_login).toLocaleString() : "Never",
        "Enrollment Date": s.enrollment_date ?? "",
      }));
    } else {
      title = "Certificate Report";
      data = certificateRows.map((c: any) => ({
        Student: c.student_name, Course: c.course_name, Institution: c.institution_name,
        "Certificate ID": c.certificate_id,
        "Issue Date": c.issue_date ? new Date(c.issue_date).toLocaleDateString() : "",
        "Completion Date": c.completion_date ? new Date(c.completion_date).toLocaleDateString() : "",
        Status: c.status,
      }));
    }
    const fname = `${kind}-${ts}`;
    if (fmt === "csv") return exportToCsv(data, fname);
    if (fmt === "xlsx") return exportToXlsx(data, fname, title);
    const doc = new jsPDF({ orientation: "landscape" });
    doc.text(title, 14, 15);
    doc.setFontSize(10);
    doc.text(`${format(range.from, "PP")} – ${format(range.to, "PP")}`, 14, 22);
    const headers = data.length ? Object.keys(data[0]) : [];
    autoTable(doc, {
      startY: 28, head: [headers], styles: { fontSize: 8 },
      body: data.map((r) => headers.map((h) => String(r[h] ?? ""))),
    });
    doc.save(`${fname}.pdf`);
  };

  const presetLabel = useMemo(() => {
    if (preset === "custom" && customFrom && customTo) return `${format(customFrom, "MMM d")} – ${format(customTo, "MMM d")}`;
    const labels: Record<Preset, string> = {
      today: "Today", yesterday: "Yesterday", "7d": "Last 7 days", "30d": "Last 30 days",
      this_month: "This month", last_month: "Last month", academic_year: "This academic year", custom: "Custom",
    };
    return labels[preset];
  }, [preset, customFrom, customTo]);

  return (
    <div className="space-y-4 max-w-7xl">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Link to="/app/reports" className="hover:underline inline-flex items-center gap-1">
              <ArrowLeft className="h-3 w-3" /> Back to Reports
            </Link>
          </div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="h-7 w-7 text-primary" /> Institution Analytics
          </h1>
          <p className="text-muted-foreground mt-1">
            Per-institution KPIs, enrollment, completion, certificates and revenue.
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button><Download className="h-4 w-4 mr-1" /> Export</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-popover w-56">
            <DropdownMenuLabel>Summary report</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => exportData("summary", "csv")}>CSV</DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportData("summary", "xlsx")}>Excel</DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportData("summary", "pdf")}>PDF</DropdownMenuItem>
            <DropdownMenuLabel className="mt-1">Course report</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => exportData("course", "csv")}>CSV</DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportData("course", "xlsx")}>Excel</DropdownMenuItem>
            <DropdownMenuLabel className="mt-1">Student report</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => exportData("student", "csv")}>CSV</DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportData("student", "xlsx")}>Excel</DropdownMenuItem>
            <DropdownMenuLabel className="mt-1">Certificate report</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => exportData("certificate", "csv")}>CSV</DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportData("certificate", "xlsx")}>Excel</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Filters */}
      <Card className="p-3 flex flex-wrap items-center gap-2 border-border shadow-none">
        <Select value={preset} onValueChange={(v) => setPreset(v as Preset)}>
          <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="yesterday">Yesterday</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="this_month">This month</SelectItem>
            <SelectItem value="last_month">Last month</SelectItem>
            <SelectItem value="academic_year">This academic year</SelectItem>
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>
        {preset === "custom" && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9">
                <CalendarIcon className="h-4 w-4 mr-1" />
                {customFrom && customTo ? `${format(customFrom, "MMM d")} – ${format(customTo, "MMM d")}` : "Pick range"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-3 bg-popover" align="start">
              <div className="flex gap-3">
                <div><div className="text-xs font-medium mb-1">From</div>
                  <Calendar mode="single" selected={customFrom} onSelect={(d) => setCustomFrom(d ?? undefined)} className="pointer-events-auto" />
                </div>
                <div><div className="text-xs font-medium mb-1">To</div>
                  <Calendar mode="single" selected={customTo} onSelect={(d) => setCustomTo(d ?? undefined)} className="pointer-events-auto" />
                </div>
              </div>
            </PopoverContent>
          </Popover>
        )}
        <Select value={institutionId} onValueChange={setInstitutionId}>
          <SelectTrigger className="w-52 h-9"><SelectValue placeholder="Institution" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All institutions</SelectItem>
            {(institutions ?? []).map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={courseId} onValueChange={setCourseId}>
          <SelectTrigger className="w-48 h-9"><SelectValue placeholder="Course" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All courses</SelectItem>
            {(courseList ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={instructorId} onValueChange={setInstructorId}>
          <SelectTrigger className="w-44 h-9"><SelectValue placeholder="Instructor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All instructors</SelectItem>
            {(instructorProfiles ?? []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-40 h-9"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={academicYear} onValueChange={setAcademicYear}>
          <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Year" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All years</SelectItem>
            {academicYears.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="ml-auto text-xs text-muted-foreground">{presetLabel}</span>
      </Card>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <StatCard label="Registered students" value={totals.students} icon={Users} />
        <StatCard label="Active" value={totals.active} icon={Users} />
        <StatCard label="Inactive" value={totals.inactive} icon={Users} />
        <StatCard label="Enrollments" value={totals.enrollments} icon={GraduationCap} />
        <StatCard label="Unique courses" value={totals.uniqueCourses} icon={GraduationCap} />
        <StatCard label="Revenue" value={fmtMoney(totals.revenue)} icon={Wallet} />
        <StatCard label="Avg completion" value={`${totals.avgCompletion}%`} icon={TrendingUp} />
        <StatCard label="Avg progress" value={`${totals.avgProgress}%`} icon={TrendingUp} />
        <StatCard label="Certificates" value={totals.certificates} icon={Award} />
        <StatCard label="Assignments" value={totals.submissions} icon={FileText} />
        <StatCard label="Quiz attempts" value={totals.attempts} icon={FileText} />
        <StatCard label="Institutions" value={rows.length} icon={Building2} />
      </div>

      {isLoading && <div className="text-sm text-muted-foreground p-4">Loading analytics…</div>}

      <Tabs defaultValue="summary">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="courses">Courses</TabsTrigger>
          <TabsTrigger value="students">Students</TabsTrigger>
          <TabsTrigger value="certificates">Certificates</TabsTrigger>
          <TabsTrigger value="charts">Charts</TabsTrigger>
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
        </TabsList>

        {/* SUMMARY */}
        <TabsContent value="summary" className="mt-4">
          <Card className="border-border shadow-none overflow-x-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow>
                  <TableHead>Institution</TableHead>
                  <TableHead className="text-right">Students</TableHead>
                  <TableHead className="text-right">Active</TableHead>
                  <TableHead className="text-right">Enrollments</TableHead>
                  <TableHead className="text-right">Courses</TableHead>
                  <TableHead className="text-right">Completion</TableHead>
                  <TableHead className="text-right">Certificates</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" /> No institutions yet. Add institutions and link students to them.
                  </TableCell></TableRow>
                ) : rows.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium">{r.name}</div>
                      {r.code && <div className="text-xs text-muted-foreground">{r.code}</div>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{r.total_students}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.active_students}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.total_enrollments}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.unique_courses}</TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-2">
                        <Progress value={r.completion_rate} className="h-1.5 w-16" />
                        <span className="text-xs tabular-nums">{r.completion_rate}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{r.certificates}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{fmtMoney(r.revenue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* COURSES */}
        <TabsContent value="courses" className="mt-4">
          <Card className="border-border shadow-none overflow-x-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow>
                  <TableHead>Institution</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Instructor</TableHead>
                  <TableHead className="text-right">Enrolled</TableHead>
                  <TableHead className="text-right">Completed</TableHead>
                  <TableHead className="text-right">In progress</TableHead>
                  <TableHead className="text-right">Not started</TableHead>
                  <TableHead className="text-right">Completion %</TableHead>
                  <TableHead className="text-right">Certificates</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {courseRows.length === 0 ? (
                  <TableRow><TableCell colSpan={10} className="text-center py-12 text-muted-foreground">No course data.</TableCell></TableRow>
                ) : courseRows.map((r: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs">{r.institution_name}</TableCell>
                    <TableCell className="font-medium">{r.course_title}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.instructor}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.enrolled}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.completed}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.in_progress}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.not_started}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.completion_pct}%</TableCell>
                    <TableCell className="text-right tabular-nums">{r.certificates}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtMoney(r.revenue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* STUDENTS */}
        <TabsContent value="students" className="mt-4">
          <Card className="border-border shadow-none overflow-x-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Reg #</TableHead>
                  <TableHead>Institution</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead className="text-right">Courses</TableHead>
                  <TableHead className="text-right">Progress</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Certs</TableHead>
                  <TableHead>Last login</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {studentRows.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-12 text-muted-foreground">No students mapped to institutions yet.</TableCell></TableRow>
                ) : studentRows.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.student_name}</TableCell>
                    <TableCell className="text-xs">{s.registration_number}</TableCell>
                    <TableCell className="text-xs">{s.institution_name}</TableCell>
                    <TableCell className="text-xs">{s.program}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.courses_enrolled}</TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-2">
                        <Progress value={s.progress} className="h-1.5 w-14" />
                        <span className="text-xs tabular-nums">{s.progress}%</span>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant={s.completion_status === "Completed" ? "default" : "secondary"}>{s.completion_status}</Badge></TableCell>
                    <TableCell className="text-right tabular-nums">{s.certificates}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatRelativeTime(s.last_login)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* CERTIFICATES */}
        <TabsContent value="certificates" className="mt-4">
          <Card className="border-border shadow-none overflow-x-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Institution</TableHead>
                  <TableHead>Certificate ID</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {certificateRows.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">No certificates issued in this period.</TableCell></TableRow>
                ) : certificateRows.map((c: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{c.student_name}</TableCell>
                    <TableCell>{c.course_name}</TableCell>
                    <TableCell className="text-xs">{c.institution_name}</TableCell>
                    <TableCell className="font-mono text-xs">{c.certificate_id}</TableCell>
                    <TableCell className="text-xs">{c.issue_date ? new Date(c.issue_date).toLocaleDateString() : "—"}</TableCell>
                    <TableCell className="text-xs">{c.completion_date ? new Date(c.completion_date).toLocaleDateString() : "—"}</TableCell>
                    <TableCell><Badge variant={c.status === "Active" ? "default" : "secondary"}>{c.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* CHARTS */}
        <TabsContent value="charts" className="mt-4 grid lg:grid-cols-2 gap-3">
          <Card className="p-4 border-border shadow-none">
            <h3 className="font-semibold text-sm mb-3">Course completion by institution</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={completionByInstitutionChart}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" fontSize={11} />
                  <YAxis fontSize={11} domain={[0, 100]} />
                  <RTooltip />
                  <Bar dataKey="completion" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card className="p-4 border-border shadow-none">
            <h3 className="font-semibold text-sm mb-3">Student progress distribution</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={progressDistribution} dataKey="value" nameKey="name" outerRadius={80} label>
                    {progressDistribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Legend />
                  <RTooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card className="p-4 border-border shadow-none">
            <h3 className="font-semibold text-sm mb-3">Certificates issued trend</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={certificatesTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" fontSize={11} />
                  <YAxis fontSize={11} />
                  <RTooltip />
                  <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card className="p-4 border-border shadow-none">
            <h3 className="font-semibold text-sm mb-3">Enrollment growth</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={enrollmentTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" fontSize={11} />
                  <YAxis fontSize={11} />
                  <RTooltip />
                  <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card className="p-4 border-border shadow-none lg:col-span-2">
            <h3 className="font-semibold text-sm mb-3">Revenue trend</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" fontSize={11} />
                  <YAxis fontSize={11} />
                  <RTooltip formatter={(v: any) => fmtMoney(Number(v))} />
                  <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </TabsContent>

        {/* LEADERBOARD */}
        <TabsContent value="leaderboard" className="mt-4 grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { key: "total_students" as const, label: "Top by student count", icon: Users, fmt: (v: any) => v },
            { key: "completion_rate" as const, label: "Top by completion %", icon: TrendingUp, fmt: (v: any) => `${v}%` },
            { key: "certificates" as const, label: "Top by certificates", icon: Award, fmt: (v: any) => v },
            { key: "revenue" as const, label: "Top by revenue", icon: Wallet, fmt: (v: any) => fmtMoney(Number(v)) },
            { key: "avg_quiz" as const, label: "Top by avg quiz score", icon: Trophy, fmt: (v: any) => `${v}%` },
          ].map((board) => {
            const Icon = board.icon;
            const list = leaders(board.key);
            return (
              <Card key={board.key} className="p-4 border-border shadow-none">
                <div className="flex items-center gap-2 mb-3">
                  <Icon className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-sm">{board.label}</h3>
                </div>
                {list.length === 0 ? (
                  <div className="text-xs text-muted-foreground">No data.</div>
                ) : (
                  <ol className="space-y-2">
                    {list.map((r: any, i: number) => (
                      <li key={r.id} className="flex items-center gap-2 text-sm">
                        <span className="w-5 text-xs font-semibold text-muted-foreground">#{i + 1}</span>
                        <span className="flex-1 truncate">{r.name}</span>
                        <span className="tabular-nums text-xs font-medium">{board.fmt(r[board.key])}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </Card>
            );
          })}
        </TabsContent>
      </Tabs>
    </div>
  );
}
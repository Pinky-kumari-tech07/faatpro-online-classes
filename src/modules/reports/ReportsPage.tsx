import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  Users, GraduationCap, FileText, ClipboardList, Video, DollarSign,
  Calendar as CalendarIcon, Download, TrendingUp, Wallet, Hourglass,
} from "lucide-react";
import { useWorkspace } from "@/shared/hooks/useWorkspace";
import { supabase } from "@/integrations/supabase/client";
import { reportService } from "@/services/supabase";
import StatCard from "@/modules/dashboard/components/StatCard";
import { format, subDays, startOfMonth, endOfMonth, startOfDay, endOfDay } from "date-fns";
import { Link } from "react-router-dom";
import { Building2 } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, CartesianGrid,
} from "recharts";
import { exportToCsv, exportToXlsx } from "@/modules/students/exportUtils";
import { getRevenueSummary, revenueByCourse, revenueByDay } from "@/services/supabase/revenueSummaryService";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Preset = "today" | "yesterday" | "7d" | "30d" | "this_month" | "last_month" | "custom";

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
    default: return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) };
  }
}

function StudentsReport({ rows, total }: { rows: any[]; total: number }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((s) => {
      if (statusFilter !== "all" && (s.status ?? "active") !== statusFilter) return false;
      if (!q) return true;
      return (
        (s.name ?? "").toLowerCase().includes(q) ||
        (s.email ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, statusFilter]);

  return (
    <Card className="border-border shadow-none">
      <div className="p-4 flex flex-col sm:flex-row gap-3 sm:items-center justify-between border-b">
        <div className="flex flex-1 gap-2">
          <Input
            placeholder="Search by name or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="invited">Invited</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="text-sm text-muted-foreground">
          Showing {filtered.length} of {total} students
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Student</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Enrolled</TableHead>
            <TableHead>Pending</TableHead>
            <TableHead>Completed</TableHead>
            <TableHead>Quiz pass %</TableHead>
            <TableHead>Registered</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 ? (
            <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No students found</TableCell></TableRow>
          ) : filtered.map((s: any) => (
            <TableRow key={s.id}>
              <TableCell className="font-medium">{s.name}</TableCell>
              <TableCell className="text-muted-foreground">{s.email}</TableCell>
              <TableCell>{s.enrollments}</TableCell>
              <TableCell>{s.pending}</TableCell>
              <TableCell>{s.completed}</TableCell>
              <TableCell>{s.quizPct}%</TableCell>
              <TableCell className="text-muted-foreground">
                {s.registeredAt ? new Date(s.registeredAt).toLocaleDateString("en-GB") : "—"}
              </TableCell>
              <TableCell><Badge variant={s.status === "active" ? "default" : "secondary"}>{s.status}</Badge></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

export default function ReportsPage() {
  const { membership } = useWorkspace();
  const wsId = membership!.workspace.id;

  const [preset, setPreset] = useState<Preset>("30d");
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const [paymentStatus, setPaymentStatus] = useState<string>("all");

  const range = useMemo(() => {
    if (preset === "custom" && customFrom && customTo)
      return { from: startOfDay(customFrom), to: endOfDay(customTo) };
    return presetRange(preset);
  }, [preset, customFrom, customTo]);

  const { data: ov } = useQuery({ queryKey: ["rep-ov", wsId], queryFn: () => reportService.overview(wsId) });
  const { data: cr } = useQuery({ queryKey: ["rep-courses", wsId], queryFn: () => reportService.courses(wsId) });
  const { data: st } = useQuery({ queryKey: ["rep-students", wsId], queryFn: () => reportService.students(wsId) });
  const { data: qz } = useQuery({ queryKey: ["rep-quizzes", wsId], queryFn: () => reportService.quizzes(wsId) });

  const { data: courseList } = useQuery({
    queryKey: ["rep-course-list", wsId],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("id, title").eq("workspace_id", wsId).is("deleted_at", null);
      return data ?? [];
    },
  });

  const { data: revSummary } = useQuery({
    queryKey: ["rep-revenue", wsId, range.from.toISOString(), range.to.toISOString(), courseFilter, paymentStatus],
    // Single source of truth: identical math to the Dashboard, GST reports and exports.
    queryFn: () => getRevenueSummary({ workspaceId: wsId, range, courseId: courseFilter }),
  });

  const { data: enrollSeries } = useQuery({
    queryKey: ["rep-enroll-series", wsId, range.from.toISOString(), range.to.toISOString(), courseFilter],
    queryFn: async () => {
      let q = supabase
        .from("enrollments")
        .select("id, course_id, enrolled_at")
        .eq("workspace_id", wsId)
        .gte("enrolled_at", range.from.toISOString())
        .lte("enrolled_at", range.to.toISOString());
      if (courseFilter !== "all") q = q.eq("course_id", courseFilter);
      const { data } = await q;
      return data ?? [];
    },
  });

  // KPI calculations
  const kpi = useMemo(() => {
    return {
      totalRevenue: revSummary?.gross ?? 0,
      sales: revSummary?.sales ?? 0,
      pending: revSummary?.pending ?? 0,
      pendingCount: revSummary?.pendingCount ?? 0,
      currency: revSummary?.currency ?? "INR",
    };
  }, [revSummary]);

  // Build daily series for charts
  const dailyKey = (d: string) => format(new Date(d), "yyyy-MM-dd");
  const labelKey = (d: string) => format(new Date(d), "MMM d");
  const revenueChart = useMemo(() => {
    if (!revSummary) return [];
    return revenueByDay(revSummary).map((d) => ({ ...d, date: labelKey(d.date) }));
  }, [revSummary]);

  const enrollChart = useMemo(() => {
    const map = new Map<string, { date: string; enrollments: number }>();
    (enrollSeries ?? []).forEach((e: any) => {
      const k = dailyKey(e.enrolled_at);
      const ent = map.get(k) ?? { date: labelKey(e.enrolled_at), enrollments: 0 };
      ent.enrollments += 1;
      map.set(k, ent);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  }, [enrollSeries]);

  const courseRevenueRows = useMemo(
    () => (revSummary ? revenueByCourse(revSummary) : []),
    [revSummary],
  );

  const fmt = (n: number) =>
    new Intl.NumberFormat(undefined, { style: "currency", currency: kpi.currency, maximumFractionDigits: 0 }).format(n);

  // Exporters
  const exportRevenue = (fmtType: "csv" | "xlsx" | "pdf") => {
    const rows = courseRevenueRows.map((r) => ({
      Course: r.title,
      Sales: r.sales,
      Revenue: r.revenue,
    }));
    const filename = `revenue-report-${format(new Date(), "yyyyMMdd-HHmm")}`;
    if (fmtType === "csv") return exportToCsv(rows, filename);
    if (fmtType === "xlsx") return exportToXlsx(rows, filename, "Revenue");
    const doc = new jsPDF();
    doc.text("Revenue Report", 14, 15);
    doc.setFontSize(10);
    doc.text(`${format(range.from, "PP")} – ${format(range.to, "PP")}`, 14, 22);
    autoTable(doc, {
      startY: 28,
      head: [["Course", "Sales", "Revenue"]],
      body: rows.map((r) => [r.Course, String(r.Sales), fmt(r.Revenue)]),
    });
    doc.save(`${filename}.pdf`);
  };

  const presetLabel = useMemo(() => {
    if (preset === "custom" && customFrom && customTo)
      return `${format(customFrom, "MMM d")} – ${format(customTo, "MMM d")}`;
    const labels: Record<Preset, string> = {
      today: "Today", yesterday: "Yesterday", "7d": "Last 7 days", "30d": "Last 30 days",
      this_month: "This month", last_month: "Last month", custom: "Custom",
    };
    return labels[preset];
  }, [preset, customFrom, customTo]);

  return (
    <div className="space-y-6 max-w-7xl">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground mt-1">Analytics across your workspace.</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline"><Download className="h-4 w-4 mr-1" /> Export</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-popover">
            <DropdownMenuLabel>Revenue report</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => exportRevenue("csv")}>CSV</DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportRevenue("xlsx")}>Excel</DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportRevenue("pdf")}>PDF</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Filter bar */}
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
        <Select value={courseFilter} onValueChange={setCourseFilter}>
          <SelectTrigger className="w-48 h-9"><SelectValue placeholder="Course" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All courses</SelectItem>
            {(courseList ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={paymentStatus} onValueChange={setPaymentStatus}>
          <SelectTrigger className="w-40 h-9"><SelectValue placeholder="Payment" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All payments</SelectItem>
            <SelectItem value="succeeded">Succeeded</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">Showing data for {presetLabel}</span>
      </Card>

      {/* KPI cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard label="Total revenue" value={fmt(kpi.totalRevenue)} icon={Wallet} />
        <StatCard label="Total students" value={ov?.activeLearners ?? "—"} icon={Users} />
        <StatCard label="Enrollments" value={enrollSeries?.length ?? 0} icon={TrendingUp} />
        <StatCard label="Course sales" value={kpi.sales} icon={GraduationCap} />
        <StatCard label="Pending payments" value={fmt(kpi.pending)} icon={Hourglass} />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-3">
        <Card className="p-4 border-border shadow-none">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-sm">Revenue trend</h3>
            <span className="text-xs text-muted-foreground">{revenueChart.length} days</span>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueChart}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" fontSize={11} />
                <YAxis fontSize={11} />
                <RTooltip formatter={(v: any) => fmt(Number(v))} />
                <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-4 border-border shadow-none">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-sm">Enrollment trend</h3>
            <span className="text-xs text-muted-foreground">{enrollChart.length} days</span>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={enrollChart}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" fontSize={11} />
                <YAxis fontSize={11} />
                <RTooltip />
                <Bar dataKey="enrollments" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="courses">Courses</TabsTrigger>
          <TabsTrigger value="students">Students</TabsTrigger>
          <TabsTrigger value="quizzes">Quizzes</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <Link to="/app/reports/institutions" className="ml-auto">
            <Button variant="outline" size="sm" className="h-8">
              <Building2 className="h-4 w-4 mr-1" /> Institution Analytics
            </Button>
          </Link>
          <Link to="/app/reports/bundles">
            <Button variant="outline" size="sm" className="h-8">
              Bundles
            </Button>
          </Link>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <StatCard label="Active learners" value={ov?.activeLearners ?? "—"} icon={Users} />
            <StatCard label="Completions" value={ov?.completions ?? "—"} icon={GraduationCap} />
            <StatCard label="Submissions" value={ov?.submissions ?? "—"} icon={FileText} />
            <StatCard label="Quiz average" value={ov ? `${ov.quizAverage}%` : "—"} icon={ClipboardList} />
            <StatCard label="Live classes" value={ov?.liveClasses ?? "—"} icon={Video} />
          </div>
        </TabsContent>

        <TabsContent value="courses" className="mt-4">
          <Card className="border-border shadow-none">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Course</TableHead><TableHead>Enrollments</TableHead>
                <TableHead>Avg progress</TableHead><TableHead>Completions</TableHead>
                <TableHead>Quizzes</TableHead><TableHead>Assignments</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(cr?.rows ?? []).map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.title}</TableCell>
                    <TableCell>{r.enrollments}</TableCell>
                    <TableCell>{r.avgProgress}%</TableCell>
                    <TableCell>{r.completions}</TableCell>
                    <TableCell>{r.quizzes}</TableCell>
                    <TableCell>{r.assignments}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="students" className="mt-4">
          <StudentsReport rows={st?.rows ?? []} total={st?.total ?? 0} />
        </TabsContent>

        <TabsContent value="quizzes" className="mt-4">
          <Card className="border-border shadow-none">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Quiz</TableHead><TableHead>Course</TableHead>
                <TableHead>Attempts</TableHead><TableHead>Average</TableHead><TableHead>Pass rate</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(qz?.rows ?? []).map((q: any) => (
                  <TableRow key={q.id}>
                    <TableCell className="font-medium">{q.title}</TableCell>
                    <TableCell>{q.courseTitle}</TableCell>
                    <TableCell>{q.attempts}</TableCell>
                    <TableCell>{q.average}%</TableCell>
                    <TableCell>{q.passRate}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="revenue" className="mt-4">
          <Card className="border-border shadow-none">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Course</TableHead>
                  <TableHead className="text-right">Sales</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {courseRevenueRows.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center py-12 text-muted-foreground">
                    <DollarSign className="h-8 w-8 mx-auto opacity-50 mb-2" />
                    No revenue in this period.
                  </TableCell></TableRow>
                ) : courseRevenueRows.map((r) => (
                  <TableRow key={r.courseId}>
                    <TableCell className="font-medium">{r.title}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.sales}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{fmt(r.revenue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
import { normalizeMeetingUrl } from "@/lib/meetingUrl";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import {
  BookOpen, Users, GraduationCap, Trophy, FileText, ClipboardCheck,
  Video, IndianRupee, Award, BarChart3, AlertTriangle, CheckCircle2, Clock, ArrowRight, Activity,
} from "lucide-react";
import { LineChart, Line, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, AreaChart, Area } from "recharts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspace } from "@/shared/hooks/useWorkspace";
import { dashboardService, type DateRange } from "@/services/supabase/dashboardService";
import KpiCard from "../components/KpiCard";
import ActivityFeed from "../components/ActivityFeed";
import { formatDistanceToNow } from "date-fns";

const RANGE_LABELS: Record<DateRange, string> = { today: "Today", "7d": "Last 7 days", "30d": "Last 30 days", "90d": "Last 90 days" };

function formatMoney(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 }).format(n);
}

export default function AdminDashboard() {
  const { membership } = useWorkspace();
  const nav = useNavigate();
  const wsId = membership!.workspace.id;
  const [range, setRange] = useState<DateRange>("30d");

  const stats = useQuery({
    queryKey: ["admin-dash-stats", wsId, range],
    queryFn: () => dashboardService.getAdminDashboardStats(wsId, range),
  });
  const enrollTrend = useQuery({
    queryKey: ["enroll-trend", wsId, range],
    queryFn: () => dashboardService.getEnrollmentTrend(wsId, range),
  });
  const revenueTrend = useQuery({
    queryKey: ["revenue-trend", wsId, range],
    queryFn: () => dashboardService.getRevenueTrend(wsId, range),
  });
  const coursePerf = useQuery({
    queryKey: ["course-perf", wsId],
    queryFn: () => dashboardService.getCoursePerformance(wsId, 5),
  });
  const engagement = useQuery({
    queryKey: ["student-engagement", wsId],
    queryFn: () => dashboardService.getStudentEngagement(wsId, 5),
  });
  const ops = useQuery({
    queryKey: ["today-ops", wsId],
    queryFn: () => dashboardService.getTodayOperations(wsId),
  });

  const s = stats.data;

  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* Header */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Dashboard
            </h1>
            <Badge variant="secondary" className="bg-success/10 text-success border-success/20 gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-success" /> Active
            </Badge>
          </div>
          <p className="text-muted-foreground">
            Monitor learning activity, revenue, course progress, and student engagement.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={range} onValueChange={(v) => setRange(v as DateRange)}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(RANGE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </header>

      {/* KPI Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.isLoading ? Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />) : (
          <>
            <KpiCard label="Total Courses" value={s?.coursesCount ?? 0} icon={BookOpen}
              hint={s?.coursesNewThisMonth ? `+${s.coursesNewThisMonth} this month` : "View catalogue"}
              trend={s?.coursesNewThisMonth ? { value: s.coursesNewThisMonth, direction: "up" } : undefined}
              to="/app/courses" />
            <KpiCard label="Active Students" value={s?.activeStudents ?? 0} icon={Users}
              hint="Workspace members" to="/app/students" accent="accent" />
            <KpiCard label="Enrollments" value={s?.enrollmentsTotal ?? 0} icon={GraduationCap}
              hint={`+${s?.enrollmentsRange ?? 0} in ${RANGE_LABELS[range].toLowerCase()}`}
              trend={(s?.enrollmentsRange ?? 0) > 0 ? { value: s!.enrollmentsRange, direction: "up" } : undefined}
              to="/app/students" />
            <KpiCard label="Completion Rate" value={`${s?.completionRate ?? 0}%`} icon={Trophy}
              hint="Across all enrollments" to="/app/reports" accent="success" />
            <KpiCard label="Assignment Submissions" value={s?.submissionsRange ?? 0} icon={FileText}
              hint={s?.pendingGrading ? `${s.pendingGrading} pending grading` : "All graded"}
              to="/app/assignments" />
            <KpiCard label="Quiz Average" value={`${s?.quizAvg ?? 0}%`} icon={ClipboardCheck}
              hint="Across attempts in range" to="/app/quizzes" accent="accent" />
            <KpiCard label="Live Classes" value={s?.liveClassesTotal ?? 0} icon={Video}
              hint={`${s?.liveUpcoming ?? 0} upcoming`} to="/app/live-classes" />
            <KpiCard label="Revenue" value={formatMoney(s?.revenueRange ?? 0)} icon={IndianRupee}
              hint={(s?.offlinePending ?? 0) > 0 ? `${s?.offlinePending} offline approval pending` : s?.paymentsConfigured ? "Payments configured" : "Setup pending"}
              to="/app/payments" accent={s?.paymentsConfigured ? "success" : "warning"} />
          </>
        )}
      </div>

      {/* Analytics charts */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="p-5 border-border shadow-none lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">Enrollment trend</h3>
              <p className="text-xs text-muted-foreground">New enrollments — {RANGE_LABELS[range]}</p>
            </div>
            <Badge variant="outline">{enrollTrend.data?.reduce((s, b) => s + b.enrollments, 0) ?? 0} total</Badge>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={enrollTrend.data ?? []}>
                <defs>
                  <linearGradient id="enrFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))" }} />
                <Area type="monotone" dataKey="enrollments" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#enrFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5 border-border shadow-none">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">Revenue</h3>
              <p className="text-xs text-muted-foreground">{RANGE_LABELS[range]}</p>
            </div>
            <span className="text-lg font-bold">{formatMoney(s?.revenueRange ?? 0)}</span>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueTrend.data ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))" }} />
                <Bar dataKey="revenue" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Today's Operations */}
      <Card className="p-5 border-border shadow-none">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold flex items-center gap-2"><Activity className="h-4 w-4 text-primary" /> Today's operations</h3>
            <p className="text-xs text-muted-foreground">Live sessions, pending grading, recent attempts and enrollments.</p>
          </div>
        </div>
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          <OpsBlock title="Live today" emptyText="No sessions scheduled for today." items={
            (ops.data?.liveToday ?? []).map((l: any) => ({
              key: l.id, label: l.title, sub: new Date(l.starts_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              action: l.meeting_url ? { label: "Join", href: normalizeMeetingUrl(l.meeting_url), external: true } : { label: "Manage", to: "/app/live-classes" },
            }))
          } />
          <OpsBlock title="Assignments due soon" emptyText="Nothing due in the next 7 days." items={
            (ops.data?.dueAssignments ?? []).map((a: any) => ({
              key: a.id, label: a.title,
              sub: a.due_at ? `Due ${formatDistanceToNow(new Date(a.due_at), { addSuffix: true })}` : "No deadline",
              action: { label: "Review", to: "/app/assignments" },
            }))
          } />
          <OpsBlock title="Pending grading" emptyText="All submissions graded." items={
            (ops.data?.pendingSubmissions ?? []).map((s: any) => ({
              key: s.id, label: s.assignments?.title ?? "Assignment",
              sub: `${s.profiles?.full_name ?? "Student"} • ${formatDistanceToNow(new Date(s.submitted_at), { addSuffix: true })}`,
              action: { label: "Grade", to: "/app/assignments" },
            }))
          } />
          <OpsBlock title="Recent quiz attempts" emptyText="No attempts yet." items={
            (ops.data?.recentAttempts ?? []).map((q: any) => ({
              key: q.id, label: q.quizzes?.title ?? "Quiz",
              sub: `${q.profiles?.full_name ?? "Student"} • ${q.score}/${q.max_score}`,
              action: { label: "Review", to: "/app/quizzes" },
            }))
          } />
          <OpsBlock title="New enrollments" emptyText="No new enrollments." items={
            (ops.data?.newEnrollments ?? []).map((e: any) => ({
              key: e.id, label: e.profiles?.full_name ?? "Student",
              sub: `${e.courses?.title ?? "Course"} • ${formatDistanceToNow(new Date(e.enrolled_at), { addSuffix: true })}`,
              action: { label: "View student", to: "/app/students" },
            }))
          } />
        </div>
      </Card>

      {/* Tables */}
      <div className="grid xl:grid-cols-2 gap-4">
        <Card className="border-border shadow-none">
          <div className="p-5 flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Course performance</h3>
              <p className="text-xs text-muted-foreground">Top courses by recent activity.</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => nav("/app/courses")} className="gap-1">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Course</TableHead>
                <TableHead>Enrolls</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Quiz</TableHead>
                <TableHead>Revenue</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(coursePerf.data ?? []).length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">No courses yet. Create your first course to get started.</TableCell></TableRow>
              ) : coursePerf.data!.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="font-medium text-sm">{c.title}</div>
                    <div className="text-xs text-muted-foreground">{c.instructor} • {c.status}</div>
                  </TableCell>
                  <TableCell className="text-sm">{c.enrollments}</TableCell>
                  <TableCell className="min-w-[100px]">
                    <div className="flex items-center gap-2">
                      <Progress value={c.avgProgress} className="h-1.5 w-16" />
                      <span className="text-xs">{c.avgProgress}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{c.quizAvg}%</TableCell>
                  <TableCell className="text-sm">{formatMoney(c.revenue)}</TableCell>
                  <TableCell>
                    <Button asChild variant="ghost" size="sm"><Link to={`/app/courses/${c.id}`}>Manage</Link></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        <Card className="border-border shadow-none">
          <div className="p-5 flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Student engagement</h3>
              <p className="text-xs text-muted-foreground">Students needing attention surface first.</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => nav("/app/students")} className="gap-1">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Pending</TableHead>
                <TableHead>Quiz</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(engagement.data ?? []).length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">No students yet.</TableCell></TableRow>
              ) : engagement.data!.map((st) => (
                <TableRow key={st.id}>
                  <TableCell>
                    <div className="font-medium text-sm">{st.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {st.enrolled} {st.enrolled === 1 ? "course" : "courses"}
                      {st.lastActive && ` • ${formatDistanceToNow(new Date(st.lastActive), { addSuffix: true })}`}
                    </div>
                  </TableCell>
                  <TableCell className="min-w-[100px]">
                    <div className="flex items-center gap-2">
                      <Progress value={st.avgProgress} className="h-1.5 w-16" />
                      <span className="text-xs">{st.avgProgress}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{st.pending}</TableCell>
                  <TableCell className="text-sm">{st.quizAvg}%</TableCell>
                  <TableCell><RiskBadge risk={st.risk} /></TableCell>
                  <TableCell>
                    <Button asChild variant="ghost" size="sm"><Link to="/app/students">View</Link></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Activity feed */}
      <Card className="p-5 border-border shadow-none">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Recent activity</h3>
          <span className="text-xs text-muted-foreground">Across all courses</span>
        </div>
        <ActivityFeed />
      </Card>
    </div>
  );
}

function RiskBadge({ risk }: { risk: "on_track" | "needs_attention" | "inactive" }) {
  if (risk === "on_track") return <Badge variant="secondary" className="bg-success/10 text-success border-success/20 gap-1"><CheckCircle2 className="h-3 w-3" /> On track</Badge>;
  if (risk === "needs_attention") return <Badge variant="secondary" className="bg-warning/10 text-warning border-warning/20 gap-1"><AlertTriangle className="h-3 w-3" /> Attention</Badge>;
  return <Badge variant="secondary" className="bg-muted text-muted-foreground gap-1"><Clock className="h-3 w-3" /> Inactive</Badge>;
}

function QuickAction({ icon: Icon, label, to }: { icon: any; label: string; to: string }) {
  return (
    <Link to={to} className="group flex flex-col items-start gap-2 p-3 rounded-lg border border-border hover:border-primary/40 hover:bg-primary-soft/40 transition-colors">
      <div className="h-8 w-8 rounded-lg bg-primary-soft text-primary grid place-items-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
        <Icon className="h-4 w-4" />
      </div>
      <span className="text-xs font-medium leading-tight">{label}</span>
    </Link>
  );
}

type OpsItem = { key: string; label: string; sub?: string; action: { label: string; to?: string; href?: string; external?: boolean } };
function OpsBlock({ title, items, emptyText }: { title: string; items: OpsItem[]; emptyText: string }) {
  return (
    <div className="rounded-lg border border-border p-4 bg-surface-muted/40">
      <div className="text-sm font-semibold mb-3">{title}</div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((i) => (
            <li key={i.key} className="flex items-start justify-between gap-2 text-sm">
              <div className="min-w-0">
                <div className="font-medium truncate">{i.label}</div>
                {i.sub && <div className="text-xs text-muted-foreground truncate">{i.sub}</div>}
              </div>
              {i.action.external && i.action.href ? (
                <a href={i.action.href} target="_blank" rel="noreferrer" className="text-xs font-medium text-primary hover:underline whitespace-nowrap">{i.action.label}</a>
              ) : (
                <Link to={i.action.to ?? "#"} className="text-xs font-medium text-primary hover:underline whitespace-nowrap">{i.action.label}</Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
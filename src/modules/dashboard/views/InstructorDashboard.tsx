import { normalizeMeetingUrl } from "@/lib/meetingUrl";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { BookOpen, FileText, Users, ClipboardCheck, Video, Plus, GraduationCap, ShieldCheck, ArrowRight } from "lucide-react";
import { AreaChart, Area, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspace } from "@/shared/hooks/useWorkspace";
import { useAuth } from "@/shared/hooks/useAuth";
import { dashboardService, type DateRange } from "@/services/supabase/dashboardService";
import { instructorProfileService } from "@/services/supabase";
import KpiCard from "../components/KpiCard";
import ActivityFeed from "../components/ActivityFeed";

const RANGE_LABELS: Record<DateRange, string> = { today: "Today", "7d": "Last 7 days", "30d": "Last 30 days", "90d": "Last 90 days" };

export default function InstructorDashboard() {
  const { membership } = useWorkspace();
  const { user } = useAuth();
  const nav = useNavigate();
  const wsId = membership!.workspace.id;
  const [range, setRange] = useState<DateRange>("30d");

  const stats = useQuery({
    queryKey: ["instr-dash", wsId, user?.id, range],
    queryFn: () => dashboardService.getInstructorDashboardStats(wsId, user!.id, range),
    enabled: !!user,
  });
  const trend = useQuery({
    queryKey: ["instr-enroll-trend", wsId, range],
    queryFn: () => dashboardService.getEnrollmentTrend(wsId, range),
  });
  const ops = useQuery({
    queryKey: ["instr-ops", wsId],
    queryFn: () => dashboardService.getTodayOperations(wsId),
  });

  const verif = useQuery({
    queryKey: ["instr-verification-banner", user?.id],
    enabled: !!user?.id,
    queryFn: () => instructorProfileService.getMine(user!.id),
  });
  const vStatus = verif.data?.verification_status;
  const vSubmitted = !!verif.data?.submitted_at;
  const showBanner =
    !verif.isLoading &&
    (!vSubmitted || vStatus === "rejected" || vStatus === "resubmission_required");
  const bannerCopy =
    !vSubmitted
      ? { title: "Complete your Instructor Verification", body: "Add your qualifications, ID and bank details, then submit for admin review." }
      : vStatus === "resubmission_required"
        ? { title: "Verification needs changes", body: verif.data?.verification_notes || "Please update the requested details and resubmit." }
        : { title: "Verification was rejected", body: verif.data?.verification_notes || "Update your details and resubmit for another review." };

  const s = stats.data;

  return (
    <div className="space-y-6 max-w-[1400px]">
      {showBanner && (
        <Card className="p-4 border-primary/30 bg-primary-soft/40 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">{bannerCopy.title}</p>
            <p className="text-xs text-muted-foreground line-clamp-2">{bannerCopy.body}</p>
          </div>
          <Button size="sm" onClick={() => nav("/app/instructor/verification")} className="whitespace-nowrap">
            Complete verification <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </Card>
      )}

      <header className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Instructor dashboard</h1>
          <p className="text-muted-foreground">Your assigned courses, students, and pending work.</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={range} onValueChange={(v) => setRange(v as DateRange)}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(RANGE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={() => nav("/app/lessons")}><Plus className="h-4 w-4 mr-1" /> Add lesson</Button>
        </div>
      </header>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.isLoading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />) : (
          <>
            <KpiCard label="Assigned courses" value={s?.courses.length ?? 0} icon={BookOpen} to="/app/courses" />
            <KpiCard label="Active students" value={s?.activeStudents ?? 0} icon={Users} to="/app/students" accent="accent" />
            <KpiCard label="Pending submissions" value={s?.pendingSubmissions ?? 0} icon={FileText}
              hint={s?.pendingSubmissions ? "Action needed" : "All caught up"} to="/app/assignments"
              accent={s?.pendingSubmissions ? "warning" : "success"} />
            <KpiCard label="Quiz average" value={`${s?.quizAvg ?? 0}%`} icon={ClipboardCheck} to="/app/quizzes" />
          </>
        )}
      </div>

      <div className="grid gap-4">
        <Card className="p-5 border-border shadow-none">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Enrollment activity</h3>
            <Badge variant="outline">{s?.enrollmentsRange ?? 0} in {RANGE_LABELS[range].toLowerCase()}</Badge>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend.data ?? []}>
                <defs>
                  <linearGradient id="iFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))" }} />
                <Area type="monotone" dataKey="enrollments" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#iFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="p-5 border-border shadow-none">
        <h3 className="font-semibold mb-4">Today's operations</h3>
        <div className="grid md:grid-cols-3 gap-4">
          <OpsList title="Live today" empty="No sessions today." items={(ops.data?.liveToday ?? []).map((l: any) => ({
            id: l.id, label: l.title, sub: new Date(l.starts_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            cta: { label: l.meeting_url ? "Join" : "Manage", href: l.meeting_url ? normalizeMeetingUrl(l.meeting_url) : undefined, to: "/app/live-classes" },
          }))} />
          <OpsList title="To grade" empty="All graded." items={(ops.data?.pendingSubmissions ?? []).map((s: any) => ({
            id: s.id, label: s.assignments?.title ?? "Assignment", sub: s.profiles?.full_name, cta: { label: "Grade", to: "/app/assignments" },
          }))} />
          <OpsList title="Recent attempts" empty="No attempts yet." items={(ops.data?.recentAttempts ?? []).map((a: any) => ({
            id: a.id, label: a.quizzes?.title ?? "Quiz", sub: `${a.profiles?.full_name ?? "Student"} • ${a.score}/${a.max_score}`,
            cta: { label: "Review", to: "/app/quizzes" },
          }))} />
        </div>
      </Card>

      <Card className="p-5 border-border shadow-none">
        <h3 className="font-semibold mb-3">My courses</h3>
        {(s?.courses ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No courses assigned yet.</p>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {(s?.courses ?? []).map((c: any) => (
              <Link key={c.id} to={`/app/courses/${c.id}`} className="block p-4 rounded-lg border border-border hover:border-primary/40 hover:bg-primary-soft/40 transition-colors">
                <BookOpen className="h-4 w-4 text-primary mb-2" />
                <div className="font-medium text-sm">{c.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Manage course →</div>
              </Link>
            ))}
          </div>
        )}
      </Card>

    </div>
  );
}

function ActionLink({ icon: Icon, label, to }: { icon: any; label: string; to: string }) {
  return (
    <Link to={to} className="group flex flex-col items-start gap-2 p-3 rounded-lg border border-border hover:border-primary/40 hover:bg-primary-soft/40 transition-colors">
      <div className="h-8 w-8 rounded-lg bg-primary-soft text-primary grid place-items-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
        <Icon className="h-4 w-4" />
      </div>
      <span className="text-xs font-medium leading-tight">{label}</span>
    </Link>
  );
}

function OpsList({ title, items, empty }: { title: string; empty: string; items: { id: string; label: string; sub?: string; cta: { label: string; to?: string; href?: string } }[] }) {
  return (
    <div className="rounded-lg border border-border p-4 bg-surface-muted/40">
      <div className="text-sm font-semibold mb-3">{title}</div>
      {items.length === 0 ? <p className="text-xs text-muted-foreground">{empty}</p> : (
        <ul className="space-y-2">
          {items.map((i) => (
            <li key={i.id} className="flex items-start justify-between gap-2 text-sm">
              <div className="min-w-0">
                <div className="font-medium truncate">{i.label}</div>
                {i.sub && <div className="text-xs text-muted-foreground truncate">{i.sub}</div>}
              </div>
              {i.cta.href ? (
                <a href={i.cta.href} target="_blank" rel="noreferrer" className="text-xs font-medium text-primary hover:underline whitespace-nowrap">{i.cta.label}</a>
              ) : (
                <Link to={i.cta.to ?? "#"} className="text-xs font-medium text-primary hover:underline whitespace-nowrap">{i.cta.label}</Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
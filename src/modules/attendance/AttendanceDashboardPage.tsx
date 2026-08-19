import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CalendarCheck, ClipboardList, Lock, Percent, UserCheck, UserX, Clock, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/shared/hooks/useWorkspace";
import PageHeader from "@/modules/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { STATUS_STYLE, fmtDateTime, type AttStatus } from "./attendanceService";

function Kpi({ icon: Icon, label, value, hint, tone = "text-primary" }: any) {
  return (
    <Card className="p-4 border-border shadow-none">
      <div className="flex items-center gap-3">
        <div className={`h-10 w-10 rounded-lg bg-muted flex items-center justify-center ${tone}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground truncate">{label}</div>
          <div className="text-2xl font-semibold leading-tight">{value}</div>
          {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
        </div>
      </div>
    </Card>
  );
}

export default function AttendanceDashboardPage() {
  const { membership } = useWorkspace();
  const wsId = membership!.workspace.id;

  const { data } = useQuery({
    queryKey: ["att-dashboard", wsId],
    queryFn: async () => {
      const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
      const [{ data: sessions }, { data: records }, { data: batches }] = await Promise.all([
        supabase.from("attendance_sessions")
          .select("id,title,session_date,status,submitted_at,course_id,batch_id,attendance_type,courses:course_id(title),batches:batch_id(name)")
          .eq("workspace_id", wsId)
          .order("session_date", { ascending: false })
          .limit(200),
        supabase.from("attendance_records")
          .select("status,marked_at,session_id")
          .eq("workspace_id", wsId)
          .gte("marked_at", startOfDay.toISOString()),
        supabase.from("batches").select("id,status").eq("workspace_id", wsId).eq("status", "active"),
      ]);
      return { sessions: sessions ?? [], records: records ?? [], activeBatches: batches?.length ?? 0 };
    },
  });

  const stats = useMemo(() => {
    const records = data?.records ?? [];
    const counts: Record<AttStatus, number> = { present: 0, absent: 0, late: 0, excused: 0 };
    records.forEach((r: any) => { counts[r.status as AttStatus] = (counts[r.status as AttStatus] ?? 0) + 1; });
    const total = counts.present + counts.absent + counts.late + counts.excused;
    const avg = total ? Math.round(((counts.present + counts.late) / total) * 100) : 0;
    const pending = (data?.sessions ?? []).filter((s: any) => s.status === "draft").length;
    return { counts, total, avg, pending };
  }, [data]);

  const recent = (data?.sessions ?? []).slice(0, 8);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance"
        description="Live overview of attendance activity across your workspace."
        actions={
          <Button asChild><Link to="/app/attendance/mark"><ClipboardList className="h-4 w-4 mr-1.5" />Mark attendance</Link></Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-3">
        <Kpi icon={UserCheck} label="Present today"  value={stats.counts.present} tone="text-emerald-600" />
        <Kpi icon={UserX}     label="Absent today"   value={stats.counts.absent}  tone="text-rose-600" />
        <Kpi icon={Clock}     label="Late today"     value={stats.counts.late}    tone="text-amber-600" />
        <Kpi icon={CalendarCheck} label="Excused today" value={stats.counts.excused} tone="text-sky-600" />
        <Kpi icon={Percent}   label="Avg attendance today" value={`${stats.avg}%`} hint={`${stats.total} students marked`} />
        <Kpi icon={ClipboardList} label="Pending sessions" value={stats.pending} hint="Not yet submitted" tone="text-amber-600" />
        <Kpi icon={TrendingUp} label="Active batches"  value={data?.activeBatches ?? 0} />
        <Kpi icon={Lock} label="Students marked today" value={stats.total} />
      </div>

      <Card className="border-border shadow-none">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Recent sessions</h3>
            <p className="text-xs text-muted-foreground">Latest attendance activity in this workspace.</p>
          </div>
          <Button asChild variant="outline" size="sm"><Link to="/app/attendance/history">View history</Link></Button>
        </div>
        <div className="divide-y divide-border">
          {recent.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No sessions yet. Start by <Link to="/app/attendance/mark" className="text-primary underline">marking attendance</Link>.
            </div>
          )}
          {recent.map((s: any) => (
            <div key={s.id} className="p-4 flex items-center gap-4 hover:bg-muted/40">
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{s.title}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {s.batches?.name ?? "—"} · {s.courses?.title ?? "—"} · {fmtDateTime(s.session_date)}
                </div>
              </div>
              <Badge variant="outline" className="text-[10px] uppercase tracking-wide">{s.attendance_type?.replace("_", " ")}</Badge>
              <Badge className={s.status === "locked" ? "bg-muted text-muted-foreground" : s.status === "submitted" ? STATUS_STYLE.present.tone : "bg-amber-50 text-amber-700 border-amber-200"}>
                {s.status}
              </Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
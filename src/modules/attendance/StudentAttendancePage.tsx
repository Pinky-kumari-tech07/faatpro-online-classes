import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/shared/hooks/useAuth";
import PageHeader from "@/modules/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { STATUS_STYLE, fmtDate, type AttStatus } from "./attendanceService";

export default function StudentAttendancePage() {
  const { user } = useAuth();

  const { data } = useQuery({
    queryKey: ["student-attendance", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: records } = await supabase.from("attendance_records")
        .select("id,status,marked_at,notes,session_id,attendance_sessions:session_id(id,title,session_date,attendance_type,courses:course_id(title),batches:batch_id(name))")
        .eq("student_id", user!.id)
        .order("marked_at", { ascending: false })
        .limit(300);
      return records ?? [];
    },
  });

  const stats = useMemo(() => {
    const counts: Record<AttStatus, number> = { present: 0, absent: 0, late: 0, excused: 0 };
    (data ?? []).forEach((r: any) => { counts[r.status as AttStatus] = (counts[r.status as AttStatus] ?? 0) + 1; });
    const total = counts.present + counts.absent + counts.late + counts.excused;
    const pct = total ? Math.round(((counts.present + counts.late) / total) * 100) : 0;
    return { counts, total, pct };
  }, [data]);

  return (
    <div className="space-y-6">
      <PageHeader title="My attendance" description="Your attendance history across all enrolled batches and courses." />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="p-4 border-border shadow-none">
          <div className="text-xs text-muted-foreground">Overall</div>
          <div className="text-2xl font-semibold">{stats.pct}%</div>
          <div className="text-[11px] text-muted-foreground">{stats.total} session(s)</div>
        </Card>
        {(["present","absent","late","excused"] as AttStatus[]).map((s) => (
          <Card key={s} className="p-4 border-border shadow-none">
            <div className="text-xs text-muted-foreground">{STATUS_STYLE[s].label}</div>
            <div className="text-2xl font-semibold">{stats.counts[s]}</div>
          </Card>
        ))}
      </div>

      <Card className="border-border shadow-none">
        <div className="p-4 border-b border-border">
          <div className="font-semibold">Recent sessions</div>
          <p className="text-xs text-muted-foreground">Your latest attendance entries.</p>
        </div>
        <div className="divide-y divide-border">
          {(data ?? []).length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">No attendance recorded yet.</div>}
          {(data ?? []).map((r: any) => {
            const s = r.attendance_sessions;
            const style = STATUS_STYLE[r.status as AttStatus];
            return (
              <div key={r.id} className="p-4 flex items-center gap-4">
                <div className={`h-2.5 w-2.5 rounded-full ${style.dot}`} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{s?.title ?? "Session"}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {s?.batches?.name ?? "—"} · {s?.courses?.title ?? "—"} · {fmtDate(s?.session_date)}
                  </div>
                </div>
                <Badge className={style.tone}>{style.label}</Badge>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
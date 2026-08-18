import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/shared/hooks/useWorkspace";
import PageHeader from "@/modules/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { listWorkspaceBatches, STATUS_STYLE, type AttStatus } from "./attendanceService";

export default function AttendanceReportsPage() {
  const { membership } = useWorkspace();
  const wsId = membership!.workspace.id;
  const [batchId, setBatchId] = useState<string>("all");
  const [from, setFrom] = useState<string>(new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10));
  const [to, setTo] = useState<string>(new Date().toISOString().slice(0, 10));

  const { data: batches } = useQuery({ queryKey: ["att-batches", wsId], queryFn: () => listWorkspaceBatches(wsId) });

  const { data } = useQuery({
    queryKey: ["att-report", wsId, batchId, from, to],
    queryFn: async () => {
      let sessQuery = supabase.from("attendance_sessions")
        .select("id,batch_id,course_id,session_date,batches:batch_id(name),courses:course_id(title)")
        .eq("workspace_id", wsId)
        .gte("session_date", `${from}T00:00:00`)
        .lte("session_date", `${to}T23:59:59`);
      if (batchId !== "all") sessQuery = sessQuery.eq("batch_id", batchId);
      const { data: sessions } = await sessQuery;
      const ids = (sessions ?? []).map((s: any) => s.id);
      if (ids.length === 0) return { sessions: [], records: [] };
      const { data: records } = await supabase.from("attendance_records")
        .select("session_id,student_id,status")
        .in("session_id", ids);
      return { sessions: sessions ?? [], records: records ?? [] };
    },
  });

  const summary = useMemo(() => {
    const counts: Record<AttStatus, number> = { present: 0, absent: 0, late: 0, excused: 0 };
    (data?.records ?? []).forEach((r: any) => { counts[r.status as AttStatus] = (counts[r.status as AttStatus] ?? 0) + 1; });
    const total = counts.present + counts.absent + counts.late + counts.excused;
    const attendancePct = total ? Math.round(((counts.present + counts.late) / total) * 100) : 0;
    return { counts, total, attendancePct, sessionCount: (data?.sessions ?? []).length };
  }, [data]);

  const perBatch = useMemo(() => {
    const map = new Map<string, { name: string; present: number; total: number }>();
    (data?.sessions ?? []).forEach((s: any) => {
      const rs = (data?.records ?? []).filter((r: any) => r.session_id === s.id);
      const cur = map.get(s.batch_id) ?? { name: s.batches?.name ?? "—", present: 0, total: 0 };
      cur.total += rs.length;
      cur.present += rs.filter((r: any) => r.status === "present" || r.status === "late").length;
      map.set(s.batch_id, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [data]);

  const exportCsv = () => {
    const header = "Batch,Sessions marked,Attendance %\n";
    const body = perBatch.map((r) => `"${r.name}",${r.total},${r.total ? Math.round((r.present / r.total) * 100) : 0}`).join("\n");
    const blob = new Blob([header + body], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = `attendance-report-${from}_${to}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Attendance reports" description="Aggregate insights across batches, courses, and status."
        actions={<Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-1.5" />Export CSV</Button>} />

      <Card className="p-3 border-border shadow-none flex flex-col md:flex-row gap-2">
        <Select value={batchId} onValueChange={setBatchId}>
          <SelectTrigger className="md:w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All batches</SelectItem>
            {(batches ?? []).map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="md:w-44" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="md:w-44" />
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(["present","absent","late","excused"] as AttStatus[]).map((s) => (
          <Card key={s} className="p-4 border-border shadow-none">
            <div className="text-xs text-muted-foreground">{STATUS_STYLE[s].label}</div>
            <div className="text-2xl font-semibold mt-1">{summary.counts[s]}</div>
          </Card>
        ))}
      </div>

      <Card className="p-4 border-border shadow-none">
        <div className="flex items-baseline justify-between mb-3">
          <div>
            <div className="font-semibold">Overall attendance</div>
            <div className="text-xs text-muted-foreground">{summary.sessionCount} session(s) · {summary.total} records</div>
          </div>
          <div className="text-3xl font-semibold">{summary.attendancePct}%</div>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500" style={{ width: `${summary.attendancePct}%` }} />
        </div>
      </Card>

      <Card className="border-border shadow-none overflow-hidden">
        <div className="p-4 border-b border-border">
          <div className="font-semibold">By batch</div>
          <div className="text-xs text-muted-foreground">Attendance percentage per batch in the selected range.</div>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground uppercase">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Batch</th>
              <th className="text-left px-4 py-2 font-medium">Records</th>
              <th className="text-left px-4 py-2 font-medium w-1/2">Attendance %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {perBatch.length === 0 && <tr><td colSpan={3} className="text-center text-muted-foreground p-8">No data in this range.</td></tr>}
            {perBatch.map((r, i) => {
              const pct = r.total ? Math.round((r.present / r.total) * 100) : 0;
              return (
                <tr key={i}>
                  <td className="px-4 py-2 font-medium">{r.name}</td>
                  <td className="px-4 py-2">{r.total}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-3">
                      <div className="h-2 flex-1 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs tabular-nums w-10 text-right">{pct}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
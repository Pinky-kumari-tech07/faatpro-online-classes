import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Lock, Filter, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/shared/hooks/useWorkspace";
import PageHeader from "@/modules/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ATT_TYPE_LABELS, fmtDateTime, type AttType, listWorkspaceBatches, loadOrCreateSettings, isLockedClient } from "./attendanceService";

export default function AttendanceHistoryPage() {
  const { membership } = useWorkspace();
  const wsId = membership!.workspace.id;
  const [q, setQ] = useState("");
  const [batchId, setBatchId] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");

  const { data: batches } = useQuery({ queryKey: ["att-batches", wsId], queryFn: () => listWorkspaceBatches(wsId) });
  const { data: settings } = useQuery({ queryKey: ["att-settings", wsId], queryFn: () => loadOrCreateSettings(wsId) });

  const { data: rows } = useQuery({
    queryKey: ["att-history", wsId, batchId, status],
    queryFn: async () => {
      let query = supabase.from("attendance_sessions")
        .select("id,title,session_date,attendance_type,status,submitted_at,batch_id,course_id,batches:batch_id(name),courses:course_id(title)")
        .eq("workspace_id", wsId)
        .order("session_date", { ascending: false })
        .limit(300);
      if (batchId !== "all") query = query.eq("batch_id", batchId);
      if (status !== "all") query = query.eq("status", status as "draft" | "submitted" | "locked");
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const lockHours = settings?.attendance_lock_hours ?? 24;

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows ?? [];
    return (rows ?? []).filter((r: any) =>
      [r.title, r.batches?.name, r.courses?.title].some((v) => v?.toLowerCase().includes(term))
    );
  }, [rows, q]);

  const exportCsv = () => {
    const header = "Session,Batch,Course,Type,Date,Status\n";
    const body = filtered.map((r: any) => [r.title, r.batches?.name ?? "", r.courses?.title ?? "", r.attendance_type, r.session_date, r.status].map((v) => `"${(v ?? "").toString().replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([header + body], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = `attendance-history-${Date.now()}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Attendance history" description="Every submitted or locked session in this workspace."
        actions={<Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-1.5" />Export CSV</Button>} />

      <Card className="p-3 border-border shadow-none flex flex-col md:flex-row gap-2 items-stretch md:items-center">
        <div className="flex items-center gap-2 md:flex-1">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search title, batch or course…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={batchId} onValueChange={setBatchId}>
          <SelectTrigger className="md:w-56"><SelectValue placeholder="All batches" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All batches</SelectItem>
            {(batches ?? []).map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="md:w-40"><SelectValue placeholder="All status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="submitted">Submitted</SelectItem>
            <SelectItem value="locked">Locked</SelectItem>
          </SelectContent>
        </Select>
      </Card>

      <Card className="border-border shadow-none overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground uppercase">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Session</th>
                <th className="text-left px-4 py-2 font-medium">Batch</th>
                <th className="text-left px-4 py-2 font-medium">Course</th>
                <th className="text-left px-4 py-2 font-medium">Type</th>
                <th className="text-left px-4 py-2 font-medium">Date</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="text-center text-muted-foreground p-8">No sessions match your filters.</td></tr>
              )}
              {filtered.map((r: any) => {
                const locked = isLockedClient(r, lockHours);
                return (
                  <tr key={r.id} className="hover:bg-muted/40">
                    <td className="px-4 py-2 font-medium">{r.title}</td>
                    <td className="px-4 py-2">{r.batches?.name ?? "—"}</td>
                    <td className="px-4 py-2">{r.courses?.title ?? "—"}</td>
                    <td className="px-4 py-2 text-xs">{ATT_TYPE_LABELS[r.attendance_type as AttType] ?? r.attendance_type}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{fmtDateTime(r.session_date)}</td>
                    <td className="px-4 py-2">
                      {locked
                        ? <Badge variant="outline" className="bg-muted text-muted-foreground"><Lock className="h-3 w-3 mr-1" />Locked</Badge>
                        : r.status === "submitted"
                          ? <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Submitted</Badge>
                          : <Badge className="bg-amber-50 text-amber-700 border-amber-200">Draft</Badge>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
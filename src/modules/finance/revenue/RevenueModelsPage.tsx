import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useWorkspace } from "@/shared/hooks/useWorkspace";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { settlementService, REVENUE_TYPE_LABELS, formatMoney } from "@/services/supabase/revenueService";
import RevenueModelSection from "./RevenueModelSection";
import { toast } from "@/hooks/use-toast";
import { Wallet } from "lucide-react";

export default function RevenueModelsPage() {
  const { membership } = useWorkspace();
  const wsId = membership?.workspace.id ?? "";
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);

  const q = useQuery({
    queryKey: ["course-revenue-models", wsId],
    queryFn: () => settlementService.listCourseRevenueModels(wsId),
    enabled: !!wsId,
  });

  const rows = useMemo(() => {
    const list = q.data ?? [];
    const s = search.trim().toLowerCase();
    if (!s) return list;
    return list.filter((r) =>
      (r.title ?? "").toLowerCase().includes(s) ||
      (r.instructor?.full_name ?? "").toLowerCase().includes(s));
  }, [q.data, search]);

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const { id, title: _t, instructor: _i, ...patch } = editing;
      await settlementService.updateCourseRevenueModel(id, patch);
      toast({ title: "Revenue model updated" });
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["course-revenue-models", wsId] });
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-[1400px]">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Revenue models</h1>
        <p className="text-muted-foreground">Configure how each course pays its instructor.</p>
      </header>

      <Card className="p-4 border-border">
        <Input placeholder="Search course or instructor…" value={search}
          onChange={(e) => setSearch(e.target.value)} className="md:w-80" />
      </Card>

      <Card className="border-border overflow-hidden">
        {q.isLoading ? (
          <div className="p-4 space-y-2">{Array.from({length: 5}).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <Wallet className="h-10 w-10 mx-auto mb-3 opacity-50" />
            No courses in this workspace yet.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Course</TableHead>
                <TableHead>Instructor</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Share</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.title}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.instructor?.full_name ?? "—"}</TableCell>
                  <TableCell>{formatMoney(Number(r.price_amount ?? 0), r.currency ?? "INR")}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{REVENUE_TYPE_LABELS[r.revenue_model]}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {r.revenue_model === "revenue_share" || r.revenue_model === "custom_share"
                      ? `${r.revenue_platform_pct}% / ${r.revenue_instructor_pct}%`
                      : r.revenue_model === "instructor_fixed"
                      ? formatMoney(Number(r.revenue_fixed_amount ?? 0), r.currency ?? "INR")
                      : r.revenue_model === "per_student_fixed"
                      ? `${formatMoney(Number(r.revenue_per_student_amount ?? 0), r.currency ?? "INR")}/student`
                      : r.revenue_model === "one_time_contract"
                      ? formatMoney(Number(r.revenue_one_time_amount ?? 0), r.currency ?? "INR")
                      : "—"}
                  </TableCell>
                  <TableCell className="text-sm capitalize">{r.settlement_frequency}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => setEditing({ ...r })}>Configure</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Revenue configuration — {editing?.title}</DialogTitle>
          </DialogHeader>
          {editing && (
            <RevenueModelSection
              value={editing}
              currency={editing.currency ?? "INR"}
              onChange={(patch) => setEditing((e: any) => ({ ...e, ...patch }))}
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
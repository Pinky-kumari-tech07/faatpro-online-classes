import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWorkspace } from "@/shared/hooks/useWorkspace";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  settlementService, formatMoney, exportToCSV, REVENUE_TYPE_LABELS,
} from "@/services/supabase/revenueService";
import { Download, Wallet } from "lucide-react";

export default function AdminEarningsPage() {
  const { membership } = useWorkspace();
  const wsId = membership?.workspace.id ?? "";
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");

  const q = useQuery({
    queryKey: ["ws-earnings", wsId, status],
    queryFn: () => settlementService.listWorkspaceEarnings(wsId, { status }),
    enabled: !!wsId,
  });

  const rows = (q.data ?? []).filter((r: any) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (r.instructor?.full_name ?? "").toLowerCase().includes(s)
        || (r.course?.title ?? "").toLowerCase().includes(s)
        || (r.student?.full_name ?? "").toLowerCase().includes(s);
  });

  const totals = useMemo(() => {
    const t = { gross: 0, gst: 0, discount: 0, net: 0, instructor: 0, platform: 0 };
    rows.forEach((e: any) => {
      t.gross += Number(e.gross_amount) || 0;
      t.gst += Number(e.tax_amount) || 0;
      t.discount += Number(e.discount_amount) || 0;
      t.net += Number(e.net_revenue_base) || 0;
      t.instructor += Number(e.net_earning) || 0;
      t.platform += Number(e.commission_amount) || 0;
    });
    return t;
  }, [rows]);

  const onExport = () => {
    exportToCSV(`instructor-earnings-${new Date().toISOString().slice(0,10)}.csv`,
      rows.map((e: any) => ({
        Date: new Date(e.earned_at).toLocaleString(),
        Instructor: e.instructor?.full_name ?? "",
        Student: e.student?.full_name ?? "",
        Course: e.course?.title ?? "",
        Order: e.payment_id ?? "",
        Model: e.revenue_model,
        Gross: e.gross_amount,
        GST: e.tax_amount,
        Discount: e.discount_amount,
        NetRevenue: e.net_revenue_base,
        InstructorShare: e.net_earning,
        PlatformShare: e.commission_amount,
        Status: e.settlement_status,
      })));
  };

  return (
    <div className="space-y-6 max-w-[1400px]">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Instructor earnings</h1>
          <p className="text-muted-foreground">Every earning generated across the workspace.</p>
        </div>
        <Button variant="outline" size="sm" onClick={onExport}>
          <Download className="h-4 w-4 mr-1" /> Export CSV
        </Button>
      </header>

      <div className="grid sm:grid-cols-2 lg:grid-cols-6 gap-3">
        <Kpi label="Gross" value={formatMoney(totals.gross)} />
        <Kpi label="GST" value={formatMoney(totals.gst)} />
        <Kpi label="Discount" value={formatMoney(totals.discount)} />
        <Kpi label="Net revenue" value={formatMoney(totals.net)} />
        <Kpi label="Instructor share" value={formatMoney(totals.instructor)} tone="success" />
        <Kpi label="Platform share" value={formatMoney(totals.platform)} tone="primary" />
      </div>

      <Card className="p-4 border-border">
        <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
          <div className="flex gap-2">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="requested">Requested</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="on_hold">On hold</SelectItem>
                <SelectItem value="reversed">Reversed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Input placeholder="Search instructor / course / student…" value={search}
            onChange={(e) => setSearch(e.target.value)} className="md:w-80" />
        </div>
      </Card>

      <Card className="border-border overflow-hidden">
        {q.isLoading ? (
          <div className="p-4 space-y-2">{Array.from({length:5}).map((_,i)=><Skeleton key={i} className="h-12"/>)}</div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <Wallet className="h-10 w-10 mx-auto mb-3 opacity-50" /> No earnings yet.
          </div>
        ) : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Date</TableHead><TableHead>Instructor</TableHead><TableHead>Course</TableHead>
              <TableHead>Student</TableHead><TableHead>Model</TableHead>
              <TableHead>Gross</TableHead><TableHead>Net base</TableHead>
              <TableHead>Instructor</TableHead><TableHead>Status</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rows.map((e: any) => (
                <TableRow key={e.id}>
                  <TableCell className="text-xs">{new Date(e.earned_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-sm">{e.instructor?.full_name ?? "—"}</TableCell>
                  <TableCell className="text-sm">{e.course?.title ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{e.student?.full_name ?? "—"}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{REVENUE_TYPE_LABELS[e.revenue_model as keyof typeof REVENUE_TYPE_LABELS] ?? "—"}</Badge></TableCell>
                  <TableCell>{formatMoney(Number(e.gross_amount), e.currency)}</TableCell>
                  <TableCell>{formatMoney(Number(e.net_revenue_base ?? 0), e.currency)}</TableCell>
                  <TableCell className="font-semibold">{formatMoney(Number(e.net_earning), e.currency)}</TableCell>
                  <TableCell><Badge variant="outline" className="capitalize text-xs">{e.settlement_status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "success"|"primary" }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold ${tone === "success" ? "text-emerald-600 dark:text-emerald-400" : tone === "primary" ? "text-primary" : ""}`}>
        {value}
      </div>
    </Card>
  );
}
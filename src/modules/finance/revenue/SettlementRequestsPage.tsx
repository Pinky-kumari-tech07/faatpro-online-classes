import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWorkspace } from "@/shared/hooks/useWorkspace";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { settlementService, formatMoney, exportToCSV, SETTLEMENT_STATUS_META } from "@/services/supabase/revenueService";
import SettlementDetailDialog from "./SettlementDetailDialog";
import { Wallet, Download, Eye, Clock, CheckCircle2, BadgeDollarSign } from "lucide-react";

type StatusFilter = "all" | "requested" | "approved" | "on_hold" | "paid" | "rejected";

export default function SettlementRequestsPage({ historyOnly = false }: { historyOnly?: boolean }) {
  const { membership } = useWorkspace();
  const wsId = membership?.workspace.id ?? "";
  const [status, setStatus] = useState<StatusFilter>(historyOnly ? "paid" : "requested");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["settlements", wsId, status],
    queryFn: () => settlementService.listSettlements(wsId, status),
    enabled: !!wsId,
  });
  const allQ = useQuery({
    queryKey: ["settlements-all", wsId],
    queryFn: () => settlementService.listSettlements(wsId, "all"),
    enabled: !!wsId,
  });

  const rows = (q.data ?? []).filter((r: any) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      (r.instructor?.full_name ?? "").toLowerCase().includes(s) ||
      (r.instructor?.email ?? "").toLowerCase().includes(s) ||
      (r.settlement_number ?? "").toLowerCase().includes(s)
    );
  });

  const counts = useMemo(() => {
    const all = allQ.data ?? [];
    const by = (s: string) => all.filter((r: any) => r.status === s).length;
    return {
      all: all.length, requested: by("requested"), approved: by("approved"),
      on_hold: by("on_hold"), paid: by("paid"), rejected: by("rejected"),
    };
  }, [allQ.data]);

  const totals = useMemo(() => {
    const all = (allQ.data ?? []) as any[];
    const pending = all.filter((r) => ["requested","approved","on_hold"].includes(r.status))
      .reduce((a, r) => a + Number(r.amount) - Number(r.paid_amount ?? 0), 0);
    const paid = all.reduce((a, r) => a + Number(r.paid_amount ?? 0), 0);
    return { pending, paid, currency: all[0]?.currency ?? "INR" };
  }, [allQ.data]);

  const onExport = () => {
    exportToCSV(`settlements-${status}-${new Date().toISOString().slice(0,10)}.csv`,
      rows.map((r: any) => ({
        Number: r.settlement_number,
        Instructor: r.instructor?.full_name ?? "",
        Email: r.instructor?.email ?? "",
        Amount: r.amount, Paid: r.paid_amount ?? 0,
        Status: r.status, Requested: new Date(r.created_at).toLocaleString(),
        Paid_at: r.paid_at ? new Date(r.paid_at).toLocaleString() : "",
      })));
  };

  return (
    <div className="space-y-6 max-w-[1400px]">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            {historyOnly ? "Settlement history" : "Settlement requests"}
          </h1>
          <p className="text-muted-foreground">
            {historyOnly ? "Completed instructor settlements." : "Review, approve and pay instructor settlement requests."}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onExport}>
          <Download className="h-4 w-4 mr-1" /> Export CSV
        </Button>
      </header>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={Clock} label="Pending" value={counts.requested + counts.approved + counts.on_hold} />
        <Kpi icon={Wallet} label="Pending amount" value={formatMoney(totals.pending, totals.currency)} tone="warning" />
        <Kpi icon={CheckCircle2} label="Paid amount" value={formatMoney(totals.paid, totals.currency)} tone="success" />
        <Kpi icon={BadgeDollarSign} label="Total requests" value={counts.all} tone="primary" />
      </div>

      <Card className="p-4 border-border">
        <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
          <Tabs value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="requested">Pending ({counts.requested})</TabsTrigger>
              <TabsTrigger value="approved">Approved ({counts.approved})</TabsTrigger>
              <TabsTrigger value="on_hold">Hold ({counts.on_hold})</TabsTrigger>
              <TabsTrigger value="paid">Paid ({counts.paid})</TabsTrigger>
              <TabsTrigger value="rejected">Rejected ({counts.rejected})</TabsTrigger>
              <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
            </TabsList>
          </Tabs>
          <Input placeholder="Search instructor or settlement #…" value={search}
            onChange={(e) => setSearch(e.target.value)} className="md:w-80" />
        </div>
      </Card>

      <Card className="border-border overflow-hidden">
        {q.isLoading ? (
          <div className="p-4 space-y-2">{Array.from({length:5}).map((_,i)=><Skeleton key={i} className="h-12"/>)}</div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <Wallet className="h-10 w-10 mx-auto mb-3 opacity-50" /> No settlements in this view.
          </div>
        ) : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Settlement</TableHead>
              <TableHead>Instructor</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Paid</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Requested</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rows.map((r: any) => {
                const meta = SETTLEMENT_STATUS_META[r.status] ?? SETTLEMENT_STATUS_META.requested;
                const remaining = Number(r.amount) - Number(r.paid_amount ?? 0);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.settlement_number ?? r.id.slice(0,8)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={r.instructor?.avatar_url ?? undefined} />
                          <AvatarFallback>{(r.instructor?.full_name ?? "I").slice(0,1)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="font-medium truncate">{r.instructor?.full_name ?? "Unknown"}</div>
                          <div className="text-xs text-muted-foreground truncate">{r.instructor?.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold">{formatMoney(Number(r.amount), r.currency)}</TableCell>
                    <TableCell className="text-sm">
                      {formatMoney(Number(r.paid_amount ?? 0), r.currency)}
                      {remaining > 0.01 && r.status !== "rejected" && (
                        <div className="text-xs text-muted-foreground">Left {formatMoney(remaining, r.currency)}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${meta.tone}`}>{meta.label}</span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => setOpenId(r.id)}>
                        <Eye className="h-4 w-4 mr-1" /> Details
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <SettlementDetailDialog requestId={openId} open={!!openId} onOpenChange={(o) => !o && setOpenId(null)} />
    </div>
  );
}

function Kpi({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string | number; tone?: "primary"|"success"|"warning" }) {
  const tones: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  };
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${tone ? tones[tone] : "bg-muted text-muted-foreground"}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-lg font-semibold truncate">{value}</div>
        </div>
      </div>
    </Card>
  );
}
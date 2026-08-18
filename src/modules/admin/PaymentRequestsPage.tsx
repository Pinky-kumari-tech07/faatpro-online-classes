import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Wallet, CheckCircle2, XCircle, BadgeDollarSign, Clock, Download,
  RefreshCcw, ArrowDownToLine, User,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/shared/hooks/useAuth";
import { useWorkspace } from "@/shared/hooks/useWorkspace";
import { revenueService, formatMoney, exportToCSV } from "@/services/supabase/revenueService";

type StatusFilter = "all" | "requested" | "approved" | "paid" | "rejected" | "cancelled";

const STATUS_META: Record<string, { label: string; tone: string }> = {
  requested: { label: "Pending", tone: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" },
  approved:  { label: "Approved", tone: "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300" },
  paid:      { label: "Paid", tone: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300" },
  rejected:  { label: "Rejected", tone: "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300" },
  cancelled: { label: "Cancelled", tone: "bg-muted text-muted-foreground" },
};

export default function PaymentRequestsPage() {
  const { user } = useAuth();
  const { membership } = useWorkspace();
  const qc = useQueryClient();
  const wsId = membership?.workspace.id ?? "";
  const reviewerId = user?.id ?? "";

  const [status, setStatus] = useState<StatusFilter>("requested");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any | null>(null);
  const [action, setAction] = useState<"approve" | "reject" | "paid" | null>(null);
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  const listQ = useQuery({
    queryKey: ["admin-payouts", wsId, status],
    queryFn: () => revenueService.listWorkspacePayouts(wsId, status),
    enabled: !!wsId,
  });

  // For tab counts
  const allQ = useQuery({
    queryKey: ["admin-payouts-all", wsId],
    queryFn: () => revenueService.listWorkspacePayouts(wsId, "all"),
    enabled: !!wsId,
  });

  const rows = (listQ.data ?? []).filter((r: any) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      (r.instructor?.full_name ?? "").toLowerCase().includes(s) ||
      (r.instructor?.email ?? "").toLowerCase().includes(s) ||
      String(r.amount).includes(s)
    );
  });

  const counts = useMemo(() => {
    const all = (allQ.data ?? []) as any[];
    return {
      all: all.length,
      requested: all.filter((r) => r.status === "requested").length,
      approved: all.filter((r) => r.status === "approved").length,
      paid: all.filter((r) => r.status === "paid").length,
      rejected: all.filter((r) => r.status === "rejected").length,
      cancelled: all.filter((r) => r.status === "cancelled").length,
    };
  }, [allQ.data]);

  const totals = useMemo(() => {
    const all = (allQ.data ?? []) as any[];
    const pending = all
      .filter((r) => r.status === "requested" || r.status === "approved")
      .reduce((a, r) => a + Number(r.amount), 0);
    const paidTotal = all.filter((r) => r.status === "paid").reduce((a, r) => a + Number(r.amount), 0);
    const currency = all[0]?.currency ?? "INR";
    return { pending, paid: paidTotal, count: all.length, currency };
  }, [allQ.data]);

  const openAction = (row: any, act: "approve" | "reject" | "paid") => {
    setSelected(row);
    setAction(act);
    setReference(row?.payment_reference ?? "");
    setNotes(row?.notes ?? "");
  };

  const closeDialog = () => {
    setSelected(null);
    setAction(null);
    setReference("");
    setNotes("");
  };

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-payouts", wsId] });
    qc.invalidateQueries({ queryKey: ["admin-payouts-all", wsId] });
  };

  const submitAction = async () => {
    if (!selected || !action) return;
    try {
      if (action === "approve") {
        await revenueService.approvePayout(selected.id, reviewerId);
        toast({ title: "Request approved" });
      } else if (action === "reject") {
        await revenueService.rejectPayout(selected.id, reviewerId, notes);
        toast({ title: "Request rejected" });
      } else if (action === "paid") {
        await revenueService.markPayoutPaid(selected.id, reviewerId, reference, notes);
        toast({ title: "Payment recorded", description: "Balance has been updated." });
      }
      closeDialog();
      refresh();
    } catch (e: any) {
      toast({ title: "Action failed", description: e?.message, variant: "destructive" });
    }
  };

  const onExport = () => {
    exportToCSV(
      `payment-requests-${status}-${new Date().toISOString().slice(0, 10)}.csv`,
      rows.map((r: any) => ({
        Date: new Date(r.created_at).toLocaleString(),
        Instructor: r.instructor?.full_name ?? "",
        Email: r.instructor?.email ?? "",
        Amount: r.amount,
        Currency: r.currency,
        Status: r.status,
        Reference: r.payment_reference ?? "",
        PaidAt: r.paid_at ? new Date(r.paid_at).toLocaleString() : "",
        Notes: r.notes ?? "",
      }))
    );
  };

  return (
    <div className="space-y-6 max-w-[1400px]">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Payment requests</h1>
          <p className="text-muted-foreground">
            Review and process instructor withdrawal requests.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCcw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={onExport}>
            <Download className="h-4 w-4 mr-1" /> Export CSV
          </Button>
        </div>
      </header>

      {/* KPI cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={Clock} label="Pending requests" value={counts.requested + counts.approved} />
        <Kpi icon={ArrowDownToLine} label="Pending amount" value={formatMoney(totals.pending, totals.currency)} accent="warning" />
        <Kpi icon={CheckCircle2} label="Total paid out" value={formatMoney(totals.paid, totals.currency)} accent="success" />
        <Kpi icon={BadgeDollarSign} label="Total requests" value={totals.count} accent="primary" />
      </div>

      {/* Filters */}
      <Card className="p-4 border-border">
        <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
          <Tabs value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
            <TabsList>
              <TabsTrigger value="requested">Pending ({counts.requested})</TabsTrigger>
              <TabsTrigger value="approved">Approved ({counts.approved})</TabsTrigger>
              <TabsTrigger value="paid">Paid ({counts.paid})</TabsTrigger>
              <TabsTrigger value="rejected">Rejected ({counts.rejected})</TabsTrigger>
              <TabsTrigger value="cancelled">Cancelled ({counts.cancelled})</TabsTrigger>
              <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
            </TabsList>
          </Tabs>
          <Input
            placeholder="Search instructor, email or amount…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="md:w-72"
          />
        </div>
      </Card>

      {/* Table */}
      <Card className="border-border overflow-hidden">
        {listQ.isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <Wallet className="h-10 w-10 mx-auto mb-3 opacity-50" />
            No payment requests in this view.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Instructor</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead>Processed</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r: any) => {
                const meta = STATUS_META[r.status] ?? STATUS_META.requested;
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={r.instructor?.avatar_url ?? undefined} />
                          <AvatarFallback>
                            {(r.instructor?.full_name ?? "I").slice(0, 1).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="font-medium truncate">{r.instructor?.full_name ?? "Unknown"}</div>
                          <div className="text-xs text-muted-foreground truncate">{r.instructor?.email ?? ""}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold">{formatMoney(Number(r.amount), r.currency)}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${meta.tone}`}>
                        {meta.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.paid_at
                        ? new Date(r.paid_at).toLocaleDateString()
                        : r.reviewed_at
                        ? new Date(r.reviewed_at).toLocaleDateString()
                        : "—"}
                    </TableCell>
                    <TableCell className="text-sm">{r.payment_reference ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {r.status === "requested" && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => openAction(r, "approve")}>
                              <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                            </Button>
                            <Button size="sm" onClick={() => openAction(r, "paid")}>
                              <BadgeDollarSign className="h-4 w-4 mr-1" /> Mark paid
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => openAction(r, "reject")}>
                              <XCircle className="h-4 w-4 mr-1" /> Reject
                            </Button>
                          </>
                        )}
                        {r.status === "approved" && (
                          <Button size="sm" onClick={() => openAction(r, "paid")}>
                            <BadgeDollarSign className="h-4 w-4 mr-1" /> Mark paid
                          </Button>
                        )}
                        {r.status === "paid" && (
                          <Badge variant="outline" className="font-normal">
                            Settled
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Action dialog */}
      <Dialog open={!!action} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action === "approve" && "Approve withdrawal request"}
              {action === "reject" && "Reject withdrawal request"}
              {action === "paid" && "Mark request as paid"}
            </DialogTitle>
            <DialogDescription>
              {selected && (
                <span>
                  <span className="font-medium">{selected.instructor?.full_name}</span> —{" "}
                  {formatMoney(Number(selected.amount), selected.currency)}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          {action === "paid" && (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Payment reference</label>
                <Input
                  placeholder="UTR / Transaction ID"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Notes (optional)</label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              <p className="text-xs text-muted-foreground">
                Marking as paid deducts <strong>{selected && formatMoney(Number(selected.amount), selected.currency)}</strong>{" "}
                from the instructor's available balance and adds the transaction to their withdrawal history.
              </p>
            </div>
          )}
          {action === "reject" && (
            <div>
              <label className="text-sm font-medium">Reason</label>
              <Textarea
                placeholder="Let the instructor know why this was rejected…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          )}
          {action === "approve" && (
            <p className="text-sm text-muted-foreground">
              Approving reserves the amount and signals payment is in process. You can mark it as paid once the transfer is complete.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button
              onClick={submitAction}
              variant={action === "reject" ? "destructive" : "default"}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: any;
  label: string;
  value: string | number;
  accent?: "primary" | "success" | "warning" | "accent";
}) {
  const tones: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    accent: "bg-accent text-accent-foreground",
  };
  return (
    <Card className="p-4 border-border">
      <div className="flex items-center gap-3">
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${accent ? tones[accent] : "bg-muted text-muted-foreground"}`}>
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
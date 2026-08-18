import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Wallet, TrendingUp, Users, BookOpen, Percent, BadgeDollarSign,
  Download, ArrowDownToLine, FileText,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/shared/hooks/useAuth";
import { useWorkspace } from "@/shared/hooks/useWorkspace";
import {
  revenueService, resolveRange, formatMoney, exportToCSV,
  type RevenueRange,
} from "@/services/supabase/revenueService";
import { settlementService } from "@/services/supabase/revenueService";
import jsPDF from "jspdf";

const RANGE_LABELS: Record<RevenueRange, string> = {
  today: "Today",
  week: "This week",
  month: "This month",
  year: "This year",
  custom: "Custom range",
} as any;

export default function InstructorRevenuePage() {
  const { user } = useAuth();
  const { membership } = useWorkspace();
  const qc = useQueryClient();
  const wsId = membership?.workspace.id ?? "";
  const instructorId = user?.id ?? "";

  const [range, setRange] = useState<RevenueRange>("month");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [payoutNotes, setPayoutNotes] = useState("");

  const bankProfileQ = useQuery({
    queryKey: ["instr-bank", instructorId, wsId],
    queryFn: () => settlementService.getInstructorBankProfile(instructorId, wsId),
    enabled: !!instructorId && !!wsId,
  });
  const bankVerified = !!(bankProfileQ.data as any)?.bank_verified;

  const bounds = useMemo(
    () =>
      resolveRange(range, {
        from: customFrom ? new Date(customFrom) : null,
        to: customTo ? new Date(customTo + "T23:59:59") : null,
      }),
    [range, customFrom, customTo]
  );

  // Earnings for the selected range
  const earningsQ = useQuery({
    queryKey: ["instr-earnings", instructorId, range, customFrom, customTo],
    queryFn: () => revenueService.listEarnings(instructorId, bounds),
    enabled: !!instructorId,
  });
  // All-time earnings (for available balance calculation)
  const allEarningsQ = useQuery({
    queryKey: ["instr-earnings-all", instructorId],
    queryFn: () =>
      revenueService.listEarnings(instructorId, { from: null, to: null }),
    enabled: !!instructorId,
  });
  const refundsQ = useQuery({
    queryKey: ["instr-refunds", instructorId, range, customFrom, customTo],
    queryFn: () => revenueService.listRefundsForInstructor(instructorId, bounds),
    enabled: !!instructorId,
  });
  const adjustmentsQ = useQuery({
    queryKey: ["instr-adjustments", instructorId],
    queryFn: () => revenueService.listAdjustments(instructorId),
    enabled: !!instructorId,
  });
  const payoutsQ = useQuery({
    queryKey: ["instr-payouts", instructorId],
    queryFn: () => revenueService.listPayouts(instructorId),
    enabled: !!instructorId,
  });

  const earnings = earningsQ.data ?? [];
  const allEarnings = allEarningsQ.data ?? [];
  const refunds = (refundsQ.data ?? []) as any[];
  const adjustments = (adjustmentsQ.data ?? []) as any[];
  const payouts = (payoutsQ.data ?? []) as any[];

  const summary = useMemo(
    () => revenueService.summarize(earnings, refunds, adjustments, payouts),
    [earnings, refunds, adjustments, payouts]
  );
  // Available balance uses lifetime net minus all payouts (paid + pending)
  const lifetime = useMemo(
    () => revenueService.summarize(allEarnings, [], adjustments, payouts),
    [allEarnings, adjustments, payouts]
  );
  const currency = summary.currency || lifetime.currency || "INR";

  const loading =
    earningsQ.isLoading || allEarningsQ.isLoading || refundsQ.isLoading;

  const rangeLabel = RANGE_LABELS[range];

  const onExportCSV = () => {
    exportToCSV(
      `revenue-summary-${range}-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        { Metric: "Total Revenue", Value: summary.gross, Currency: currency, Range: rangeLabel },
        { Metric: "Admin Commission", Value: summary.commission, Currency: currency, Range: rangeLabel },
        { Metric: "Net Earnings", Value: summary.net, Currency: currency, Range: rangeLabel },
        { Metric: "Total Students", Value: summary.students, Currency: "", Range: rangeLabel },
        { Metric: "Total Courses", Value: summary.courses, Currency: "", Range: rangeLabel },
        { Metric: "Available to Withdraw", Value: lifetime.available, Currency: currency, Range: "Lifetime" },
      ]
    );
  };

  const onExportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Revenue Summary", 14, 18);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Period: ${rangeLabel}`, 14, 26);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 32);
    doc.setTextColor(0);
    const rows: [string, string][] = [
      ["Total Revenue", formatMoney(summary.gross, currency)],
      ["Admin Commission", formatMoney(summary.commission, currency)],
      ["Net Earnings", formatMoney(summary.net, currency)],
      ["Total Students", String(summary.students)],
      ["Total Courses", String(summary.courses)],
      ["Available to Withdraw", formatMoney(lifetime.available, currency)],
    ];
    let y = 46;
    doc.setFontSize(11);
    rows.forEach(([k, v]) => {
      doc.text(k, 14, y);
      doc.text(v, 196, y, { align: "right" });
      doc.setDrawColor(220);
      doc.line(14, y + 2, 196, y + 2);
      y += 10;
    });
    doc.save(`revenue-summary-${range}-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const submitPayout = async () => {
    try {
      await settlementService.instructorRequestSettlement(wsId, payoutNotes || undefined);
      toast({
        title: "Settlement requested",
        description: "All eligible earnings have been bundled for admin approval.",
      });
      setPayoutOpen(false);
      setPayoutNotes("");
      qc.invalidateQueries({ queryKey: ["instr-payouts", instructorId] });
      qc.invalidateQueries({ queryKey: ["instr-earnings-all", instructorId] });
    } catch (e: any) {
      toast({
        title: "Cannot request settlement",
        description: e?.message ?? "Please verify your bank details first.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6 max-w-[1400px]">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Revenue & earnings</h1>
          <p className="text-muted-foreground">
            Your earnings summary and payout balance.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={range} onValueChange={(v) => setRange(v as RevenueRange)}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(RANGE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {range === "custom" && (
            <>
              <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-[150px]" />
              <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-[150px]" />
            </>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-1" /> Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onExportCSV}>
                <FileText className="h-4 w-4 mr-2" /> CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onExportPDF}>
                <FileText className="h-4 w-4 mr-2" /> PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" onClick={() => setPayoutOpen(true)}>
            <ArrowDownToLine className="h-4 w-4 mr-1" /> Request payout
          </Button>
        </div>
      </header>

      {/* Summary cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
          : (
            <>
              <Kpi icon={TrendingUp} label="Total revenue" value={formatMoney(summary.gross, currency)} accent="primary" />
              <Kpi icon={Percent} label="Admin commission" value={formatMoney(summary.commission, currency)} accent="warning" />
              <Kpi icon={Wallet} label="Net earnings" value={formatMoney(summary.net, currency)} accent="success" />
              <Kpi icon={Users} label="Total students" value={summary.students} />
              <Kpi icon={BookOpen} label="Total courses" value={summary.courses} />
              <Kpi icon={BadgeDollarSign} label="Available to withdraw" value={formatMoney(lifetime.available, currency)} accent="accent" />
            </>
          )}
      </div>

      {/* Payout dialog */}
      <Dialog open={payoutOpen} onOpenChange={setPayoutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request settlement</DialogTitle>
            <DialogDescription>
              All eligible pending earnings will be bundled and sent to the admin for approval. The amount is calculated automatically and cannot be edited.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {!bankVerified && (
              <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
                Your bank details must be verified by an admin before you can request a settlement.
              </div>
            )}
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">Eligible balance</div>
              <div className="text-xl font-bold">{formatMoney(lifetime.available, currency)}</div>
            </div>
            <div>
              <label className="text-xs font-medium">Notes (optional)</label>
              <Input value={payoutNotes} onChange={(e) => setPayoutNotes(e.target.value)} placeholder="Any reference for the admin" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPayoutOpen(false)}>Cancel</Button>
            <Button onClick={submitPayout} disabled={!bankVerified}>Submit request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Kpi({
  icon: Icon, label, value, accent,
}: { icon: any; label: string; value: React.ReactNode; accent?: "primary" | "accent" | "success" | "warning" }) {
  const accentClass =
    accent === "primary" ? "bg-primary-soft text-primary"
    : accent === "accent" ? "bg-accent/10 text-accent"
    : accent === "success" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
    : accent === "warning" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
    : "bg-muted text-muted-foreground";
  return (
    <Card className="p-4 border-border shadow-none">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground truncate">{label}</div>
          <div className="text-xl font-bold tracking-tight mt-1 truncate">{value}</div>
        </div>
        <div className={`h-9 w-9 grid place-items-center rounded-lg shrink-0 ${accentClass}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </Card>
  );
}

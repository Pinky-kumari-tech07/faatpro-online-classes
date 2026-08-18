import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { useState, useMemo } from "react";
import {
  settlementService, formatMoney, SETTLEMENT_STATUS_META, REVENUE_TYPE_LABELS,
} from "@/services/supabase/revenueService";
import { Loader2, CheckCircle2, XCircle, PauseCircle, BadgeDollarSign } from "lucide-react";

export default function SettlementDetailDialog({
  requestId, open, onOpenChange,
}: { requestId: string | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const [payAmt, setPayAmt] = useState("");
  const [payMode, setPayMode] = useState("bank_transfer");
  const [ref, setRef] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const q = useQuery({
    queryKey: ["settlement-detail", requestId],
    queryFn: () => settlementService.getSettlementDetail(requestId!),
    enabled: !!requestId && open,
  });

  const r = q.data?.request as any;
  const remaining = useMemo(() => (r ? Number(r.amount) - Number(r.paid_amount ?? 0) : 0), [r]);
  const meta = r ? (SETTLEMENT_STATUS_META[r.status] ?? SETTLEMENT_STATUS_META.requested) : null;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["settlement-detail", requestId] });
    qc.invalidateQueries({ queryKey: ["settlements"] });
  };

  const act = async (fn: () => Promise<any>, msg: string) => {
    setBusy(true);
    try { await fn(); toast({ title: msg }); refresh(); }
    catch (e: any) { toast({ title: "Action failed", description: e?.message, variant: "destructive" }); }
    finally { setBusy(false); }
  };

  const pay = async () => {
    const amt = Number(payAmt);
    if (!amt || amt <= 0) return toast({ title: "Enter a valid amount", variant: "destructive" });
    await act(() => settlementService.recordPayment(r.id, amt, payMode, ref || undefined, notes || undefined), "Payment recorded");
    setPayAmt(""); setRef(""); setNotes("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settlement {r?.settlement_number ?? ""}</DialogTitle>
        </DialogHeader>

        {q.isLoading || !r ? (
          <div className="p-8 text-center"><Loader2 className="h-6 w-6 mx-auto animate-spin" /></div>
        ) : (
          <div className="space-y-4">
            <div className="grid md:grid-cols-3 gap-3">
              <Card className="p-3">
                <div className="text-xs text-muted-foreground">Instructor</div>
                <div className="font-semibold">{r.instructor?.full_name ?? "—"}</div>
                <div className="text-xs text-muted-foreground">{r.instructor?.email}</div>
              </Card>
              <Card className="p-3">
                <div className="text-xs text-muted-foreground">Amount</div>
                <div className="font-semibold">{formatMoney(Number(r.amount), r.currency)}</div>
                <div className="text-xs text-muted-foreground">
                  Paid {formatMoney(Number(r.paid_amount ?? 0), r.currency)} · Remaining {formatMoney(remaining, r.currency)}
                </div>
              </Card>
              <Card className="p-3">
                <div className="text-xs text-muted-foreground">Status</div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${meta?.tone}`}>{meta?.label}</span>
                <div className="text-xs text-muted-foreground mt-1">
                  {r.earnings_count} earning{r.earnings_count === 1 ? "" : "s"} bundled
                </div>
              </Card>
            </div>

            {r.bank_snapshot && (
              <Card className="p-4">
                <div className="text-sm font-semibold mb-2">Bank details (snapshot)</div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                  <Info label="Account holder" value={r.bank_snapshot.account_holder} />
                  <Info label="Account no" value={r.bank_snapshot.account_number} />
                  <Info label="IFSC" value={r.bank_snapshot.ifsc} />
                  <Info label="Bank" value={r.bank_snapshot.bank} />
                  <Info label="Branch" value={r.bank_snapshot.branch} />
                  <Info label="UPI" value={r.bank_snapshot.upi} />
                </div>
              </Card>
            )}

            {/* Admin actions */}
            {(r.status === "requested" || r.status === "approved" || r.status === "on_hold") && (
              <Card className="p-4 space-y-3">
                <div className="text-sm font-semibold">Actions</div>
                <div className="flex flex-wrap gap-2">
                  {r.status !== "approved" && (
                    <Button size="sm" variant="outline" disabled={busy}
                      onClick={() => act(() => settlementService.updateSettlementStatus(r.id, "approved"), "Approved")}>
                      <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                    </Button>
                  )}
                  {r.status !== "on_hold" && (
                    <Button size="sm" variant="outline" disabled={busy}
                      onClick={() => act(() => settlementService.updateSettlementStatus(r.id, "on_hold"), "On hold")}>
                      <PauseCircle className="h-4 w-4 mr-1" /> Hold
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" disabled={busy}
                    onClick={() => act(() => settlementService.updateSettlementStatus(r.id, "rejected"), "Rejected")}>
                    <XCircle className="h-4 w-4 mr-1" /> Reject
                  </Button>
                </div>

                {remaining > 0.01 && r.status !== "on_hold" && r.status !== "rejected" && (
                  <div className="border-t pt-3 space-y-2">
                    <div className="text-sm font-semibold flex items-center gap-2">
                      <BadgeDollarSign className="h-4 w-4" /> Record payment (partial or full)
                    </div>
                    <div className="grid md:grid-cols-4 gap-2">
                      <div>
                        <Label className="text-xs">Amount</Label>
                        <Input type="number" max={remaining} value={payAmt}
                          onChange={(e) => setPayAmt(e.target.value)} placeholder={String(remaining)} />
                      </div>
                      <div>
                        <Label className="text-xs">Mode</Label>
                        <Select value={payMode} onValueChange={setPayMode}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["bank_transfer","upi","neft","rtgs","imps","cheque","cash","other"].map(m =>
                              <SelectItem key={m} value={m}>{m.toUpperCase()}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="md:col-span-2">
                        <Label className="text-xs">Reference / UTR</Label>
                        <Input value={ref} onChange={(e) => setRef(e.target.value)} />
                      </div>
                      <div className="md:col-span-4">
                        <Label className="text-xs">Notes</Label>
                        <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button onClick={pay} disabled={busy}>Record payment</Button>
                    </div>
                  </div>
                )}
              </Card>
            )}

            <Tabs defaultValue="earnings">
              <TabsList>
                <TabsTrigger value="earnings">Earnings ({q.data.earnings.length})</TabsTrigger>
                <TabsTrigger value="txns">Transactions ({q.data.transactions.length})</TabsTrigger>
                <TabsTrigger value="audit">Audit ({q.data.audit.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="earnings">
                <Card className="overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Course</TableHead>
                        <TableHead>Student</TableHead>
                        <TableHead>Model</TableHead>
                        <TableHead>Gross</TableHead>
                        <TableHead>GST</TableHead>
                        <TableHead>Discount</TableHead>
                        <TableHead>Net base</TableHead>
                        <TableHead>Instructor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {q.data.earnings.map((e: any) => (
                        <TableRow key={e.id}>
                          <TableCell className="text-xs">{new Date(e.earned_at).toLocaleDateString()}</TableCell>
                          <TableCell>{e.course?.title ?? "—"}</TableCell>
                          <TableCell className="text-xs">{e.student?.full_name ?? "—"}</TableCell>
                          <TableCell><Badge variant="outline">{REVENUE_TYPE_LABELS[e.revenue_model as keyof typeof REVENUE_TYPE_LABELS] ?? e.revenue_model}</Badge></TableCell>
                          <TableCell>{formatMoney(Number(e.gross_amount), e.currency)}</TableCell>
                          <TableCell>{formatMoney(Number(e.tax_amount ?? 0), e.currency)}</TableCell>
                          <TableCell>{formatMoney(Number(e.discount_amount ?? 0), e.currency)}</TableCell>
                          <TableCell>{formatMoney(Number(e.net_revenue_base ?? 0), e.currency)}</TableCell>
                          <TableCell className="font-semibold">{formatMoney(Number(e.net_earning), e.currency)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              </TabsContent>
              <TabsContent value="txns">
                <Card className="overflow-hidden">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Date</TableHead><TableHead>Amount</TableHead><TableHead>Mode</TableHead>
                      <TableHead>Reference</TableHead><TableHead>Notes</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {q.data.transactions.map((t: any) => (
                        <TableRow key={t.id}>
                          <TableCell className="text-xs">{new Date(t.paid_at).toLocaleString()}</TableCell>
                          <TableCell className="font-semibold">{formatMoney(Number(t.amount), r.currency)}</TableCell>
                          <TableCell><Badge variant="outline">{t.payment_mode}</Badge></TableCell>
                          <TableCell className="text-xs">{t.transaction_reference ?? "—"}</TableCell>
                          <TableCell className="text-xs">{t.notes ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              </TabsContent>
              <TabsContent value="audit">
                <Card className="overflow-hidden">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Date</TableHead><TableHead>Actor</TableHead><TableHead>Action</TableHead>
                      <TableHead>Change</TableHead><TableHead>Remarks</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {q.data.audit.map((a: any) => (
                        <TableRow key={a.id}>
                          <TableCell className="text-xs">{new Date(a.created_at).toLocaleString()}</TableCell>
                          <TableCell className="text-xs">{a.actor?.full_name ?? "System"}</TableCell>
                          <TableCell><Badge variant="outline">{a.action}</Badge></TableCell>
                          <TableCell className="text-xs">{[a.old_status, a.new_status].filter(Boolean).join(" → ")}</TableCell>
                          <TableCell className="text-xs">{a.remarks ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value || "—"}</div>
    </div>
  );
}
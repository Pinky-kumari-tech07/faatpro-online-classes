import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/shared/hooks/useWorkspace";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download } from "lucide-react";
import PageHeader from "@/modules/shared/PageHeader";
import { exportToCsv, exportToXlsx } from "@/modules/students/exportUtils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { fmtMoney } from "./invoiceUtils";
import { format, startOfMonth, subMonths } from "date-fns";

function exportPdf(title: string, head: string[], rows: any[][]) {
  const doc = new jsPDF();
  doc.setFontSize(14).text(title, 14, 16);
  autoTable(doc, { head: [head], body: rows, startY: 24, styles: { fontSize: 9 } });
  doc.save(`${title.replace(/\s+/g, "_")}.pdf`);
}

export default function GstReportsPage() {
  const { membership } = useWorkspace();
  const wsId = membership?.workspace.id;

  const [from, setFrom] = useState(format(subMonths(startOfMonth(new Date()), 5), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(new Date(), "yyyy-MM-dd"));

  const { data: rows = [] } = useQuery({
    enabled: !!wsId,
    queryKey: ["gst-report-invoices", wsId, from, to],
    queryFn: async () => {
      const { data, error } = await supabase.from("invoices")
        .select("*")
        .eq("workspace_id", wsId!)
        .eq("doc_type", "invoice")
        .gte("issued_at", `${from}T00:00:00`)
        .lte("issued_at", `${to}T23:59:59`)
        .order("issued_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return data ?? [];
    },
  });

  const totals = useMemo(() => {
    const t = { taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 };
    for (const r of rows) {
      t.taxable += Number(r.taxable_amount ?? 0);
      t.cgst += Number(r.cgst_amount ?? 0);
      t.sgst += Number(r.sgst_amount ?? 0);
      t.igst += Number(r.igst_amount ?? 0);
      t.total += Number(r.total_amount ?? 0);
    }
    return t;
  }, [rows]);

  const monthly = useMemo(() => {
    const map = new Map<string, { month: string; taxable: number; cgst: number; sgst: number; igst: number; total: number; count: number }>();
    for (const r of rows) {
      const m = format(new Date(r.issued_at), "yyyy-MM");
      const cur = map.get(m) ?? { month: m, taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0, count: 0 };
      cur.taxable += Number(r.taxable_amount ?? 0);
      cur.cgst += Number(r.cgst_amount ?? 0);
      cur.sgst += Number(r.sgst_amount ?? 0);
      cur.igst += Number(r.igst_amount ?? 0);
      cur.total += Number(r.total_amount ?? 0);
      cur.count += 1;
      map.set(m, cur);
    }
    return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
  }, [rows]);

  const stateWise = useMemo(() => {
    const map = new Map<string, { state: string; count: number; taxable: number; cgst: number; sgst: number; igst: number; total: number }>();
    for (const r of rows) {
      const s = r.buyer_state || "Unknown";
      const cur = map.get(s) ?? { state: s, count: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 };
      cur.count += 1;
      cur.taxable += Number(r.taxable_amount ?? 0);
      cur.cgst += Number(r.cgst_amount ?? 0);
      cur.sgst += Number(r.sgst_amount ?? 0);
      cur.igst += Number(r.igst_amount ?? 0);
      cur.total += Number(r.total_amount ?? 0);
      map.set(s, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [rows]);

  const monthlyExport = () => monthly.map((m) => ({
    Month: m.month, Invoices: m.count,
    Taxable: m.taxable, CGST: m.cgst, SGST: m.sgst, IGST: m.igst, Total: m.total,
  }));
  const stateExport = () => stateWise.map((s) => ({
    State: s.state, Invoices: s.count,
    Taxable: s.taxable, CGST: s.cgst, SGST: s.sgst, IGST: s.igst, Total: s.total,
  }));

  return (
    <div className="space-y-4">
      <PageHeader title="Finance · GST Reports" description="Tax collection reports for compliance and filing" />

      <Card className="p-3 border-border flex flex-wrap gap-2 items-end">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">From</label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-44" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">To</label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-44" />
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label="Taxable Value" value={fmtMoney(totals.taxable)} />
        <Stat label="CGST" value={fmtMoney(totals.cgst)} />
        <Stat label="SGST" value={fmtMoney(totals.sgst)} />
        <Stat label="IGST" value={fmtMoney(totals.igst)} />
        <Stat label="Grand Total" value={fmtMoney(totals.total)} />
      </div>

      <Tabs defaultValue="monthly">
        <TabsList>
          <TabsTrigger value="monthly">Monthly Summary</TabsTrigger>
          <TabsTrigger value="state">State-wise</TabsTrigger>
          <TabsTrigger value="cgst">CGST</TabsTrigger>
          <TabsTrigger value="sgst">SGST</TabsTrigger>
          <TabsTrigger value="igst">IGST</TabsTrigger>
        </TabsList>

        <TabsContent value="monthly" className="mt-4">
          <ReportCard
            title="Monthly GST Summary"
            onCsv={() => exportToCsv(monthlyExport(), "monthly-gst")}
            onXlsx={() => exportToXlsx(monthlyExport(), "monthly-gst")}
            onPdf={() => exportPdf("Monthly GST Summary",
              ["Month", "Invoices", "Taxable", "CGST", "SGST", "IGST", "Total"],
              monthly.map((m) => [m.month, m.count, m.taxable.toFixed(2), m.cgst.toFixed(2), m.sgst.toFixed(2), m.igst.toFixed(2), m.total.toFixed(2)])
            )}
          >
            <Table>
              <TableHeader><TableRow>
                <TableHead>Month</TableHead><TableHead className="text-right">Invoices</TableHead>
                <TableHead className="text-right">Taxable</TableHead>
                <TableHead className="text-right">CGST</TableHead>
                <TableHead className="text-right">SGST</TableHead>
                <TableHead className="text-right">IGST</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {monthly.map((m) => (
                  <TableRow key={m.month}>
                    <TableCell>{m.month}</TableCell>
                    <TableCell className="text-right">{m.count}</TableCell>
                    <TableCell className="text-right">{fmtMoney(m.taxable)}</TableCell>
                    <TableCell className="text-right">{fmtMoney(m.cgst)}</TableCell>
                    <TableCell className="text-right">{fmtMoney(m.sgst)}</TableCell>
                    <TableCell className="text-right">{fmtMoney(m.igst)}</TableCell>
                    <TableCell className="text-right font-semibold">{fmtMoney(m.total)}</TableCell>
                  </TableRow>
                ))}
                {monthly.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">No data in range</TableCell></TableRow>}
              </TableBody>
            </Table>
          </ReportCard>
        </TabsContent>

        <TabsContent value="state" className="mt-4">
          <ReportCard
            title="State-wise GST"
            onCsv={() => exportToCsv(stateExport(), "state-gst")}
            onXlsx={() => exportToXlsx(stateExport(), "state-gst")}
            onPdf={() => exportPdf("State-wise GST",
              ["State", "Invoices", "Taxable", "CGST", "SGST", "IGST", "Total"],
              stateWise.map((s) => [s.state, s.count, s.taxable.toFixed(2), s.cgst.toFixed(2), s.sgst.toFixed(2), s.igst.toFixed(2), s.total.toFixed(2)])
            )}
          >
            <Table>
              <TableHeader><TableRow>
                <TableHead>State</TableHead><TableHead className="text-right">Invoices</TableHead>
                <TableHead className="text-right">Taxable</TableHead>
                <TableHead className="text-right">CGST</TableHead>
                <TableHead className="text-right">SGST</TableHead>
                <TableHead className="text-right">IGST</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {stateWise.map((s) => (
                  <TableRow key={s.state}>
                    <TableCell>{s.state}</TableCell>
                    <TableCell className="text-right">{s.count}</TableCell>
                    <TableCell className="text-right">{fmtMoney(s.taxable)}</TableCell>
                    <TableCell className="text-right">{fmtMoney(s.cgst)}</TableCell>
                    <TableCell className="text-right">{fmtMoney(s.sgst)}</TableCell>
                    <TableCell className="text-right">{fmtMoney(s.igst)}</TableCell>
                    <TableCell className="text-right font-semibold">{fmtMoney(s.total)}</TableCell>
                  </TableRow>
                ))}
                {stateWise.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">No data in range</TableCell></TableRow>}
              </TableBody>
            </Table>
          </ReportCard>
        </TabsContent>

        {(["cgst", "sgst", "igst"] as const).map((kind) => (
          <TabsContent key={kind} value={kind} className="mt-4">
            <SingleTaxReport rows={rows} kind={kind} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function SingleTaxReport({ rows, kind }: { rows: any[]; kind: "cgst" | "sgst" | "igst" }) {
  const filtered = rows.filter((r) => Number(r[`${kind}_amount`] ?? 0) > 0);
  const exp = () => filtered.map((r) => ({
    Number: r.invoice_number, Date: new Date(r.issued_at).toLocaleDateString("en-IN"),
    Buyer: r.buyer_name, State: r.buyer_state, Taxable: Number(r.taxable_amount ?? 0),
    Rate: Number(r[`${kind}_rate`] ?? 0), Amount: Number(r[`${kind}_amount`] ?? 0),
  }));
  const total = filtered.reduce((s, r) => s + Number(r[`${kind}_amount`] ?? 0), 0);

  return (
    <ReportCard
      title={`${kind.toUpperCase()} Collection Report`}
      onCsv={() => exportToCsv(exp(), `${kind}-collection`)}
      onXlsx={() => exportToXlsx(exp(), `${kind}-collection`)}
      onPdf={() => {
        const doc = new jsPDF();
        doc.setFontSize(14).text(`${kind.toUpperCase()} Collection Report`, 14, 16);
        autoTable(doc, {
          head: [["Number", "Date", "Buyer", "State", "Taxable", "Rate %", `${kind.toUpperCase()}`]],
          body: filtered.map((r) => [
            r.invoice_number, new Date(r.issued_at).toLocaleDateString("en-IN"),
            r.buyer_name ?? "", r.buyer_state ?? "",
            Number(r.taxable_amount ?? 0).toFixed(2),
            Number(r[`${kind}_rate`] ?? 0).toFixed(2),
            Number(r[`${kind}_amount`] ?? 0).toFixed(2),
          ]),
          startY: 24, styles: { fontSize: 8 },
        });
        doc.save(`${kind}-collection.pdf`);
      }}
    >
      <div className="px-3 pb-3 text-sm text-muted-foreground">
        Total {kind.toUpperCase()}: <span className="font-semibold text-foreground">{fmtMoney(total)}</span> · {filtered.length} invoices
      </div>
      <Table>
        <TableHeader><TableRow>
          <TableHead>Invoice</TableHead><TableHead>Date</TableHead><TableHead>Buyer</TableHead>
          <TableHead>State</TableHead>
          <TableHead className="text-right">Taxable</TableHead>
          <TableHead className="text-right">Rate</TableHead>
          <TableHead className="text-right">Amount</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {filtered.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-mono text-xs">{r.invoice_number}</TableCell>
              <TableCell className="text-xs">{new Date(r.issued_at).toLocaleDateString("en-IN")}</TableCell>
              <TableCell className="text-xs">{r.buyer_name}</TableCell>
              <TableCell className="text-xs">{r.buyer_state}</TableCell>
              <TableCell className="text-right text-xs">{fmtMoney(r.taxable_amount)}</TableCell>
              <TableCell className="text-right text-xs">{Number(r[`${kind}_rate`] ?? 0)}%</TableCell>
              <TableCell className="text-right text-xs font-semibold">{fmtMoney(r[`${kind}_amount`])}</TableCell>
            </TableRow>
          ))}
          {filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">No data</TableCell></TableRow>}
        </TableBody>
      </Table>
    </ReportCard>
  );
}

function ReportCard({ title, children, onCsv, onXlsx, onPdf }: { title: string; children: React.ReactNode; onCsv: () => void; onXlsx: () => void; onPdf: () => void }) {
  return (
    <Card className="border-border overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 border-b">
        <h3 className="font-semibold text-sm">{title}</h3>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onCsv}><Download className="h-3 w-3 mr-1" /> CSV</Button>
          <Button size="sm" variant="outline" onClick={onXlsx}><Download className="h-3 w-3 mr-1" /> Excel</Button>
          <Button size="sm" variant="outline" onClick={onPdf}><Download className="h-3 w-3 mr-1" /> PDF</Button>
        </div>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-3 border-border">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-lg font-bold mt-1">{value}</p>
    </Card>
  );
}

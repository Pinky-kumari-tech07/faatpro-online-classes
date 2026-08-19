import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/shared/hooks/useAuth";
import { useWorkspace } from "@/shared/hooks/useWorkspace";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Eye, Search, Receipt, FileText, Settings as SettingsIcon, BarChart3 } from "lucide-react";
import { Link } from "react-router-dom";
import { downloadInvoice, previewInvoice, fmtMoney, loadInvoiceBrandingOpts } from "./invoiceUtils";
import PageHeader from "@/modules/shared/PageHeader";
import { exportToCsv, exportToXlsx } from "@/modules/students/exportUtils";
import { toast } from "@/components/ui/use-toast";

export default function InvoicesPage() {
  const { user } = useAuth();
  const { membership, primaryRole } = useWorkspace();
  const wsId = membership?.workspace.id;
  const isAdmin = primaryRole && ["organization_admin","staff","super_admin"].includes(primaryRole);

  const [search, setSearch] = useState("");
  const [docType, setDocType] = useState<"all" | "invoice" | "credit_note">("all");

  const { data: invoices = [], isLoading } = useQuery({
    enabled: !!user?.id,
    queryKey: ["invoices", wsId, user?.id, isAdmin],
    queryFn: async () => {
      let q = supabase.from("invoices").select("*").order("issued_at", { ascending: false }).limit(500);
      if (isAdmin && wsId) q = q.eq("workspace_id", wsId);
      else q = q.eq("student_id", user!.id);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices.filter((i: any) => {
      if (docType !== "all" && i.doc_type !== docType) return false;
      if (!q) return true;
      return (
        (i.invoice_number ?? "").toLowerCase().includes(q) ||
        (i.buyer_name ?? "").toLowerCase().includes(q) ||
        (i.buyer_email ?? "").toLowerCase().includes(q) ||
        (i.course_title ?? "").toLowerCase().includes(q) ||
        (i.buyer_state ?? "").toLowerCase().includes(q)
      );
    });
  }, [invoices, search, docType]);

  const exportRows = () => filtered.map((i: any) => ({
    Number: i.invoice_number,
    Type: i.doc_type,
    Date: new Date(i.issued_at).toLocaleDateString("en-IN"),
    Buyer: i.buyer_name,
    State: i.buyer_state,
    Course: i.course_title,
    Taxable: Number(i.taxable_amount ?? 0),
    CGST: Number(i.cgst_amount ?? 0),
    SGST: Number(i.sgst_amount ?? 0),
    IGST: Number(i.igst_amount ?? 0),
    Total: Number(i.total_amount ?? 0),
    Currency: i.currency,
    GSTIN: i.buyer_gstin ?? "",
    Status: i.payment_status,
  }));

  const handlePreview = async (inv: any) => {
    const opts = await loadInvoiceBrandingOpts(wsId);
    await previewInvoice(inv, opts);
  };
  const handleDownload = async (inv: any) => {
    const opts = await loadInvoiceBrandingOpts(wsId);
    await downloadInvoice(inv, opts);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={isAdmin ? "Finance · Invoices" : "Payments · Invoices"}
        description={isAdmin ? "All GST invoices and credit notes for this workspace" : "Your tax invoices and credit notes"}
      />

      {isAdmin && (
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/app/finance/business-settings"><SettingsIcon className="h-4 w-4 mr-1" /> GST Settings</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/app/finance/gst-reports"><BarChart3 className="h-4 w-4 mr-1" /> GST Reports</Link>
          </Button>
        </div>
      )}

      <Card className="p-3 sm:p-4 border-border">
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center justify-between">
          <div className="flex flex-1 gap-2 max-w-2xl">
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by number, buyer, course, state…"
                className="pl-9"
              />
            </div>
            <Select value={docType} onValueChange={(v: any) => setDocType(v)}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All documents</SelectItem>
                <SelectItem value="invoice">Invoices only</SelectItem>
                <SelectItem value="credit_note">Credit notes only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {isAdmin && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => exportToCsv(exportRows(), "invoices")}>
                <Download className="h-3 w-3 mr-1" /> CSV
              </Button>
              <Button size="sm" variant="outline" onClick={() => exportToXlsx(exportRows(), "invoices")}>
                <Download className="h-3 w-3 mr-1" /> Excel
              </Button>
            </div>
          )}
        </div>
      </Card>

      <Card className="border-border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Date</TableHead>
                {isAdmin && <TableHead>Buyer</TableHead>}
                <TableHead>Course</TableHead>
                <TableHead className="text-right">Taxable</TableHead>
                <TableHead className="text-right">GST</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>State</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={isAdmin ? 10 : 9} className="text-center text-muted-foreground py-8">Loading invoices…</TableCell></TableRow>
              )}
              {!isLoading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={isAdmin ? 10 : 9} className="text-center text-muted-foreground py-12">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  No invoices yet
                </TableCell></TableRow>
              )}
              {filtered.map((i: any) => (
                <TableRow key={i.id}>
                  <TableCell className="font-mono text-xs">{i.invoice_number}</TableCell>
                  <TableCell>
                    {i.doc_type === "credit_note"
                      ? <Badge variant="destructive">Credit Note</Badge>
                      : <Badge variant="secondary">Invoice</Badge>}
                  </TableCell>
                  <TableCell className="text-xs">{new Date(i.issued_at).toLocaleDateString("en-IN")}</TableCell>
                  {isAdmin && <TableCell className="text-xs"><div>{i.buyer_name}</div><div className="text-muted-foreground">{i.buyer_email}</div></TableCell>}
                  <TableCell className="text-xs max-w-[180px] truncate">{i.course_title}</TableCell>
                  <TableCell className="text-right text-xs">{fmtMoney(i.taxable_amount, i.currency)}</TableCell>
                  <TableCell className="text-right text-xs">
                    {i.gst_type === "intra_state"
                      ? `C+S ${fmtMoney(Number(i.cgst_amount) + Number(i.sgst_amount), i.currency)}`
                      : `IGST ${fmtMoney(i.igst_amount, i.currency)}`}
                  </TableCell>
                  <TableCell className="text-right text-xs font-semibold">{fmtMoney(i.total_amount, i.currency)}</TableCell>
                  <TableCell className="text-xs">{i.buyer_state}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => handlePreview(i)} title="View"><Eye className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDownload(i)} title="Download"><Download className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

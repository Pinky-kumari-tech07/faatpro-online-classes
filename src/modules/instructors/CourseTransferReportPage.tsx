import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import PageHeader from "@/modules/shared/PageHeader";
import { courseLifecycleService } from "@/services/supabase/courseLifecycleService";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const fmtInr = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);

export default function CourseTransferReportPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [instructor, setInstructor] = useState("all");
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");

  const { data = [], isLoading } = useQuery({
    queryKey: ["course-transfers", from, to],
    queryFn: () => courseLifecycleService.listTransfers(
      from ? new Date(from).toISOString() : undefined,
      to ? new Date(to + "T23:59:59").toISOString() : undefined,
    ),
  });

  const instructors = useMemo(() => {
    const set = new Map<string, string>();
    (data as any[]).forEach((r) => {
      if (r.from_instructor) set.set(r.from_instructor, r.from_name || r.from_instructor);
      if (r.to_instructor) set.set(r.to_instructor, r.to_name || r.to_instructor);
    });
    return Array.from(set.entries()).map(([id, name]) => ({ id, name }));
  }, [data]);

  const categories = useMemo(
    () => Array.from(new Set((data as any[]).map((r) => r.category).filter(Boolean))),
    [data]
  );

  const filtered = useMemo(() => (data as any[]).filter((r) => {
    if (instructor !== "all" && r.from_instructor !== instructor && r.to_instructor !== instructor) return false;
    if (category !== "all" && r.category !== category) return false;
    if (search && !String(r.course_title ?? "").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [data, instructor, category, search]);

  const totals = filtered.reduce(
    (acc: { students: number; revenue: number }, r: any) => ({
      students: acc.students + Number(r.students || 0),
      revenue: acc.revenue + Number(r.revenue || 0),
    }),
    { students: 0, revenue: 0 }
  );

  const exportRows = () => filtered.map((r: any) => ({
    Date: new Date(r.created_at).toLocaleString(),
    Course: r.course_title ?? "",
    Category: r.category ?? "",
    "Previous Instructor": r.from_name ?? "",
    "New Instructor": r.to_name ?? "",
    Students: r.students ?? 0,
    Revenue: Number(r.revenue ?? 0),
    Admin: r.actor_name ?? "",
    Reason: r.reason ?? "",
    IP: r.ip_address ?? "",
    "User Agent": r.user_agent ?? "",
  }));

  const exportXlsx = () => {
    const ws = XLSX.utils.json_to_sheet(exportRows());
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Transfers");
    XLSX.writeFile(wb, `course-transfers-${Date.now()}.xlsx`);
  };

  const exportPdf = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text("FAATPRO — Course Transfer Report", 14, 15);
    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 21);
    doc.text(`Transfers: ${filtered.length} · Students: ${totals.students} · Revenue: ${fmtInr(totals.revenue)}`, 14, 26);
    autoTable(doc, {
      startY: 32,
      head: [["Date", "Course", "Category", "From", "To", "Students", "Revenue", "Admin", "Reason"]],
      body: filtered.map((r: any) => [
        new Date(r.created_at).toLocaleString(),
        r.course_title ?? "—",
        r.category ?? "—",
        r.from_name ?? "—",
        r.to_name ?? "—",
        r.students ?? 0,
        fmtInr(Number(r.revenue ?? 0)),
        r.actor_name ?? "—",
        r.reason ?? "—",
      ]),
      styles: { fontSize: 7 },
      headStyles: { fillColor: [30, 41, 59] },
    });
    doc.save(`course-transfers-${Date.now()}.pdf`);
  };

  const exportCsv = () => {
    const rows = exportRows();
    if (!rows.length) return;
    const header = Object.keys(rows[0]);
    const csv = [header, ...rows.map((r) => header.map((h) => (r as any)[h]))]
      .map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `course-transfers-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <PageHeader
        title="Course transfer report"
        description="Every instructor reassignment with actor, IP, browser, reason, students and revenue snapshot. Immutable audit trail."
      />

      <Card className="p-4 grid gap-3 md:grid-cols-5 border-border shadow-none">
        <div>
          <label className="text-xs text-muted-foreground">From</label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">To</label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Instructor</label>
          <Select value={instructor} onValueChange={setInstructor}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All instructors</SelectItem>
              {instructors.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Category</label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((c: any) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Search course</label>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Course title…" />
        </div>
      </Card>

      <Card className="p-4 flex flex-wrap items-center gap-3 border-border shadow-none">
        <div className="text-sm text-muted-foreground">
          <strong className="text-foreground">{filtered.length}</strong> transfer(s) ·
          <strong className="text-foreground ml-1">{totals.students}</strong> student(s) ·
          <strong className="text-foreground ml-1">{fmtInr(totals.revenue)}</strong>
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!filtered.length}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportXlsx} disabled={!filtered.length}>
            <FileSpreadsheet className="h-4 w-4 mr-1" /> XLSX
          </Button>
          <Button variant="outline" size="sm" onClick={exportPdf} disabled={!filtered.length}>
            <FileText className="h-4 w-4 mr-1" /> PDF
          </Button>
        </div>
      </Card>

      <Card className="border-border shadow-none overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Transfer date</TableHead>
              <TableHead>Course</TableHead>
              <TableHead>Previous instructor</TableHead>
              <TableHead>New instructor</TableHead>
              <TableHead className="text-right">Students</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
              <TableHead>Admin</TableHead>
              <TableHead>Reason</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Loading…</TableCell></TableRow>
            )}
            {!isLoading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">No transfers match these filters.</TableCell></TableRow>
            )}
            {filtered.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="text-sm">{new Date(r.created_at).toLocaleString()}</TableCell>
                <TableCell className="font-medium">{r.course_title ?? "—"}<div className="text-[11px] text-muted-foreground">{r.category ?? ""}</div></TableCell>
                <TableCell className="text-sm">{r.from_name ?? "—"}</TableCell>
                <TableCell className="text-sm">{r.to_name ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{r.students ?? 0}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtInr(Number(r.revenue ?? 0))}</TableCell>
                <TableCell className="text-sm">{r.actor_name ?? "—"}<div className="text-[11px] text-muted-foreground">{r.ip_address ?? ""}</div></TableCell>
                <TableCell className="text-sm max-w-xs truncate" title={r.reason ?? ""}>{r.reason ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
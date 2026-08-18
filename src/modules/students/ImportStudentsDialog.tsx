import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Upload } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { studentService } from "./studentService";

export default function ImportStudentsDialog({
  open, onOpenChange, workspaceId, courses,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  workspaceId: string;
  courses: Array<{ id: string; title: string; slug: string }>;
}) {
  const qc = useQueryClient();
  const [csvText, setCsvText] = useState("");
  const [defaultCourse, setDefaultCourse] = useState<string>("none");
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<any[] | null>(null);

  const slugMap = useMemo(
    () => Object.fromEntries(courses.map((c) => [c.slug, c.id])),
    [courses],
  );
  const courseTitleById = useMemo(
    () => Object.fromEntries(courses.map((c) => [c.id, c.title])),
    [courses],
  );

  const parsed = useMemo(() => csvText ? studentService.parseCsv(csvText) : [], [csvText]);
  const validated = useMemo(() => studentService.validate(parsed, slugMap), [parsed, slugMap]);

  const validCount = validated.filter((r) => r.valid).length;
  const invalidCount = validated.length - validCount;

  const handleFile = async (file?: File) => {
    if (!file) return;
    setCsvText(await file.text());
  };

  const downloadSample = () => {
    const blob = new Blob([studentService.sampleCsv()], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "students-sample.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const runImport = async () => {
    const valid = validated.filter((r) => r.valid);
    if (!valid.length) {
      toast({ title: "No valid rows to import", variant: "destructive" });
      return;
    }
    setImporting(true);
    try {
      const res = await studentService.importStudents({
        workspace_id: workspaceId,
        default_course_id: defaultCourse !== "none" ? defaultCourse : null,
        students: valid.map((r) => ({
          name: r.name, email: r.email, password: r.password,
          phone: r.phone, course_slug: r.course_slug, status: r.status,
        })),
      });
      setResults(res.results);
      toast({ title: `Imported ${res.summary.created} of ${res.summary.total}` });
      qc.invalidateQueries({ queryKey: ["students"] });
    } catch (e: any) {
      toast({ title: "Import failed", description: e.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const close = () => {
    setCsvText(""); setResults(null); setDefaultCourse("none");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) close(); else onOpenChange(true); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Import students</DialogTitle></DialogHeader>

        {!results && (
          <div className="space-y-4">
            <Alert>
              <AlertDescription className="text-sm">
                Required headers: <code>name,email,password</code>. Optional: <code>phone,course_slug,status</code>.
              </AlertDescription>
            </Alert>

            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5 min-w-[240px]">
                <Label>Default course for import (optional)</Label>
                <Select value={defaultCourse} onValueChange={setDefaultCourse}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No default</SelectItem>
                    {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" onClick={downloadSample}>
                <Download className="h-4 w-4 mr-1" /> Sample CSV
              </Button>
              <label className="inline-flex">
                <input type="file" accept=".csv,text/csv" className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0])} />
                <span className="inline-flex items-center gap-1 h-10 px-3 rounded-md border border-input text-sm cursor-pointer hover:bg-accent">
                  <Upload className="h-4 w-4" /> Upload CSV
                </span>
              </label>
            </div>

            <div className="space-y-1.5">
              <Label>Or paste CSV</Label>
              <Textarea rows={6} value={csvText} onChange={(e) => setCsvText(e.target.value)}
                placeholder="name,email,password,phone,course_slug,status" />
            </div>

            {validated.length > 0 && (
              <>
                <div className="flex gap-3 text-sm">
                  <Badge variant="secondary">{validated.length} rows</Badge>
                  <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15">{validCount} valid</Badge>
                  {invalidCount > 0 && <Badge variant="destructive">{invalidCount} invalid</Badge>}
                </div>
                <div className="border rounded-md overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Password</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Course</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Result</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {validated.map((r) => {
                        const effectiveCourseId = r.course_id ?? (defaultCourse !== "none" ? defaultCourse : null);
                        const courseLabel = effectiveCourseId ? courseTitleById[effectiveCourseId] ?? "—" : "—";
                        return (
                          <TableRow key={r.rowNumber}>
                            <TableCell>{r.rowNumber}</TableCell>
                            <TableCell>{r.name}</TableCell>
                            <TableCell className="text-sm">{r.email}</TableCell>
                            <TableCell className="font-mono text-xs">{r.password ? "••••••••" : "—"}</TableCell>
                            <TableCell className="text-sm">{r.phone || "—"}</TableCell>
                            <TableCell className="text-sm">{courseLabel}</TableCell>
                            <TableCell className="text-sm">{r.status ?? "active"}</TableCell>
                            <TableCell>
                              {r.valid
                                ? <Badge variant="secondary">Ready</Badge>
                                : <Badge variant="destructive" title={r.error}>{r.error}</Badge>}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </div>
        )}

        {results && (
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">Import results</div>
            <div className="border rounded-md overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Enrolled</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-sm">{r.email}</TableCell>
                      <TableCell>
                        <Badge variant={r.status === "created" ? "secondary" : "destructive"}>{r.status}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{r.enrolled ? "Yes" : "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.error ?? ""}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={close}>Close</Button>
          {!results && (
            <Button onClick={runImport} disabled={importing || validCount === 0}>
              {importing ? "Importing…" : `Import ${validCount} student${validCount === 1 ? "" : "s"}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
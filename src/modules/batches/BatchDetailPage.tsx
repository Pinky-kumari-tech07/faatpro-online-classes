import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { ArrowLeft, Download, Loader2, Plus, Trash2, Upload, Users, BookOpen } from "lucide-react";
import PageHeader from "@/modules/shared/PageHeader";
import { useWorkspace } from "@/shared/hooks/useWorkspace";
import { batchService, VALIDITY_OPTIONS, institutionService } from "@/services/supabase";
import { studentService } from "@/modules/students/studentService";
import { supabase } from "@/integrations/supabase/client";

type ImportRow = {
  full_name: string;
  email: string;
  mobile?: string;
  institution?: string;
  roll_number?: string;
  registration_number?: string;
  department?: string;
  semester?: string;
  gender?: string;
  admission_date?: string;
  notes?: string;
  _error?: string;
  _valid?: boolean;
};

function generatePassword() {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let p = "";
  for (let i = 0; i < 10; i++) p += a[Math.floor(Math.random() * a.length)];
  return p + "!1";
}

export default function BatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { membership } = useWorkspace();
  const wsId = membership?.workspace.id ?? null;
  const qc = useQueryClient();

  const { data: batch, isLoading } = useQuery({
    enabled: !!id,
    queryKey: ["batch", id],
    queryFn: () => batchService.get(id!),
  });

  const { data: courses = [] } = useQuery({
    enabled: !!id,
    queryKey: ["batch-courses", id],
    queryFn: () => batchService.listCourses(id!),
  });

  const { data: students = [] } = useQuery({
    enabled: !!id,
    queryKey: ["batch-students", id],
    queryFn: () => batchService.listStudents(id!),
  });

  const { data: allCourses = [] } = useQuery({
    enabled: !!wsId,
    queryKey: ["ws-courses-simple", wsId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id,title,slug")
        .eq("workspace_id", wsId!)
        .is("deleted_at", null)
        .order("title");
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  const { data: institutions = [] } = useQuery({
    enabled: !!wsId,
    queryKey: ["institutions", wsId],
    queryFn: () => institutionService.list(wsId!),
  });

  const [addCourseId, setAddCourseId] = useState<string>("");
  const [importOpen, setImportOpen] = useState(false);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; failed: number; results: any[] } | null>(null);

  const addCourseMut = useMutation({
    mutationFn: () => batchService.addCourse(id!, addCourseId),
    onSuccess: () => {
      setAddCourseId("");
      toast({ title: "Course added — students auto-enrolled." });
      qc.invalidateQueries({ queryKey: ["batch-courses", id] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const removeCourseMut = useMutation({
    mutationFn: (courseId: string) => batchService.removeCourse(id!, courseId),
    onSuccess: () => {
      toast({ title: "Course removed" });
      qc.invalidateQueries({ queryKey: ["batch-courses", id] });
    },
  });

  const removeStudentMut = useMutation({
    mutationFn: (studentId: string) => batchService.removeStudent(id!, studentId),
    onSuccess: () => {
      toast({ title: "Student removed from batch" });
      qc.invalidateQueries({ queryKey: ["batch-students", id] });
    },
  });

  const downloadTemplate = () => {
    const sample: ImportRow[] = [{
      full_name: "Aarav Sharma", email: "aarav@example.com", mobile: "+919999999999",
      institution: "Sample College", roll_number: "21BC1023", registration_number: "REG-2021-001",
      department: "Computer Science", semester: "5", gender: "Male", admission_date: "2024-07-15", notes: "",
    }];
    const ws = XLSX.utils.json_to_sheet(sample);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Students");
    XLSX.writeFile(wb, "batch-students-template.xlsx");
  };

  const handleFile = async (file?: File) => {
    if (!file) return;
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json<any>(sheet, { defval: "" });
    const parsed: ImportRow[] = raw.map((r) => {
      const norm = (k: string) => String(r[k] ?? r[k.replace(/_/g, " ")] ?? "").trim();
      const row: ImportRow = {
        full_name: norm("full_name") || norm("Full Name") || norm("name"),
        email: (norm("email") || norm("Email")).toLowerCase(),
        mobile: norm("mobile") || norm("Mobile") || norm("phone"),
        institution: norm("institution") || norm("Institution"),
        roll_number: norm("roll_number") || norm("Roll Number"),
        registration_number: norm("registration_number") || norm("Registration Number"),
        department: norm("department") || norm("Department"),
        semester: norm("semester") || norm("Semester"),
        gender: norm("gender") || norm("Gender"),
        admission_date: norm("admission_date") || norm("Admission Date"),
        notes: norm("notes") || norm("Notes"),
      };
      if (!row.full_name) row._error = "Name required";
      else if (!/^\S+@\S+\.\S+$/.test(row.email)) row._error = "Invalid email";
      else row._valid = true;
      return row;
    });
    setRows(parsed);
    setImportResult(null);
  };

  const runImport = async () => {
    const valid = rows.filter((r) => r._valid);
    if (!valid.length || !id || !wsId) return;
    setImporting(true);
    try {
      // 1) Create or fetch user accounts via existing edge function
      const res = await studentService.importStudents({
        workspace_id: wsId,
        students: valid.map((r) => ({
          name: r.full_name,
          email: r.email,
          password: generatePassword(),
          phone: r.mobile,
          status: "active",
        })),
      });

      // 2) Resolve / create institutions
      const instMap = new Map<string, string>(
        institutions.map((i) => [i.name.toLowerCase(), i.id]),
      );
      const neededInst = Array.from(new Set(valid.map((r) => r.institution?.trim()).filter((n): n is string => !!n && !instMap.has(n.toLowerCase()))));
      for (const name of neededInst) {
        try {
          const created = await institutionService.create(wsId, { name, country: "India", is_active: true });
          instMap.set(name.toLowerCase(), created.id);
        } catch { /* ignore dupes */ }
      }

      // 3) Insert batch_students for created profiles (triggers fan-out enrollments)
      const created = res.results.filter((r: any) => r.status === "created" && r.profile_id);
      const profileByEmail = new Map<string, string>(
        created.map((r: any) => [r.email.toLowerCase(), r.profile_id]),
      );
      const batchRows = valid
        .map((r) => {
          const studentId = profileByEmail.get(r.email);
          if (!studentId) return null;
          return {
            batch_id: id,
            student_id: studentId,
            institution_id: r.institution ? instMap.get(r.institution.toLowerCase()) ?? null : null,
            roll_number: r.roll_number || null,
            registration_number: r.registration_number || null,
            department: r.department || null,
            semester: r.semester || null,
            gender: r.gender || null,
            admission_date: r.admission_date || null,
            notes: r.notes || null,
          };
        })
        .filter(Boolean) as any[];

      if (batchRows.length) {
        const { error } = await supabase.from("batch_students" as any).upsert(batchRows, {
          onConflict: "batch_id,student_id",
          ignoreDuplicates: true,
        } as any);
        if (error) throw error;
      }

      setImportResult({ created: batchRows.length, failed: res.summary.failed, results: res.results });
      qc.invalidateQueries({ queryKey: ["batch-students", id] });
      toast({ title: `Added ${batchRows.length} students. Auto-enrolled in batch courses.` });
    } catch (e: any) {
      toast({ title: "Import failed", description: e.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  if (isLoading || !batch) {
    return <div className="grid place-items-center min-h-[40vh]"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  const validityLabel = VALIDITY_OPTIONS.find((v) => v.value === ((batch as any).duration_type ?? batch.validity_type))?.label ?? batch.validity_type;
  const availableCourses = allCourses.filter((c: any) => !courses.some((bc: any) => bc.course_id === c.id));

  return (
    <div className="space-y-6">
      <PageHeader
        title={batch.name}
        description={`${batch.code} · Validity: ${validityLabel}`}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/app/batches"><ArrowLeft className="h-4 w-4 mr-2" /> All Batches</Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4"><div className="text-xs text-muted-foreground">Students</div>
          <div className="text-2xl font-bold">{students.length}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Courses</div>
          <div className="text-2xl font-bold">{courses.length}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Validity</div>
          <div className="text-lg font-semibold">{validityLabel}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Status</div>
          <Badge>{batch.status}</Badge></Card>
      </div>

      <Tabs defaultValue="courses">
        <TabsList>
          <TabsTrigger value="courses"><BookOpen className="h-4 w-4 mr-2" />Courses</TabsTrigger>
          <TabsTrigger value="students"><Users className="h-4 w-4 mr-2" />Students</TabsTrigger>
        </TabsList>

        <TabsContent value="courses" className="space-y-4">
          <Card className="p-4 space-y-4">
            <div className="flex gap-2 items-end">
              <div className="flex-1 space-y-1">
                <Label>Add Course</Label>
                <Select value={addCourseId} onValueChange={setAddCourseId}>
                  <SelectTrigger><SelectValue placeholder="Select a course…" /></SelectTrigger>
                  <SelectContent>
                    {availableCourses.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => addCourseMut.mutate()} disabled={!addCourseId || addCourseMut.isPending}>
                <Plus className="h-4 w-4 mr-2" /> Add
              </Button>
            </div>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Course</TableHead><TableHead className="text-right">Action</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {courses.length === 0 ? (
                  <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-6">No courses assigned yet.</TableCell></TableRow>
                ) : courses.map((bc: any) => (
                  <TableRow key={bc.id}>
                    <TableCell className="font-medium">{bc.courses?.title}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => removeCourseMut.mutate(bc.course_id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="students" className="space-y-4">
          <Card className="p-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => { setRows([]); setImportResult(null); setImportOpen(true); }}>
                <Upload className="h-4 w-4 mr-2" /> Bulk Import
              </Button>
              <Button variant="outline" onClick={downloadTemplate}>
                <Download className="h-4 w-4 mr-2" /> Excel Template
              </Button>
            </div>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Name</TableHead><TableHead>Email</TableHead>
                <TableHead>Institution</TableHead><TableHead>Roll #</TableHead>
                <TableHead>Dept</TableHead><TableHead className="text-right">Action</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {students.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                    No students yet. Use Bulk Import to add them.
                  </TableCell></TableRow>
                ) : students.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.profiles?.full_name}</TableCell>
                    <TableCell>{s.profiles?.email}</TableCell>
                    <TableCell>{s.institutions?.name ?? "—"}</TableCell>
                    <TableCell>{s.roll_number ?? "—"}</TableCell>
                    <TableCell>{s.department ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => removeStudentMut.mutate(s.student_id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Bulk Import Students into Batch</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Alert>
              <AlertDescription>
                Upload an Excel file with the columns from the template. Students will be created (if new), added to this batch, and auto-enrolled in every batch course with expiry = <b>{validityLabel}</b>.
              </AlertDescription>
            </Alert>
            <div>
              <Input type="file" accept=".xlsx,.xls,.csv"
                onChange={(e) => handleFile(e.target.files?.[0])} />
            </div>
            {rows.length > 0 && (
              <div>
                <div className="text-sm mb-2">
                  <span className="text-green-700">{rows.filter((r) => r._valid).length} valid</span>
                  {" · "}
                  <span className="text-destructive">{rows.filter((r) => !r._valid).length} invalid</span>
                </div>
                <div className="max-h-72 overflow-y-auto border rounded">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>#</TableHead><TableHead>Name</TableHead><TableHead>Email</TableHead>
                      <TableHead>Institution</TableHead><TableHead>Status</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {rows.map((r, i) => (
                        <TableRow key={i}>
                          <TableCell>{i + 1}</TableCell>
                          <TableCell>{r.full_name}</TableCell>
                          <TableCell>{r.email}</TableCell>
                          <TableCell>{r.institution ?? "—"}</TableCell>
                          <TableCell>
                            {r._valid ? <Badge variant="default">OK</Badge> : <Badge variant="destructive">{r._error}</Badge>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
            {importResult && (
              <Alert>
                <AlertDescription>
                  Created {importResult.created} student records. Failed: {importResult.failed}. Auto-enrolled in {courses.length} batch courses.
                </AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>Close</Button>
            <Button onClick={runImport} disabled={importing || !rows.some((r) => r._valid)}>
              {importing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Import {rows.filter((r) => r._valid).length} Students
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
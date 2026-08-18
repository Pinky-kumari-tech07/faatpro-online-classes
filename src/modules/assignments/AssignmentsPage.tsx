import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, FileText, Search, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/shared/hooks/useWorkspace";
import { useAuth } from "@/shared/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "@/components/ui/use-toast";
import PageHeader from "@/modules/shared/PageHeader";
import { useRealtimeInvalidate } from "@/shared/hooks/useRealtimeInvalidate";
import { CourseSelectItems } from "@/shared/components/CourseSelectItems";
import { useManageableCourses } from "@/shared/hooks/useManageableCourses";
import { AssignmentSubmitDialog as SubmitDialog } from "./AssignmentSubmitDialog";

function parseDdmmyyyy(s: string): Date | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s.trim());
  if (!m) return null;
  const d = Number(m[1]), mo = Number(m[2]), y = Number(m[3]);
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return dt;
}
function isoToDdmmyyyy(iso: string): string {
  const dt = new Date(iso);
  if (isNaN(dt.getTime())) return "";
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${dt.getFullYear()}`;
}

export default function AssignmentsPage() {
  const { membership, primaryRole } = useWorkspace();
  const { user } = useAuth();
  const wsId = membership!.workspace.id;
  const isStudent = primaryRole === "student";
  const canManage = ["organization_admin", "super_admin", "instructor"].includes(primaryRole ?? "");
  const qc = useQueryClient();

  useRealtimeInvalidate(
    ["assignments", "assignment_submissions", "enrollments", "course_instructors", "courses"],
    [["assignments"], ["courses-min-a"], ["manageable-courses"]],
  );

  const [searchParams, setSearchParams] = useSearchParams();
  const [courseFilter, setCourseFilter] = useState(searchParams.get("course") ?? "all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [gradeOpen, setGradeOpen] = useState<any>(null);
  const [submitOpen, setSubmitOpen] = useState<any>(null);
  const [deleting, setDeleting] = useState<any>(null);

  useEffect(() => {
    const c = searchParams.get("course");
    if (c && c !== courseFilter) setCourseFilter(c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (courseFilter && courseFilter !== "all") next.set("course", courseFilter);
    else next.delete("course");
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseFilter]);

  const manageableCoursesQuery = useManageableCourses({ enabled: !isStudent });
  const studentCoursesQuery = useQuery({
    queryKey: ["courses-min-a-student", wsId, user?.id],
    queryFn: async () => {
      const { data: enrolls, error: enrollError } = await supabase
        .from("enrollments").select("course_id")
        .eq("student_id", user!.id).neq("status", "expired");
      if (enrollError) throw enrollError;
      const ids = Array.from(new Set((enrolls ?? []).map((e: any) => e.course_id).filter(Boolean)));
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from("courses")
        .select("id, title, slug, status, visibility, instructor_id, workspace_id")
        .in("id", ids)
        .is("deleted_at", null)
        .order("title", { ascending: true });
      if (error) throw error;
      console.log(`[AssignmentsPage] student courses returned -> ${data?.length ?? 0}`);
      return data ?? [];
    },
    enabled: isStudent && !!user,
  });
  const courses = isStudent ? (studentCoursesQuery.data ?? []) : manageableCoursesQuery.courses;
  const coursesLoading = isStudent ? studentCoursesQuery.isLoading : manageableCoursesQuery.isLoading;
  const coursesError = isStudent ? studentCoursesQuery.error : manageableCoursesQuery.error;

  const { data: assignments } = useQuery({
    queryKey: ["assignments", wsId, primaryRole, user?.id, courseFilter, statusFilter, search, courses.map((c: any) => c.id).join(",")],
    enabled: !!user && !coursesLoading,
    queryFn: async () => {
      const courseIds = (courses ?? []).map((c: any) => c.id);
      let q = supabase.from("assignments").select("*, courses:course_id(title)");
      if (primaryRole === "instructor" || isStudent) {
        if (courseIds.length === 0) return [];
        q = q.in("course_id", courseIds);
        if (isStudent) q = q.eq("status", "published" as any);
      } else {
        q = q.eq("workspace_id", wsId);
      }
      if (courseFilter !== "all") q = q.eq("course_id", courseFilter);
      if (statusFilter !== "all") q = q.eq("status", statusFilter as any);
      if (search) q = q.ilike("title", `%${search}%`);
      const { data } = await q.order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6 max-w-7xl">
      <PageHeader
        title="Assignments"
        description={isStudent ? "Your assignments and submissions." : "Create, distribute and grade assignments."}
        actions={canManage && (
          <Button onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> New assignment
          </Button>
        )}
      />

      <Card className="p-4 border-border shadow-none">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search assignments…" className="pl-9" />
          </div>
          <Select value={courseFilter} onValueChange={setCourseFilter}>
            <SelectTrigger className="w-56"><SelectValue placeholder="All courses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All courses</SelectItem>
              <CourseSelectItems courses={courses} isLoading={coursesLoading} error={coursesError} />
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="published">Published</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="border-border shadow-none">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Assignment</TableHead>
              <TableHead>Course</TableHead>
              <TableHead>Due</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(assignments ?? []).map((a: any) => (
              <TableRow key={a.id}>
                <TableCell>
                  <div className="font-medium">{a.title}</div>
                  <div className="text-xs text-muted-foreground">{a.max_points} pts</div>
                </TableCell>
                <TableCell className="text-sm">{a.courses?.title ?? "—"}</TableCell>
                <TableCell className="text-sm">{a.due_at ? new Date(a.due_at).toLocaleDateString("en-GB") : "—"}</TableCell>
                <TableCell><Badge variant="secondary">{a.status}</Badge></TableCell>
                <TableCell className="text-right space-x-1">
                  {isStudent && a.status === "published" && (
                    <Button size="sm" variant="outline" onClick={() => setSubmitOpen(a)}>Submit</Button>
                  )}
                  {canManage && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => setGradeOpen(a)}>Submissions</Button>
                      <Button size="sm" variant="ghost" onClick={() => { setEditing(a); setOpen(true); }}>Edit</Button>
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleting(a)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {(assignments ?? []).length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" /> No assignments yet.
              </TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {open && <AssignmentDialog open={open} onOpenChange={setOpen} initial={editing} workspaceId={wsId} courses={courses} coursesLoading={coursesLoading} coursesError={coursesError} />}
      {gradeOpen && <GradingSheet assignment={gradeOpen} onClose={() => setGradeOpen(null)} workspaceId={wsId} />}
      {submitOpen && <SubmitDialog assignment={submitOpen} onClose={() => setSubmitOpen(null)} workspaceId={wsId} studentId={user!.id} />}
      <DeleteDialog deleting={deleting} onClose={() => setDeleting(null)} />
    </div>
  );
}

function DeleteDialog({ deleting, onClose }: { deleting: any; onClose: () => void }) {
  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: async () => {
      if (!deleting?.id) return;
      const { error } = await supabase.from("assignments").delete().eq("id", deleting.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Assignment deleted" });
      qc.invalidateQueries({ queryKey: ["assignments"] });
      onClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  return (
    <Dialog open={!!deleting} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete assignment?</DialogTitle>
          <DialogDescription>
            This will permanently remove <span className="font-medium">{deleting?.title}</span> and all its submissions. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" onClick={() => del.mutate()} disabled={del.isPending}>
            {del.isPending ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssignmentDialog({ open, onOpenChange, initial, workspaceId, courses, coursesLoading, coursesError }: any) {
  const qc = useQueryClient();
  const [form, setForm] = useState<any>({
    title: "", course_id: "", lesson_id: "", instructions: "",
    due_at: "", max_points: 100, allow_file_upload: true, status: "draft",
  });
  const [dueError, setDueError] = useState<string | null>(null);
  useEffect(() => {
    if (initial) setForm({ ...initial, due_at: initial.due_at ? isoToDdmmyyyy(initial.due_at) : "" });
    else setForm({ title: "", course_id: "", lesson_id: "", instructions: "", due_at: "", max_points: 100, allow_file_upload: true, status: "draft" });
    setDueError(null);
  }, [initial, open]);

  const save = useMutation({
    mutationFn: async () => {
      const selected = courses.find((c: any) => c.id === form.course_id);
      const targetWs = selected?.workspace_id ?? workspaceId;
      let dueIso: string | null = null;
      if (form.due_at) {
        const parsed = parseDdmmyyyy(form.due_at);
        if (!parsed) throw new Error("Please enter a valid date in DD/MM/YYYY format.");
        dueIso = parsed.toISOString();
      }
      const payload: any = {
        workspace_id: targetWs, course_id: form.course_id,
        lesson_id: form.lesson_id || null, title: form.title,
        instructions: form.instructions || null,
        due_at: dueIso,
        max_points: Number(form.max_points) || 100,
        allow_file_upload: !!form.allow_file_upload,
        status: form.status,
      };
      if (initial?.id) await supabase.from("assignments").update(payload).eq("id", initial.id);
      else await supabase.from("assignments").insert(payload);
    },
    onSuccess: () => {
      toast({ title: initial ? "Updated" : "Created" });
      qc.invalidateQueries({ queryKey: ["assignments"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>{initial ? "Edit assignment" : "New assignment"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Course</Label>
            <Select value={form.course_id} onValueChange={(v) => setForm({ ...form, course_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
              <SelectContent><CourseSelectItems courses={courses ?? []} isLoading={coursesLoading} error={coursesError} /></SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Instructions</Label><Textarea rows={4} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Due date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !form.due_at && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.due_at && parseDdmmyyyy(form.due_at)
                      ? format(parseDdmmyyyy(form.due_at)!, "dd/MM/yyyy")
                      : "DD/MM/YYYY"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={form.due_at ? parseDdmmyyyy(form.due_at) ?? undefined : undefined}
                    onSelect={(d) => {
                      setForm({ ...form, due_at: d ? isoToDdmmyyyy(d.toISOString()) : "" });
                      setDueError(null);
                    }}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              {form.due_at && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => { setForm({ ...form, due_at: "" }); setDueError(null); }}
                >
                  Clear
                </Button>
              )}
            </div>
            <div className="space-y-1.5"><Label>Max points</Label><Input type="number" value={form.max_points} onChange={(e) => setForm({ ...form, max_points: e.target.value })} /></div>
          </div>
          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <Label>Allow file upload</Label>
            <Switch checked={form.allow_file_upload} onCheckedChange={(v) => setForm({ ...form, allow_file_upload: v })} />
          </div>
          <div className="space-y-1.5"><Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={!form.title || !form.course_id || !!dueError}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GradingSheet({ assignment, onClose, workspaceId }: any) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["submissions", assignment.id],
    queryFn: async () => {
      const { data } = await supabase.from("assignment_submissions")
        .select("*, profiles:student_id(full_name)").eq("assignment_id", assignment.id);
      return data ?? [];
    },
  });
  const [grades, setGrades] = useState<Record<string, { grade: string; feedback: string }>>({});
  const grade = useMutation({
    mutationFn: async (sid: string) => {
      const g = grades[sid];
      await supabase.from("assignment_submissions").update({
        grade: Number(g.grade), feedback: g.feedback, graded_at: new Date().toISOString(),
      }).eq("id", sid);
    },
    onSuccess: () => { toast({ title: "Graded" }); qc.invalidateQueries({ queryKey: ["submissions", assignment.id] }); },
  });

  return (
    <Sheet open onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="sm:max-w-2xl overflow-y-auto">
        <SheetHeader><SheetTitle>Submissions · {assignment.title}</SheetTitle></SheetHeader>
        <div className="mt-6 space-y-3">
          {(data ?? []).map((s: any) => (
            <div key={s.id} className="p-4 border border-border rounded-md space-y-2">
              <div className="flex items-center justify-between">
                <div className="font-medium">{s.profiles?.full_name ?? "Student"}</div>
                <Badge variant="secondary">{s.graded_at ? "Graded" : "Pending"}</Badge>
              </div>
              {s.submission_text && <p className="text-sm whitespace-pre-wrap">{s.submission_text}</p>}
              {s.file_path && <a className="text-sm text-primary underline" href={s.file_path} target="_blank" rel="noreferrer">View file</a>}
              <div className="grid grid-cols-3 gap-2">
                <Input placeholder={`/${assignment.max_points}`} type="number" defaultValue={s.grade ?? ""}
                  onChange={(e) => setGrades({ ...grades, [s.id]: { grade: e.target.value, feedback: grades[s.id]?.feedback ?? s.feedback ?? "" } })} />
                <Input className="col-span-2" placeholder="Feedback" defaultValue={s.feedback ?? ""}
                  onChange={(e) => setGrades({ ...grades, [s.id]: { grade: grades[s.id]?.grade ?? String(s.grade ?? ""), feedback: e.target.value } })} />
              </div>
              <Button size="sm" onClick={() => grade.mutate(s.id)} disabled={!grades[s.id]}>Save grade</Button>
            </div>
          ))}
          {(data ?? []).length === 0 && <div className="text-sm text-muted-foreground text-center py-10">No submissions yet.</div>}
        </div>
      </SheetContent>
    </Sheet>
  );
}

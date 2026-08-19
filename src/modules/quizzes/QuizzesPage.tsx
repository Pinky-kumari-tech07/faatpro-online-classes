import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, ClipboardList, Search, Trash2, Copy, Eye, EyeOff, Pencil, Download, X, CheckCircle2, XCircle, Timer, FileText } from "lucide-react";
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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "@/components/ui/use-toast";
import PageHeader from "@/modules/shared/PageHeader";
import { useRealtimeInvalidate } from "@/shared/hooks/useRealtimeInvalidate";
import { CourseSelectItems } from "@/shared/components/CourseSelectItems";
import { useManageableCourses } from "@/shared/hooks/useManageableCourses";

type Question = {
  id?: string;
  question_type: "mcq" | "multi_select" | "true_false";
  prompt: string;
  options: string[];
  correct_answers: any[];
  points: number | string;
  explanation?: string | null;
};

const typeLabel = (t: string) =>
  t === "mcq" ? "MCQ" : t === "multi_select" ? "Multi-select" : "True / False";

export default function QuizzesPage() {
  const { membership, primaryRole } = useWorkspace();
  const { user } = useAuth();
  const wsId = membership!.workspace.id;
  const isStudent = primaryRole === "student";
  const canManage = ["organization_admin", "super_admin", "instructor"].includes(primaryRole ?? "");

  useRealtimeInvalidate(
    ["quizzes", "quiz_questions", "quiz_attempts", "enrollments", "course_instructors", "courses"],
    [["quizzes"], ["c-min-q"], ["manageable-courses"]],
  );

  const [searchParams, setSearchParams] = useSearchParams();
  const [course, setCourse] = useState(searchParams.get("course") ?? "all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest" | "title">("newest");
  const [editor, setEditor] = useState<any>(null);
  const [attemptQuiz, setAttemptQuiz] = useState<any>(null);
  const [resultsQuiz, setResultsQuiz] = useState<any>(null);
  const [deleteQuiz, setDeleteQuiz] = useState<any>(null);
  const qc = useQueryClient();

  useEffect(() => {
    const c = searchParams.get("course");
    if (c && c !== course) setCourse(c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (course && course !== "all") next.set("course", course);
    else next.delete("course");
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course]);

  const manageableCoursesQuery = useManageableCourses({ enabled: !isStudent });
  const studentCoursesQuery = useQuery({
    queryKey: ["c-min-q-student", wsId, user?.id],
    queryFn: async () => {
      const { data: enrolls, error: enrollError } = await supabase
        .from("enrollments").select("course_id").eq("student_id", user!.id).neq("status", "expired");
      if (enrollError) throw enrollError;
      const ids = Array.from(new Set((enrolls ?? []).map((e: any) => e.course_id).filter(Boolean)));
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from("courses")
        .select("id, title, slug, status, visibility, instructor_id, workspace_id, passing_percentage")
        .in("id", ids)
        .is("deleted_at", null)
        .order("title", { ascending: true });
      if (error) throw error;
      console.log(`[QuizzesPage] student courses returned -> ${data?.length ?? 0}`);
      return data ?? [];
    },
    enabled: isStudent && !!user,
  });
  const courses = isStudent ? (studentCoursesQuery.data ?? []) : manageableCoursesQuery.courses;
  const coursesLoading = isStudent ? studentCoursesQuery.isLoading : manageableCoursesQuery.isLoading;
  const coursesError = isStudent ? studentCoursesQuery.error : manageableCoursesQuery.error;

  const { data: quizzes } = useQuery({
    queryKey: ["quizzes", wsId, primaryRole, user?.id, course, status, search, sort, courses.map((c: any) => c.id).join(",")],
    enabled: !!user && !coursesLoading,
    queryFn: async () => {
      const courseIds = (courses ?? []).map((c: any) => c.id);
      let q = supabase.from("quizzes").select("*, courses:course_id(title, passing_percentage)");
      if (primaryRole === "instructor" || isStudent) {
        if (courseIds.length === 0) return [];
        q = q.in("course_id", courseIds);
        if (isStudent) q = q.eq("status", "published" as any);
      } else {
        q = q.eq("workspace_id", wsId);
      }
      if (course !== "all") q = q.eq("course_id", course);
      if (status !== "all") q = q.eq("status", status as any);
      if (search) q = q.ilike("title", `%${search}%`);
      if (sort === "title") q = q.order("title", { ascending: true });
      else q = q.order("created_at", { ascending: sort === "oldest" });
      const { data } = await q;
      return data ?? [];
    },
  });

  // load aggregate marks for each quiz
  const quizIds = useMemo(() => (quizzes ?? []).map((q: any) => q.id), [quizzes]);
  const { data: marksByQuiz } = useQuery({
    queryKey: ["quiz-marks", quizIds.join(",")],
    enabled: quizIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("quiz_questions").select("quiz_id, points").in("quiz_id", quizIds);
      const map: Record<string, { count: number; total: number }> = {};
      (data ?? []).forEach((r: any) => {
        const m = (map[r.quiz_id] ||= { count: 0, total: 0 });
        m.count += 1;
        m.total += Number(r.points) || 0;
      });
      return map;
    },
  });

  // student: attempts to know which quizzes already taken
  const { data: myAttempts } = useQuery({
    queryKey: ["my-attempts", user?.id, quizIds.join(",")],
    enabled: isStudent && quizIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("quiz_attempts")
        .select("quiz_id, score, max_score, percentage, passed, submitted_at")
        .eq("student_id", user!.id)
        .in("quiz_id", quizIds)
        .order("submitted_at", { ascending: false });
      return data ?? [];
    },
  });
  const bestByQuiz = useMemo(() => {
    const m: Record<string, any> = {};
    (myAttempts ?? []).forEach((a: any) => {
      const cur = m[a.quiz_id];
      if (!cur || Number(a.percentage ?? 0) > Number(cur.percentage ?? 0)) m[a.quiz_id] = a;
    });
    return m;
  }, [myAttempts]);

  const togglePublish = useMutation({
    mutationFn: async (q: any) => {
      const next = q.status === "published" ? "draft" : "published";
      const { error } = await supabase.from("quizzes").update({ status: next }).eq("id", q.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["quizzes"] }); toast({ title: "Quiz updated" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const duplicate = useMutation({
    mutationFn: async (q: any) => {
      const { data: src, error } = await supabase.from("quizzes").select("*").eq("id", q.id).single();
      if (error) throw error;
      const { id, created_at, updated_at, ...rest } = src as any;
      const { data: copy, error: insErr } = await supabase
        .from("quizzes")
        .insert({ ...rest, title: `${src.title} (Copy)`, status: "draft" })
        .select().single();
      if (insErr) throw insErr;
      const { data: qs } = await supabase.from("quiz_questions").select("*").eq("quiz_id", q.id);
      if (qs && qs.length) {
        const rows = qs.map((r: any) => {
          const { id: _i, ...rr } = r;
          return { ...rr, quiz_id: copy.id };
        });
        await supabase.from("quiz_questions").insert(rows);
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["quizzes"] }); toast({ title: "Quiz duplicated" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const del = useMutation({
    mutationFn: async (q: any) => {
      await supabase.from("quiz_questions").delete().eq("quiz_id", q.id);
      await supabase.from("quiz_attempts").delete().eq("quiz_id", q.id);
      const { error } = await supabase.from("quizzes").delete().eq("id", q.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["quizzes"] }); toast({ title: "Quiz deleted" }); setDeleteQuiz(null); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6 max-w-7xl">
      <PageHeader
        title="Quizzes"
        description={isStudent ? "Take quizzes for your courses." : "Build, publish and analyse quizzes."}
        actions={canManage && (
          <Button onClick={() => setEditor({ new: true })}>
            <Plus className="h-4 w-4 mr-1" /> New quiz
          </Button>
        )}
      />

      <Card className="p-4 border-border shadow-none">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search quizzes…" className="pl-9" />
          </div>
          <Select value={course} onValueChange={setCourse}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Course" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All courses</SelectItem>
              <CourseSelectItems courses={courses} isLoading={coursesLoading} error={coursesError} />
            </SelectContent>
          </Select>
          {!isStudent && (
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
              </SelectContent>
            </Select>
          )}
          <Select value={sort} onValueChange={(v: any) => setSort(v)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="oldest">Oldest first</SelectItem>
              <SelectItem value="title">By title</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="border-border shadow-none overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Quiz</TableHead>
              <TableHead>Course</TableHead>
              <TableHead>Questions</TableHead>
              <TableHead>Total marks</TableHead>
              <TableHead>Time limit</TableHead>
              <TableHead>Status</TableHead>
              {isStudent && <TableHead>Your best</TableHead>}
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(quizzes ?? []).map((q: any) => {
              const m = marksByQuiz?.[q.id];
              const best = bestByQuiz[q.id];
              const taken = !!best;
              return (
                <TableRow key={q.id}>
                  <TableCell className="font-medium">{q.title}</TableCell>
                  <TableCell className="text-sm">{q.courses?.title ?? "—"}</TableCell>
                  <TableCell className="text-sm">{m?.count ?? 0}</TableCell>
                  <TableCell className="text-sm">{m?.total ?? 0}</TableCell>
                  <TableCell className="text-sm">{q.time_limit_minutes ? `${q.time_limit_minutes} min` : "—"}</TableCell>
                  <TableCell>
                    <Badge variant={q.status === "published" ? "default" : "secondary"}>{q.status}</Badge>
                  </TableCell>
                  {isStudent && (
                    <TableCell className="text-sm">
                      {best ? (
                        <span className={best.passed ? "text-emerald-600 font-medium" : "text-destructive font-medium"}>
                          {Number(best.percentage ?? 0).toFixed(1)}%
                        </span>
                      ) : "—"}
                    </TableCell>
                  )}
                  <TableCell className="text-right space-x-1 whitespace-nowrap">
                    {isStudent && q.status === "published" && (
                      <Button size="sm" variant="outline" onClick={() => setAttemptQuiz(q)}
                        disabled={taken && !q.allow_retake}>
                        {taken ? (q.allow_retake ? "Retake" : "Completed") : "Take quiz"}
                      </Button>
                    )}
                    {canManage && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => togglePublish.mutate(q)} title={q.status === "published" ? "Unpublish" : "Publish"}>
                          {q.status === "published" ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => duplicate.mutate(q)} title="Duplicate">
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setResultsQuiz(q)} title="Results">
                          <FileText className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditor(q)} title="Edit">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setDeleteQuiz(q)} title="Delete">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {(quizzes ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={isStudent ? 8 : 7} className="text-center py-12 text-muted-foreground">
                  <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-50" /> No quizzes yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {editor && (
        <QuizEditor
          quiz={editor.new ? null : editor}
          workspaceId={wsId}
          courses={courses}
          coursesLoading={coursesLoading}
          coursesError={coursesError}
          onClose={() => setEditor(null)}
          onSaved={() => { qc.invalidateQueries({ queryKey: ["quizzes"] }); qc.invalidateQueries({ queryKey: ["quiz-marks"] }); }}
        />
      )}
      {attemptQuiz && (
        <AttemptDialog
          quiz={attemptQuiz}
          workspaceId={wsId}
          studentId={user!.id}
          onClose={() => { setAttemptQuiz(null); qc.invalidateQueries({ queryKey: ["my-attempts"] }); }}
        />
      )}
      {resultsQuiz && <ResultsSheet quiz={resultsQuiz} onClose={() => setResultsQuiz(null)} />}

      <AlertDialog open={!!deleteQuiz} onOpenChange={(v) => !v && setDeleteQuiz(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this quiz?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteQuiz?.title}</strong>? This will permanently remove the quiz, its questions and all student attempts. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteQuiz && del.mutate(deleteQuiz)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ===================== EDITOR ===================== */

function QuizEditor({ quiz, workspaceId, courses, coursesLoading, coursesError, onClose, onSaved }: any) {
  const [form, setForm] = useState<any>({
    title: "",
    course_id: "",
    description: "",
    instructions: "",
    time_limit_minutes: "",
    status: "draft",
    allow_retake: true,
  });
  const [questions, setQuestions] = useState<Question[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (quiz) {
      setForm({
        ...quiz,
        time_limit_minutes: quiz.time_limit_minutes ?? "",
        description: quiz.description ?? "",
        instructions: quiz.instructions ?? "",
        allow_retake: quiz.allow_retake ?? true,
      });
      supabase.from("quiz_questions").select("*").eq("quiz_id", quiz.id).order("position")
        .then(({ data }) => setQuestions((data ?? []) as any));
    }
  }, [quiz]);

  const totalMarks = useMemo(
    () => questions.reduce((s, q) => s + (Number(q.points) || 0), 0),
    [questions]
  );

  const validate = (): string[] => {
    const errs: string[] = [];
    if (!form.title?.trim()) errs.push("Quiz title is required.");
    if (!form.course_id) errs.push("Please select a course.");
    if (questions.length === 0) errs.push("Add at least one question.");
    questions.forEach((q, i) => {
      const label = `Question ${i + 1}`;
      if (!q.prompt?.trim()) errs.push(`${label}: question text is required.`);
      const pts = Number(q.points);
      if (!q.points || Number.isNaN(pts) || pts <= 0) errs.push(`${label}: marks must be greater than 0.`);
      if (q.question_type === "true_false") {
        if (q.correct_answers.length === 0) errs.push(`${label}: select True or False as the correct answer.`);
      } else {
        if (!q.options || q.options.length < 2) errs.push(`${label}: at least 2 options are required.`);
        if (q.options.some((o) => !o?.trim())) errs.push(`${label}: all options must have text.`);
        if (q.question_type === "mcq" && q.correct_answers.length !== 1) errs.push(`${label}: select exactly one correct answer.`);
        if (q.question_type === "multi_select" && q.correct_answers.length < 1) errs.push(`${label}: select at least one correct answer.`);
      }
    });
    return errs;
  };

  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: async () => {
      const errs = validate();
      setErrors(errs);
      if (errs.length) throw new Error(errs[0]);
      const selected = courses.find((c: any) => c.id === form.course_id);
      const targetWs = selected?.workspace_id ?? workspaceId;
      const payload: any = {
        workspace_id: targetWs,
        course_id: form.course_id,
        title: form.title.trim(),
        description: form.description?.trim() || null,
        instructions: form.instructions?.trim() || null,
        status: form.status,
        allow_retake: !!form.allow_retake,
        time_limit_minutes: form.time_limit_minutes ? Number(form.time_limit_minutes) : null,
      };
      let id = quiz?.id;
      if (id) {
        const { error } = await supabase.from("quizzes").update(payload).eq("id", id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("quizzes").insert(payload).select().single();
        if (error) throw error;
        id = data.id;
      }
      await supabase.from("quiz_questions").delete().eq("quiz_id", id);
      if (questions.length) {
        const rows = questions.map((q, i) => ({
          workspace_id: targetWs,
          quiz_id: id,
          question_type: q.question_type,
          prompt: q.prompt.trim(),
          options: q.question_type === "true_false" ? ["True", "False"] : q.options,
          correct_answers: q.correct_answers,
          points: Math.max(1, Math.floor(Number(q.points) || 1)),
          explanation: q.explanation?.trim() || null,
          position: i,
        }));
        const { error } = await supabase.from("quiz_questions").insert(rows);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast({ title: "Quiz saved" }); onSaved?.(); onClose(); },
    onError: (e: any) => toast({ title: "Cannot save quiz", description: e.message, variant: "destructive" }),
  });

  const addQuestion = (type: Question["question_type"]) =>
    setQuestions((prev) => [
      ...prev,
      {
        question_type: type,
        prompt: "",
        options: type === "true_false" ? ["True", "False"] : ["", ""],
        correct_answers: [],
        points: 1,
        explanation: "",
      },
    ]);

  const updateQ = (i: number, patch: Partial<Question>) =>
    setQuestions((prev) => prev.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl p-0 gap-0 h-[90vh] sm:h-[90vh] grid-rows-[auto_1fr_auto] grid">
        <DialogHeader className="px-6 pt-5 pb-4 border-b min-w-0">
          <DialogTitle className="flex items-center justify-between gap-3">
            <span>{quiz ? "Edit quiz" : "New quiz"}</span>
            <span className="text-sm font-normal text-muted-foreground">
              {questions.length} question{questions.length === 1 ? "" : "s"} · Total marks: <strong>{totalMarks}</strong>
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto px-6 py-5 pb-32 space-y-6 min-h-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 space-y-1.5">
              <Label>Title <span className="text-destructive">*</span></Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. SEO fundamentals quiz" />
            </div>
            <div className="space-y-1.5">
              <Label>Course <span className="text-destructive">*</span></Label>
              <Select value={form.course_id} onValueChange={(v) => setForm({ ...form, course_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
                <SelectContent>
                  <CourseSelectItems courses={courses ?? []} isLoading={coursesLoading} error={coursesError} />
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Time limit (minutes)</Label>
              <Input type="number" min={0} value={form.time_limit_minutes}
                onChange={(e) => setForm({ ...form, time_limit_minutes: e.target.value })}
                placeholder="Optional" />
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <Label>Description</Label>
              <Textarea rows={2} value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Short summary shown to students" />
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <Label>Instructions</Label>
              <Textarea rows={2} value={form.instructions ?? ""} onChange={(e) => setForm({ ...form, instructions: e.target.value })} placeholder="Rules and tips for students" />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 pt-7">
              <Checkbox id="retake" checked={!!form.allow_retake} onCheckedChange={(v) => setForm({ ...form, allow_retake: !!v })} />
              <Label htmlFor="retake" className="cursor-pointer">Allow students to retake</Label>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 sticky top-0 bg-background z-10 py-2 -mx-1 px-1 border-b">
              <Label className="text-base">Questions</Label>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => addQuestion("mcq")}><Plus className="h-3.5 w-3.5 mr-1" />MCQ</Button>
                <Button size="sm" variant="outline" onClick={() => addQuestion("multi_select")}><Plus className="h-3.5 w-3.5 mr-1" />Multi-select</Button>
                <Button size="sm" variant="outline" onClick={() => addQuestion("true_false")}><Plus className="h-3.5 w-3.5 mr-1" />True / False</Button>
              </div>
            </div>

            {questions.length === 0 && (
              <Card className="p-8 text-center text-sm text-muted-foreground border-dashed">
                No questions yet. Click MCQ, Multi-select or True / False above to add one.
              </Card>
            )}

            {questions.map((q, i) => (
              <Card key={i} className="p-4 space-y-3 border-border shadow-none">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground">Q{i + 1}</span>
                    <Badge variant="secondary">{typeLabel(q.question_type)}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs whitespace-nowrap">Marks</Label>
                      <Input className="w-20 h-8" type="number" min={1} value={q.points}
                        onChange={(e) => updateQ(i, { points: e.target.value })} />
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => setQuestions(questions.filter((_, j) => j !== i))}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                <Textarea rows={2} placeholder="Type the question…" value={q.prompt}
                  onChange={(e) => updateQ(i, { prompt: e.target.value })} />

                {q.question_type === "true_false" ? (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Correct answer</Label>
                    <RadioGroup
                      value={q.correct_answers[0] === true ? "true" : q.correct_answers[0] === false ? "false" : ""}
                      onValueChange={(v) => updateQ(i, { correct_answers: [v === "true"] })}
                      className="flex gap-6"
                    >
                      <label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="true" /> True</label>
                      <label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="false" /> False</label>
                    </RadioGroup>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label className="text-xs">
                      Options {q.question_type === "mcq" ? "(select the correct one)" : "(check all correct answers)"}
                    </Label>
                    {q.options.map((opt: string, oi: number) => (
                      <div key={oi} className="flex items-center gap-2">
                        {q.question_type === "mcq" ? (
                          <input
                            type="radio"
                            name={`q-${i}-correct`}
                            checked={String(q.correct_answers[0]) === String(oi)}
                            onChange={() => updateQ(i, { correct_answers: [oi] })}
                            className="h-4 w-4"
                          />
                        ) : (
                          <Checkbox
                            checked={q.correct_answers.includes(oi)}
                            onCheckedChange={(v) =>
                              updateQ(i, {
                                correct_answers: v
                                  ? [...q.correct_answers, oi]
                                  : q.correct_answers.filter((x: any) => x !== oi),
                              })
                            }
                          />
                        )}
                        <Input value={opt} placeholder={`Option ${oi + 1}`}
                          onChange={(e) => {
                            const next = [...q.options]; next[oi] = e.target.value;
                            updateQ(i, { options: next });
                          }} />
                        <Button size="icon" variant="ghost" disabled={q.options.length <= 2}
                          onClick={() => {
                            const next = q.options.filter((_, idx) => idx !== oi);
                            const ca = q.correct_answers
                              .filter((x: any) => x !== oi)
                              .map((x: any) => (typeof x === "number" && x > oi ? x - 1 : x));
                            updateQ(i, { options: next, correct_answers: ca });
                          }}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button size="sm" variant="outline" onClick={() => updateQ(i, { options: [...q.options, ""] })}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add option
                    </Button>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="text-xs">Explanation (optional)</Label>
                  <Textarea rows={2} placeholder="Shown to students during answer review"
                    value={q.explanation ?? ""} onChange={(e) => updateQ(i, { explanation: e.target.value })} />
                </div>
              </Card>
            ))}
          </div>

          {errors.length > 0 && (
            <Card className="border-destructive/50 bg-destructive/5 p-3 text-sm space-y-1">
              {errors.slice(0, 6).map((e, idx) => (<div key={idx} className="text-destructive">• {e}</div>))}
              {errors.length > 6 && <div className="text-destructive">…and {errors.length - 6} more.</div>}
            </Card>
          )}
        </div>

        <div className="px-6 py-4 border-t bg-background shadow-[0_-4px_12px_-8px_rgba(0,0,0,0.15)] z-10 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <div className="text-sm text-muted-foreground">
            Total marks: <strong className="text-foreground">{totalMarks}</strong>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={onClose} className="flex-1 sm:flex-none">Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending} className="flex-1 sm:flex-none">
              {save.isPending ? "Saving…" : "Save quiz"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ===================== ATTEMPT ===================== */

function AttemptDialog({ quiz, workspaceId, studentId, onClose }: any) {
  const { data: questions } = useQuery({
    queryKey: ["quiz-q", quiz.id],
    queryFn: async () =>
      (await supabase.from("quiz_questions").select("*").eq("quiz_id", quiz.id).order("position")).data ?? [],
  });
  const passingPct = quiz.courses?.passing_percentage ?? 40;

  const [started, setStarted] = useState(false);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [result, setResult] = useState<any>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (!started || result) return;
    if (!quiz.time_limit_minutes) return;
    setRemaining(quiz.time_limit_minutes * 60);
  }, [started, result, quiz.time_limit_minutes]);

  useEffect(() => {
    if (remaining == null || result) return;
    if (remaining <= 0) { submit.mutate(true); return; }
    timerRef.current = setTimeout(() => setRemaining((r) => (r ?? 0) - 1), 1000);
    return () => clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, result]);

  const submit = useMutation({
    mutationFn: async (auto?: boolean) => {
      let score = 0;
      let max = 0;
      let correctCount = 0;
      const review: any[] = [];
      (questions ?? []).forEach((q: any) => {
        max += q.points;
        const ans = answers[q.id];
        let isCorrect = false;
        if (q.question_type === "mcq") {
          isCorrect = String(ans) === String(q.correct_answers[0]);
        } else if (q.question_type === "true_false") {
          isCorrect = (ans === "true" || ans === true) === (q.correct_answers[0] === true || q.correct_answers[0] === "true");
        } else if (q.question_type === "multi_select") {
          const a = Array.isArray(ans) ? [...ans].map(String).sort() : [];
          const c = [...q.correct_answers].map(String).sort();
          isCorrect = a.length === c.length && a.every((v, i) => v === c[i]);
        }
        if (isCorrect) { score += q.points; correctCount += 1; }
        review.push({ question_id: q.id, is_correct: isCorrect, awarded: isCorrect ? q.points : 0, given: ans ?? null });
      });
      const { error } = await supabase.from("quiz_attempts").insert({
        workspace_id: workspaceId,
        quiz_id: quiz.id,
        student_id: studentId,
        answers,
        score,
        max_score: max,
        review_data: review,
      });
      if (error) throw error;
      const percentage = max > 0 ? Math.round((score / max) * 1000) / 10 : 0;
      const passed = percentage >= passingPct;
      return { score, max, percentage, passed, correctCount, total: (questions ?? []).length, auto: !!auto, review };
    },
    onSuccess: (r) => {
      setResult(r);
      toast({
        title: r.auto ? "Time's up — auto submitted" : r.passed ? `Passed · ${r.percentage}%` : `Did not pass · ${r.percentage}%`,
      });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60), sec = s % 60;
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  // Start screen
  if (!started && !result) {
    return (
      <Dialog open onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{quiz.title}</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            {quiz.description && <p className="text-muted-foreground">{quiz.description}</p>}
            {quiz.instructions && (
              <div className="rounded-md border border-border p-3 bg-muted/40">
                <div className="font-medium mb-1">Instructions</div>
                <div className="text-muted-foreground whitespace-pre-wrap">{quiz.instructions}</div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <Stat label="Questions" value={(questions ?? []).length} />
              <Stat label="Total marks" value={(questions ?? []).reduce((s: number, q: any) => s + (q.points || 0), 0)} />
              <Stat label="Time limit" value={quiz.time_limit_minutes ? `${quiz.time_limit_minutes} min` : "No limit"} />
              <Stat label="Pass mark" value={`${passingPct}%`} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={() => setStarted(true)} disabled={(questions ?? []).length === 0}>Start quiz</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Result + review
  if (result) {
    return (
      <Dialog open onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-3xl p-0 gap-0 h-[90vh] grid grid-rows-[auto_1fr_auto]">
          <DialogHeader className="px-6 pt-5 pb-4 border-b">
            <DialogTitle>{quiz.title} · Results</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto px-6 py-5 pb-24 space-y-5 min-h-0">
            <div className="text-center space-y-2 py-4">
              <div className="text-5xl font-bold">{result.percentage}%</div>
              <div className="text-muted-foreground">{result.score} / {result.max} marks · {result.correctCount} / {result.total} correct</div>
              <Badge variant={result.passed ? "default" : "destructive"} className="text-sm px-3 py-1">
                {result.passed ? "PASSED" : "FAILED"}
              </Badge>
              <div className="text-xs text-muted-foreground">Pass mark: {passingPct}%</div>
            </div>

            <div className="space-y-3">
              <h3 className="font-medium">Answer review</h3>
              {(questions ?? []).map((q: any, i: number) => {
                const r = result.review.find((x: any) => x.question_id === q.id);
                const correct = r?.is_correct;
                const renderAns = (ans: any) => {
                  if (ans == null || ans === "") return "—";
                  if (q.question_type === "true_false") return String(ans) === "true" ? "True" : "False";
                  if (q.question_type === "mcq") return q.options[Number(ans)] ?? "—";
                  if (q.question_type === "multi_select") {
                    return (Array.isArray(ans) ? ans : []).map((x: any) => q.options[Number(x)]).filter(Boolean).join(", ") || "—";
                  }
                  return String(ans);
                };
                const correctAns =
                  q.question_type === "true_false"
                    ? (q.correct_answers[0] === true ? "True" : "False")
                    : q.question_type === "mcq"
                      ? q.options[Number(q.correct_answers[0])]
                      : q.correct_answers.map((x: any) => q.options[Number(x)]).filter(Boolean).join(", ");
                return (
                  <Card key={q.id} className={`p-3 border ${correct ? "border-emerald-500/40 bg-emerald-500/5" : "border-destructive/40 bg-destructive/5"}`}>
                    <div className="flex items-start gap-2">
                      {correct ? <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5" /> : <XCircle className="h-5 w-5 text-destructive mt-0.5" />}
                      <div className="flex-1 space-y-1">
                        <div className="font-medium">{i + 1}. {q.prompt}</div>
                        <div className="text-sm"><span className="text-muted-foreground">Your answer:</span> {renderAns(r?.given)}</div>
                        {!correct && <div className="text-sm"><span className="text-muted-foreground">Correct answer:</span> {correctAns}</div>}
                        <div className="text-xs text-muted-foreground">Marks awarded: {r?.awarded ?? 0} / {q.points}</div>
                        {q.explanation && (
                          <div className="text-sm mt-1 p-2 rounded bg-muted/60 text-muted-foreground">
                            <strong className="text-foreground">Explanation:</strong> {q.explanation}
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
          <div className="px-6 py-4 border-t bg-background flex justify-end gap-2 shadow-[0_-4px_12px_-8px_rgba(0,0,0,0.15)]">
            <Button onClick={onClose}>Done</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Attempt screen
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl p-0 gap-0 h-[90vh] grid grid-rows-[auto_1fr_auto]">
        <DialogHeader className="px-6 pt-5 pb-4 border-b flex flex-row items-center justify-between gap-3 space-y-0">
          <DialogTitle>{quiz.title}</DialogTitle>
          {remaining != null && (
            <div className={`flex items-center gap-1.5 text-sm font-medium px-2.5 py-1 rounded-md ${remaining < 60 ? "bg-destructive/10 text-destructive" : "bg-muted"}`}>
              <Timer className="h-4 w-4" /> {fmtTime(remaining)}
            </div>
          )}
        </DialogHeader>
        <div className="overflow-y-auto px-6 py-5 pb-32 space-y-4 min-h-0">
          {(questions ?? []).map((q: any, i: number) => (
            <Card key={q.id} className="p-4 border-border shadow-none space-y-3">
              <div className="font-medium">
                {i + 1}. {q.prompt} <span className="text-xs text-muted-foreground font-normal">({q.points} pts)</span>
              </div>
              {q.question_type === "mcq" && (
                <RadioGroup value={answers[q.id] ?? ""} onValueChange={(v) => setAnswers({ ...answers, [q.id]: v })}>
                  {q.options.map((o: string, oi: number) => (
                    <label key={oi} className="flex items-center gap-2 cursor-pointer">
                      <RadioGroupItem value={String(oi)} /> <span>{o}</span>
                    </label>
                  ))}
                </RadioGroup>
              )}
              {q.question_type === "true_false" && (
                <RadioGroup value={answers[q.id] ?? ""} onValueChange={(v) => setAnswers({ ...answers, [q.id]: v })}>
                  <label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="true" /> True</label>
                  <label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="false" /> False</label>
                </RadioGroup>
              )}
              {q.question_type === "multi_select" && (
                <div className="space-y-1.5">
                  {q.options.map((o: string, oi: number) => {
                    const cur: number[] = answers[q.id] ?? [];
                    return (
                      <label key={oi} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox checked={cur.includes(oi)} onCheckedChange={(v) => {
                          setAnswers({ ...answers, [q.id]: v ? [...cur, oi] : cur.filter((x) => x !== oi) });
                        }} />
                        <span>{o}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </Card>
          ))}
        </div>
        <div className="px-6 py-4 border-t bg-background flex flex-col-reverse sm:flex-row sm:justify-end gap-2 shadow-[0_-4px_12px_-8px_rgba(0,0,0,0.15)] z-10">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">Cancel</Button>
          <Button onClick={() => submit.mutate(false)} disabled={submit.isPending} className="w-full sm:w-auto">
            {submit.isPending ? "Submitting…" : "Submit quiz"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}

/* ===================== RESULTS SHEET ===================== */

function ResultsSheet({ quiz, onClose }: any) {
  const { data } = useQuery({
    queryKey: ["quiz-attempts", quiz.id],
    queryFn: async () =>
      (
        await supabase
          .from("quiz_attempts")
          .select("*, profiles:student_id(full_name, email)")
          .eq("quiz_id", quiz.id)
          .order("submitted_at", { ascending: false })
      ).data ?? [],
  });

  const stats = useMemo(() => {
    const rows = data ?? [];
    if (rows.length === 0) return null;
    const pct = rows.map((r: any) => Number(r.percentage ?? 0));
    const passed = rows.filter((r: any) => r.passed === true).length;
    return {
      attempts: rows.length,
      avg: (pct.reduce((s, n) => s + n, 0) / pct.length).toFixed(1),
      high: Math.max(...pct).toFixed(1),
      low: Math.min(...pct).toFixed(1),
      passRate: ((passed / rows.length) * 100).toFixed(1),
    };
  }, [data]);

  const exportCsv = () => {
    const rows = data ?? [];
    const header = ["Student", "Email", "Score", "Max", "Percentage", "Status", "Submitted"];
    const lines = [header.join(",")].concat(
      rows.map((r: any) => [
        JSON.stringify(r.profiles?.full_name ?? ""),
        JSON.stringify(r.profiles?.email ?? ""),
        r.score, r.max_score,
        r.percentage ?? "",
        r.passed === true ? "Passed" : r.passed === false ? "Failed" : "",
        new Date(r.submitted_at).toISOString(),
      ].join(","))
    );
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${quiz.title.replace(/\s+/g, "_")}_results.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Sheet open onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="sm:max-w-2xl w-full overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between gap-3">
            <span>{quiz.title} · Results</span>
            <Button size="sm" variant="outline" onClick={exportCsv} disabled={!(data ?? []).length}>
              <Download className="h-4 w-4 mr-1" /> CSV
            </Button>
          </SheetTitle>
        </SheetHeader>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-4">
            <Stat label="Attempts" value={stats.attempts} />
            <Stat label="Avg %" value={`${stats.avg}%`} />
            <Stat label="Highest" value={`${stats.high}%`} />
            <Stat label="Lowest" value={`${stats.low}%`} />
            <Stat label="Pass rate" value={`${stats.passRate}%`} />
          </div>
        )}

        <Table className="mt-6">
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>%</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Submitted</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data ?? []).map((a: any) => (
              <TableRow key={a.id}>
                <TableCell>{a.profiles?.full_name ?? "—"}</TableCell>
                <TableCell className="font-semibold">{a.score}/{a.max_score}</TableCell>
                <TableCell>{a.percentage != null ? `${Number(a.percentage).toFixed(1)}%` : "—"}</TableCell>
                <TableCell>
                  {a.passed === true ? <span className="text-emerald-600 font-medium">Passed</span>
                    : a.passed === false ? <span className="text-destructive font-medium">Failed</span> : "—"}
                </TableCell>
                <TableCell className="text-sm">{new Date(a.submitted_at).toLocaleString()}</TableCell>
              </TableRow>
            ))}
            {(data ?? []).length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No attempts yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </SheetContent>
    </Sheet>
  );
}
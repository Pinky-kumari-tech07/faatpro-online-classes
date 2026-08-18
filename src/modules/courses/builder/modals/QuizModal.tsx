import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { toast } from "@/components/ui/use-toast";
import { Plus, Trash2, ImageIcon, Library, BookmarkPlus, Loader2, Upload, X, GripVertical, FileSpreadsheet, Download } from "lucide-react";
import RichTextEditor from "@/components/editor/RichTextEditor";
import QuizImportWizard, { downloadSampleCsv, downloadSampleXlsx } from "@/modules/quizzes/QuizImportWizard";
import * as XLSX from "xlsx";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";

type QType =
  | "mcq" | "multi_select" | "true_false"
  | "short_answer" | "long_answer" | "fill_blank"
  | "matching" | "ordering" | "numeric" | "image_choice" | "file_upload";

type Q = {
  id?: string;
  question_type: QType;
  prompt: string;
  options: any[];
  correct_answers: any;
  points: number;
  position: number;
  explanation?: string | null;
  hint?: string | null;
  difficulty?: string;
  tags?: string[];
  media_url?: string | null;
  media_type?: string | null;
};

const TYPE_LABELS: Record<QType, string> = {
  mcq: "Multiple choice (single)",
  multi_select: "Multiple choice (multi)",
  true_false: "True / False",
  short_answer: "Short answer",
  long_answer: "Long answer / Essay",
  fill_blank: "Fill in the blank",
  matching: "Matching",
  ordering: "Ordering / Sorting",
  numeric: "Numeric",
  image_choice: "Image choice",
  file_upload: "File upload",
};

function emptyQuestion(position: number, type: QType = "mcq"): Q {
  const base: Q = {
    question_type: type, prompt: "", options: [], correct_answers: [],
    points: 1, position, explanation: "", hint: "", difficulty: "medium", tags: [],
    media_url: null, media_type: null,
  };
  switch (type) {
    case "mcq": return { ...base, options: ["", ""], correct_answers: [0] };
    case "multi_select": return { ...base, options: ["", ""], correct_answers: [] };
    case "true_false": return { ...base, options: ["True", "False"], correct_answers: [0] };
    case "short_answer":
    case "fill_blank": return { ...base, correct_answers: [""] };
    case "long_answer":
    case "file_upload": return { ...base, correct_answers: [] };
    case "numeric": return { ...base, correct_answers: { value: 0, tolerance: 0 } };
    case "matching": return { ...base, correct_answers: [{ left: "", right: "" }, { left: "", right: "" }] };
    case "ordering": return { ...base, correct_answers: ["", ""] };
    case "image_choice": return { ...base, options: ["", ""], correct_answers: [0] };
    default: return base;
  }
}

const DEFAULT_FORM = {
  title: "", description: "", instructions: "",
  time_limit_minutes: 30, time_limit_unit: "minutes",
  hide_timer: false, auto_start: false,
  passing_percentage: 60, passing_marks: "",
  max_attempts: 3, allow_retake: true,
  random_pick: "", max_questions: "",
  feedback_mode: "after_submission",
  question_layout: "single_per_page",
  question_order: "sequential",
  shuffle_questions: false, shuffle_answers: false,
  show_question_number: true,
  allow_back_navigation: true, require_sequential_answering: false,
  show_result_immediately: true, show_score: true, show_correct_answers: true,
  show_detailed_feedback: true, show_question_explanation: true,
  auto_evaluate: true,
  security_settings: {
    full_screen: false, prevent_tab_switching: false, disable_copy_paste: false,
    disable_right_click: false, disable_text_selection: false,
    flag_suspicious_activity: false, track_focus_loss: false,
  },
  available_from: "", available_until: "",
  access_rules: { only_enrolled: true, prerequisite_course_id: null, minimum_progress_pct: null },
  proctoring_settings: { webcam: false, screen_recording: false, ai_proctoring: false },
  status: "draft",
};

function toLocalInput(v: any) {
  if (!v) return "";
  try {
    const d = new Date(v);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  } catch { return ""; }
}

export default function QuizModal({
  open, onOpenChange, workspaceId, courseId, sectionId, initial,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  workspaceId: string;
  courseId: string;
  sectionId?: string | null;
  initial: any | null;
}) {
  const qc = useQueryClient();
  const [importOpen, setImportOpen] = useState(false);
  const [errors, setErrors] = useState<{ title?: string; questions: Record<number, string> }>({ questions: {} });
  const [form, setForm] = useState<any>({
    title: "", description: "", instructions: "", time_limit_minutes: 30,
    passing_percentage: 60, max_attempts: 3, allow_retake: true,
    shuffle_questions: false, random_pick: "", auto_evaluate: true, status: "draft",
  });
  const [questions, setQuestions] = useState<Q[]>([]);

  useEffect(() => {
    if (initial) {
      setForm({
        title: initial.title ?? "", description: initial.description ?? "",
        instructions: initial.instructions ?? "",
        time_limit_minutes: initial.time_limit_minutes ?? 30,
        passing_percentage: initial.passing_percentage ?? 60,
        max_attempts: initial.max_attempts ?? 3,
        allow_retake: initial.allow_retake ?? true,
        shuffle_questions: initial.shuffle_questions ?? false,
        random_pick: initial.random_pick ?? "",
        auto_evaluate: initial.auto_evaluate ?? true,
        status: initial.status ?? "draft",
      });
    } else {
      setForm({
        title: "", description: "", instructions: "", time_limit_minutes: 30,
        passing_percentage: 60, max_attempts: 3, allow_retake: true,
        shuffle_questions: false, random_pick: "", auto_evaluate: true, status: "draft",
      });
      setQuestions([]);
    }
  }, [initial, open]);

  function validate(): { ok: boolean; titleErr?: string; qErrs: Record<number, string>; firstMsg?: string } {
    const qErrs: Record<number, string> = {};
    let titleErr: string | undefined;
    let firstMsg: string | undefined;
    if (!form.title?.trim()) {
      titleErr = "Quiz title is required";
      firstMsg = titleErr;
    }
    if (questions.length === 0) {
      firstMsg = firstMsg ?? "Add at least one question before saving";
    }
    questions.forEach((q, i) => {
      const label = `Question ${i + 1}`;
      if (!q.prompt?.trim()) {
        qErrs[i] = "Question text cannot be empty";
      } else if (!(Number(q.points) > 0)) {
        qErrs[i] = "Marks must be greater than 0";
      } else if (q.question_type === "mcq" || q.question_type === "true_false") {
        const opts = (q.options ?? []).map((o: any) => String(o ?? "").trim());
        const filled = opts.filter(Boolean);
        if (filled.length < 2) {
          qErrs[i] = "Provide at least 2 non-empty options";
        } else {
          const correctIdx = Array.isArray(q.correct_answers) ? q.correct_answers[0] : null;
          if (typeof correctIdx !== "number" || correctIdx < 0 || correctIdx >= opts.length || !opts[correctIdx]) {
            qErrs[i] = "Please select the correct answer";
          }
        }
      } else if (q.question_type === "short_answer" || q.question_type === "fill_blank") {
        const ca = typeof q.correct_answers === "string" ? q.correct_answers : (Array.isArray(q.correct_answers) ? q.correct_answers[0] : "");
        if (!String(ca ?? "").trim()) {
          qErrs[i] = "Provide a sample correct answer";
        }
      }
      if (qErrs[i] && !firstMsg) firstMsg = `${label}: ${qErrs[i]}`;
    });
    return { ok: !titleErr && Object.keys(qErrs).length === 0 && questions.length > 0, titleErr, qErrs, firstMsg };
  }

  function scrollToFirstError(qErrs: Record<number, string>) {
    const keys = Object.keys(qErrs);
    const target = keys.length ? document.getElementById(`quiz-q-${keys[0]}`) : document.getElementById("quiz-title-input");
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  useQuery({
    queryKey: ["quiz-questions-load", initial?.id],
    enabled: open && !!initial?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("quiz_questions")
        .select("*")
        .eq("quiz_id", initial.id)
        .order("position");
      setQuestions(
        (data ?? []).map((q: any) => ({
          id: q.id,
          question_type: q.question_type,
          prompt: q.prompt,
          options: Array.isArray(q.options) ? q.options : [],
          correct_answers: q.correct_answers,
          points: q.points ?? 1,
          position: q.position ?? 0,
        })),
      );
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const v = validate();
      setErrors({ title: v.titleErr, questions: v.qErrs });
      if (!v.ok) {
        scrollToFirstError(v.qErrs);
        throw new Error(v.firstMsg || "Please fix the highlighted fields");
      }
      const payload: any = {
        workspace_id: workspaceId,
        course_id: courseId,
        section_id: initial?.section_id ?? sectionId ?? null,
        title: form.title,
        description: form.description || null,
        instructions: form.instructions || null,
        time_limit_minutes: Number(form.time_limit_minutes) || null,
        passing_percentage: Number(form.passing_percentage) || 60,
        max_attempts: form.max_attempts === "" ? null : Number(form.max_attempts),
        allow_retake: !!form.allow_retake,
        shuffle_questions: !!form.shuffle_questions,
        random_pick: form.random_pick === "" ? null : Number(form.random_pick),
        auto_evaluate: !!form.auto_evaluate,
        status: form.status,
      };
      let quizId = initial?.id as string | undefined;
      if (quizId) {
        const { error } = await (supabase.from("quizzes") as any).update(payload).eq("id", quizId);
        if (error) throw new Error(`Could not update quiz: ${error.message}`);
      } else {
        const { data, error } = await (supabase.from("quizzes") as any).insert(payload).select("id").single();
        if (error) throw new Error(`Could not create quiz: ${error.message}`);
        quizId = data!.id;
      }
      // sync questions
      const existingIds = (questions.filter((q) => q.id).map((q) => q.id)) as string[];
      // delete removed questions on edit
      if (initial?.id) {
        let del = supabase.from("quiz_questions").delete().eq("quiz_id", quizId!);
        if (existingIds.length) del = del.not("id", "in", `(${existingIds.join(",")})`);
        const { error: delErr } = await del;
        if (delErr) throw new Error(`Could not remove old questions: ${delErr.message}`);
      }
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const qPayload: any = {
          workspace_id: workspaceId,
          quiz_id: quizId,
          question_type: q.question_type,
          prompt: q.prompt,
          options: q.question_type === "mcq" || q.question_type === "true_false" ? q.options : [],
          correct_answers: q.correct_answers,
          points: q.points || 1,
          position: i,
        };
        if (q.id) {
          const { error: uErr } = await supabase.from("quiz_questions").update(qPayload).eq("id", q.id);
          if (uErr) throw new Error(`Question ${i + 1} could not be updated: ${uErr.message}`);
        } else {
          const { error: iErr } = await supabase.from("quiz_questions").insert(qPayload);
          if (iErr) throw new Error(`Question ${i + 1} could not be saved: ${iErr.message}`);
        }
      }
    },
    onSuccess: () => {
      toast({ title: initial ? "Quiz updated" : "Quiz created" });
      qc.invalidateQueries({ queryKey: ["builder-curriculum", courseId] });
      setErrors({ questions: {} });
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: "Quiz not saved", description: e?.message || "Something went wrong", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{initial ? "Edit quiz" : "New quiz"}</DialogTitle></DialogHeader>
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>Quiz title</Label>
              <Input
                id="quiz-title-input"
                value={form.title}
                onChange={(e) => { setForm({ ...form, title: e.target.value }); if (errors.title) setErrors((p) => ({ ...p, title: undefined })); }}
                className={errors.title ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Description</Label>
              <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Duration (min)</Label>
              <Input type="number" value={form.time_limit_minutes} onChange={(e) => setForm({ ...form, time_limit_minutes: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Passing %</Label>
              <Input type="number" value={form.passing_percentage} onChange={(e) => setForm({ ...form, passing_percentage: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Max attempts</Label>
              <Input type="number" value={form.max_attempts ?? ""} onChange={(e) => setForm({ ...form, max_attempts: e.target.value })} placeholder="Unlimited" />
            </div>
            <div className="space-y-1.5">
              <Label>Random pick</Label>
              <Input type="number" value={form.random_pick ?? ""} onChange={(e) => setForm({ ...form, random_pick: e.target.value })} placeholder="All" />
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm"><Switch checked={form.shuffle_questions} onCheckedChange={(v) => setForm({ ...form, shuffle_questions: v })} /> Shuffle questions</label>
            <label className="flex items-center gap-2 text-sm"><Switch checked={form.auto_evaluate} onCheckedChange={(v) => setForm({ ...form, auto_evaluate: v })} /> Auto evaluation</label>
            <label className="flex items-center gap-2 text-sm"><Switch checked={form.allow_retake} onCheckedChange={(v) => setForm({ ...form, allow_retake: v })} /> Allow retake</label>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-base">Questions ({questions.length})</Label>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
                  <FileSpreadsheet className="h-4 w-4 mr-1" /> Import Questions
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline" disabled={questions.length === 0}>
                      <Download className="h-4 w-4 mr-1" /> Export
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Export this quiz</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => exportQuestions(questions, "csv", form.title)}>Download CSV</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportQuestions(questions, "xlsx", form.title)}>Download Excel</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Templates</DropdownMenuLabel>
                    <DropdownMenuItem onClick={downloadSampleCsv}>Sample CSV</DropdownMenuItem>
                    <DropdownMenuItem onClick={downloadSampleXlsx}>Sample Excel</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setQuestions((qs) => [...qs, emptyQuestion(qs.length)])}
                >
                  <Plus className="h-4 w-4 mr-1" /> Add question
                </Button>
              </div>
            </div>
            <div className="space-y-3">
              {questions.map((q, idx) => (
                <div key={idx} id={`quiz-q-${idx}`} className={`rounded-md border p-3 space-y-2 ${errors.questions[idx] ? "border-destructive" : "border-border"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium">Q{idx + 1}</div>
                    <div className="flex items-center gap-2">
                      <Select
                        value={q.question_type}
                        onValueChange={(v: any) =>
                          setQuestions((arr) => {
                            const a = [...arr];
                            a[idx] = {
                              ...a[idx],
                              question_type: v,
                              options: v === "true_false" ? ["True", "False"] : v === "mcq" ? ["", ""] : [],
                              correct_answers: v === "true_false" ? [0] : v === "mcq" ? [0] : "",
                            };
                            return a;
                          })
                        }
                      >
                        <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mcq">Multiple choice</SelectItem>
                          <SelectItem value="true_false">True / False</SelectItem>
                          <SelectItem value="short_answer">Short answer</SelectItem>
                          <SelectItem value="long_answer">Long answer</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        value={q.points}
                        className="h-8 w-16 text-xs"
                        onChange={(e) =>
                          setQuestions((arr) => {
                            const a = [...arr];
                            a[idx] = { ...a[idx], points: Number(e.target.value || 1) };
                            return a;
                          })
                        }
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => setQuestions((arr) => arr.filter((_, i) => i !== idx))}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  {errors.questions[idx] && (
                    <p className="text-xs text-destructive">❌ {errors.questions[idx]}</p>
                  )}
                  <Textarea
                    rows={2}
                    placeholder="Question prompt"
                    value={q.prompt}
                    onChange={(e) =>
                      setQuestions((arr) => {
                        const a = [...arr]; a[idx] = { ...a[idx], prompt: e.target.value }; return a;
                      })
                    }
                  />
                  {(q.question_type === "mcq" || q.question_type === "true_false") && (
                    <div className="space-y-2">
                      {q.options.map((opt, oi) => (
                        <div key={oi} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={`correct-${idx}`}
                            checked={Array.isArray(q.correct_answers) && q.correct_answers[0] === oi}
                            onChange={() =>
                              setQuestions((arr) => {
                                const a = [...arr]; a[idx] = { ...a[idx], correct_answers: [oi] }; return a;
                              })
                            }
                          />
                          <Input
                            value={opt}
                            placeholder={`Option ${oi + 1}`}
                            disabled={q.question_type === "true_false"}
                            onChange={(e) =>
                              setQuestions((arr) => {
                                const a = [...arr];
                                const opts = [...a[idx].options];
                                opts[oi] = e.target.value;
                                a[idx] = { ...a[idx], options: opts };
                                return a;
                              })
                            }
                          />
                          {q.question_type === "mcq" && q.options.length > 2 && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() =>
                                setQuestions((arr) => {
                                  const a = [...arr];
                                  a[idx] = { ...a[idx], options: a[idx].options.filter((_, i) => i !== oi) };
                                  return a;
                                })
                              }
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      ))}
                      {q.question_type === "mcq" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setQuestions((arr) => {
                              const a = [...arr]; a[idx] = { ...a[idx], options: [...a[idx].options, ""] }; return a;
                            })
                          }
                        >
                          <Plus className="h-3 w-3 mr-1" /> Option
                        </Button>
                      )}
                    </div>
                  )}
                  {(q.question_type === "short_answer" || q.question_type === "long_answer") && (
                    <Textarea
                      rows={q.question_type === "short_answer" ? 1 : 3}
                      placeholder="Sample correct answer (used for auto-eval if enabled)"
                      value={typeof q.correct_answers === "string" ? q.correct_answers : ""}
                      onChange={(e) =>
                        setQuestions((arr) => {
                          const a = [...arr]; a[idx] = { ...a[idx], correct_answers: e.target.value }; return a;
                        })
                      }
                    />
                  )}
                </div>
              ))}
              {questions.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-6 border border-dashed border-border rounded-md">
                  No questions yet. Click “Add question” to start the quiz.
                </div>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save quiz"}
          </Button>
        </DialogFooter>
        <QuizImportWizard
          open={importOpen}
          onOpenChange={setImportOpen}
          workspaceId={workspaceId}
          courseId={courseId}
          quizId={initial?.id ?? null}
          existingQuestions={questions.map((q) => ({ prompt: q.prompt }))}
          onImported={(added) => {
            setQuestions((qs) => {
              const next = [...qs];
              added.forEach((a, i) => {
                next.push({
                  question_type: a.question_type as any,
                  prompt: a.prompt,
                  options: a.options,
                  correct_answers: a.correct_answers,
                  points: a.points,
                  position: qs.length + i,
                  explanation: a.explanation ?? "",
                  difficulty: a.difficulty,
                  tags: a.tags,
                });
              });
              return next;
            });
            toast({ title: "Added to quiz", description: `${added.length} question(s) queued. Save the quiz to persist.` });
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function exportQuestions(questions: Q[], format: "csv" | "xlsx", title: string) {
  const header = ["Question", "Option A", "Option B", "Option C", "Option D", "Correct Answer", "Marks", "Difficulty", "Explanation"];
  const body = questions.map((q) => {
    const opts = Array.isArray(q.options) ? q.options.map((o: any) => String(o ?? "")) : [];
    const [a = "", b = "", c = "", d = ""] = opts;
    const correctIdx = Array.isArray(q.correct_answers) && typeof q.correct_answers[0] === "number" ? q.correct_answers[0] : -1;
    const correct = correctIdx >= 0 ? String.fromCharCode(65 + correctIdx) : "";
    return [q.prompt, a, b, c, d, correct, q.points ?? 1, q.difficulty ?? "medium", q.explanation ?? ""];
  });
  const rows = [header, ...body];
  const fname = (title || "quiz").replace(/[^a-z0-9-_]+/gi, "_");
  if (format === "csv") {
    const csv = rows.map((r) => r.map((c) => {
      const s = String(c ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${fname}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  } else {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Questions");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${fname}.xlsx`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }
}
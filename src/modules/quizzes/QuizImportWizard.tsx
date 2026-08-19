import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/use-toast";
import { UploadCloud, FileSpreadsheet, Download, AlertTriangle, CheckCircle2, X, Trash2, Edit3, SkipForward, ArrowRight, ArrowLeft, FileDown, Library } from "lucide-react";

type ParsedRow = {
  rowNumber: number;
  question: string;
  options: string[]; // filtered non-empty
  correctIndex: number; // -1 if invalid
  correctRaw: string;
  marks: number;
  difficulty: "easy" | "medium" | "hard";
  explanation?: string;
  category?: string;
  topic?: string;
  negativeMarks?: number;
  imageUrl?: string;
  errors: string[];
  status: "ok" | "warning" | "error" | "skipped";
  edited?: boolean;
};

const MAX_ROWS = 1000;
const MAX_BYTES = 20 * 1024 * 1024;

const SAMPLE_HEADERS = [
  "Question", "Option A", "Option B", "Option C", "Option D",
  "Correct Answer", "Marks", "Difficulty", "Explanation", "Category", "Topic", "Negative Marks", "Question Image URL",
];

const SAMPLE_ROWS = [
  ["What is GST?", "Goods and Services Tax", "General Sales Tax", "Government Service Tax", "None", "A", 2, "easy", "GST stands for Goods and Services Tax.", "Taxation", "Indirect Tax", 0, ""],
  ["Which planet is closest to the sun?", "Venus", "Mercury", "Earth", "Mars", "Mercury", 1, "easy", "Mercury is the innermost planet.", "Science", "Astronomy", 0, ""],
  ["2 + 2 = ?", "3", "4", "5", "6", "B", 1, "easy", "Basic addition.", "Math", "Arithmetic", 0, ""],
];

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

function toCsv(rows: (string | number)[][]) {
  return rows
    .map((r) => r.map((c) => {
      const s = String(c ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(","))
    .join("\n");
}

export function downloadSampleCsv() {
  const csv = toCsv([SAMPLE_HEADERS as any, ...SAMPLE_ROWS as any]);
  downloadBlob(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }), "quiz_import_sample.csv");
}

export function downloadSampleXlsx() {
  const ws = XLSX.utils.aoa_to_sheet([SAMPLE_HEADERS, ...SAMPLE_ROWS]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Questions");
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  downloadBlob(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "quiz_import_sample.xlsx");
}

function normalizeHeader(h: string) {
  return String(h ?? "").trim().toLowerCase().replace(/[\s_-]+/g, " ");
}

function parseCorrect(raw: string, options: string[]): number {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return -1;
  const letterMatch = /^[A-Za-z]$/.test(trimmed);
  if (letterMatch) {
    const idx = trimmed.toUpperCase().charCodeAt(0) - 65;
    return idx >= 0 && idx < options.length ? idx : -1;
  }
  const digitMatch = /^\d+$/.test(trimmed);
  if (digitMatch) {
    const idx = parseInt(trimmed, 10) - 1;
    return idx >= 0 && idx < options.length ? idx : -1;
  }
  const lower = trimmed.toLowerCase();
  const found = options.findIndex((o) => String(o).trim().toLowerCase() === lower);
  return found;
}

function parseSheet(rows: any[][]): ParsedRow[] {
  if (!rows.length) return [];
  const header = rows[0].map(normalizeHeader);
  const col = (name: string) => header.findIndex((h) => h === normalizeHeader(name));
  const iq = col("question");
  const iA = col("option a"), iB = col("option b"), iC = col("option c"), iD = col("option d");
  const iCorrect = col("correct answer");
  const iMarks = col("marks");
  const iDiff = col("difficulty");
  const iExpl = col("explanation");
  const iCat = col("category");
  const iTopic = col("topic");
  const iNeg = col("negative marks");
  const iImg = col("question image url");

  if (iq < 0 || iA < 0 || iB < 0 || iCorrect < 0) {
    throw new Error("Missing required columns. Required: Question, Option A, Option B, Correct Answer.");
  }

  const seenQuestions = new Set<string>();
  const out: ParsedRow[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const question = String(row[iq] ?? "").trim();
    if (!question && row.every((c) => c === undefined || c === null || String(c).trim() === "")) continue;

    const rawOptions = [row[iA], row[iB], iC >= 0 ? row[iC] : "", iD >= 0 ? row[iD] : ""]
      .map((v) => String(v ?? "").trim());
    const options = rawOptions.filter((o) => o !== "");
    const correctRaw = String(row[iCorrect] ?? "").trim();
    const correctIndex = parseCorrect(correctRaw, rawOptions.map((o) => o));
    const marks = Number(row[iMarks] ?? 1);
    const diffRaw = String(row[iDiff] ?? "medium").trim().toLowerCase();
    const difficulty = (["easy", "medium", "hard"].includes(diffRaw) ? diffRaw : "medium") as "easy" | "medium" | "hard";

    const errors: string[] = [];
    if (!question) errors.push("Question is blank");
    if (options.length < 2) errors.push("Minimum 2 options required");
    if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) errors.push("Duplicate options");
    if (correctIndex < 0) errors.push("Correct answer does not match any option");
    if (Number.isNaN(marks) || marks < 0) errors.push("Marks must be numeric");
    const key = question.toLowerCase();
    if (seenQuestions.has(key)) errors.push("Duplicate question in file");
    seenQuestions.add(key);

    out.push({
      rowNumber: r + 1,
      question,
      options: rawOptions, // keep A/B/C/D positions; blanks trimmed at import
      correctIndex,
      correctRaw,
      marks: Number.isFinite(marks) ? marks : 1,
      difficulty,
      explanation: iExpl >= 0 ? String(row[iExpl] ?? "").trim() : undefined,
      category: iCat >= 0 ? String(row[iCat] ?? "").trim() : undefined,
      topic: iTopic >= 0 ? String(row[iTopic] ?? "").trim() : undefined,
      negativeMarks: iNeg >= 0 ? Number(row[iNeg] ?? 0) : undefined,
      imageUrl: iImg >= 0 ? String(row[iImg] ?? "").trim() : undefined,
      errors,
      status: errors.length ? "error" : "ok",
    });

    if (out.length >= MAX_ROWS) break;
  }
  return out;
}

async function readFileToRows(file: File): Promise<any[][]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", raw: false });
  const first = wb.SheetNames[0];
  const ws = wb.Sheets[first];
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", blankrows: false }) as any[][];
}

type Step = 1 | 2 | 3 | 4;

export default function QuizImportWizard({
  open,
  onOpenChange,
  workspaceId,
  courseId,
  quizId,
  existingQuestions,
  onImported,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  workspaceId: string;
  courseId?: string;
  quizId?: string | null;
  existingQuestions: { prompt: string }[];
  onImported: (added: { question_type: string; prompt: string; options: string[]; correct_answers: number[]; points: number; explanation?: string; difficulty: string; tags: string[]; }[]) => void;
}) {
  const [step, setStep] = useState<Step>(1);
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [saveToBank, setSaveToBank] = useState(true);
  const [importIntoQuiz, setImportIntoQuiz] = useState(true);
  const [duplicateAction, setDuplicateAction] = useState<"skip" | "replace" | "keep_both">("skip");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: number; duplicates: number } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const existingPrompts = useMemo(
    () => new Set(existingQuestions.map((q) => (q.prompt || "").trim().toLowerCase())),
    [existingQuestions],
  );

  function reset() {
    setStep(1); setFile(null); setRows([]); setParseError(null); setResult(null); setProgress(0); setEditingRow(null);
  }

  async function handleFile(f: File) {
    setParseError(null);
    if (f.size > MAX_BYTES) { setParseError("File exceeds 20 MB limit."); return; }
    const lower = f.name.toLowerCase();
    if (!/\.(csv|xlsx|xls)$/.test(lower)) { setParseError("Only CSV, XLSX or XLS files are supported."); return; }
    setFile(f);
    try {
      const raw = await readFileToRows(f);
      const parsed = parseSheet(raw);
      if (!parsed.length) { setParseError("No data rows found."); return; }
      // mark duplicates against existing quiz
      parsed.forEach((r) => {
        if (existingPrompts.has(r.question.trim().toLowerCase()) && !r.errors.includes("Duplicate question in file")) {
          r.errors.push("Already exists in quiz");
          r.status = r.errors.some((e) => !e.includes("Already exists")) ? "error" : "warning";
        }
      });
      setRows(parsed);
      setStep(2);
    } catch (e: any) {
      setParseError(e.message ?? "Failed to parse file");
    }
  }

  const stats = useMemo(() => {
    const total = rows.length;
    const skipped = rows.filter((r) => r.status === "skipped").length;
    const errors = rows.filter((r) => r.status === "error").length;
    const warnings = rows.filter((r) => r.status === "warning").length;
    const ready = rows.filter((r) => r.status === "ok").length;
    return { total, skipped, errors, warnings, ready };
  }, [rows]);

  async function runImport() {
    if (!importIntoQuiz && !saveToBank) {
      toast({ title: "Select a destination", description: "Choose at least Quiz or Question Bank.", variant: "destructive" });
      return;
    }
    setIsImporting(true);
    setProgress(5);
    setStep(4);

    const valid = rows.filter((r) => r.status === "ok" || r.status === "warning");
    const toImport: ParsedRow[] = [];
    let dupCount = 0;
    for (const r of valid) {
      const isDup = existingPrompts.has(r.question.trim().toLowerCase());
      if (isDup) {
        dupCount++;
        if (duplicateAction === "skip") continue;
        // keep_both / replace: replace not implemented at RPC level here — treat both as "keep_both"
      }
      toImport.push(r);
    }

    setProgress(20);

    const built = toImport.map((r) => {
      // Trim options to non-empty when saving; preserve correctIndex mapping
      const nonEmpty: string[] = [];
      const indexMap: number[] = [];
      r.options.forEach((o, i) => { if (String(o).trim() !== "") { nonEmpty.push(String(o).trim()); indexMap.push(i); } });
      const newCorrect = Math.max(0, indexMap.indexOf(r.correctIndex));
      return {
        question_type: "mcq",
        prompt: r.question,
        options: nonEmpty,
        correct_answers: [newCorrect],
        points: r.marks || 1,
        explanation: r.explanation || null,
        difficulty: r.difficulty,
        tags: [r.category, r.topic].filter(Boolean) as string[],
      };
    });

    let bankInserted = 0;
    if (saveToBank && built.length) {
      // batch insert into question_bank in chunks of 200
      for (let i = 0; i < built.length; i += 200) {
        const chunk = built.slice(i, i + 200).map((q) => ({
          workspace_id: workspaceId,
          question_type: q.question_type as any,
          prompt: q.prompt,
          options: q.options,
          correct_answers: q.correct_answers,
          points: q.points,
          explanation: q.explanation,
          difficulty: q.difficulty,
          tags: q.tags,
        }));
        const { error } = await (supabase.from("question_bank") as any).insert(chunk);
        if (error) {
          toast({ title: "Bank insert failed", description: error.message, variant: "destructive" });
          break;
        }
        bankInserted += chunk.length;
        setProgress(20 + Math.round((i / Math.max(built.length, 1)) * 40));
      }
    }

    setProgress(70);

    if (importIntoQuiz && built.length) {
      onImported(built);
    }

    // audit log
    try {
      const { data: userData } = await supabase.auth.getUser();
      await (supabase.from("quiz_import_log") as any).insert({
        workspace_id: workspaceId,
        quiz_id: quizId ?? null,
        course_id: courseId ?? null,
        imported_by: userData?.user?.id,
        file_name: file?.name,
        total_rows: rows.length,
        imported_rows: built.length,
        skipped_rows: dupCount + rows.filter((r) => r.status === "skipped").length,
        error_rows: rows.filter((r) => r.status === "error").length,
        saved_to_bank: saveToBank,
        user_agent: navigator.userAgent,
        errors: rows.filter((r) => r.errors.length).map((r) => ({ row: r.rowNumber, question: r.question, reasons: r.errors })),
      });
    } catch { /* audit best-effort */ }

    setProgress(100);
    setResult({
      imported: built.length,
      skipped: rows.filter((r) => r.status === "skipped").length + (duplicateAction === "skip" ? dupCount : 0),
      errors: rows.filter((r) => r.status === "error").length,
      duplicates: dupCount,
    });
    setIsImporting(false);
    toast({ title: "Import complete", description: `${built.length} question(s) processed.` });
  }

  function downloadErrorReport() {
    const bad = rows.filter((r) => r.errors.length);
    const data = [
      ["Row Number", "Question", "Reason"],
      ...bad.map((r) => [r.rowNumber, r.question, r.errors.join("; ")]),
    ];
    downloadBlob(new Blob(["\uFEFF" + toCsv(data as any)], { type: "text/csv;charset=utf-8" }), "quiz_import_errors.csv");
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" /> Import Questions
          </DialogTitle>
          <DialogDescription>
            Bulk import questions from CSV or Excel. Max 20 MB, up to {MAX_ROWS} questions per file.
          </DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center gap-2 text-xs">
          {["Upload", "Preview", "Validation", "Import"].map((label, i) => {
            const n = (i + 1) as Step;
            const active = step === n;
            const done = step > n;
            return (
              <div key={label} className="flex items-center gap-2">
                <div className={`h-6 w-6 rounded-full flex items-center justify-center font-medium ${
                  done ? "bg-primary text-primary-foreground" : active ? "bg-primary/15 text-primary border border-primary" : "bg-muted text-muted-foreground"
                }`}>{i + 1}</div>
                <span className={active ? "font-medium" : "text-muted-foreground"}>{label}</span>
                {i < 3 && <ArrowRight className="h-3 w-3 text-muted-foreground mx-1" />}
              </div>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto pr-1 min-h-[300px]">
          {step === 1 && (
            <div className="space-y-4">
              <div
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-muted/40 transition"
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
              >
                <UploadCloud className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
                <div className="font-medium">Drag & drop CSV or Excel here</div>
                <div className="text-xs text-muted-foreground">or click to browse • Max 20 MB • UTF-8</div>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                />
              </div>
              {parseError && (
                <div className="rounded-md bg-destructive/10 border border-destructive/40 p-3 text-sm text-destructive flex gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5" /> {parseError}
                </div>
              )}
              <div className="flex gap-2 items-center pt-2 border-t">
                <span className="text-sm text-muted-foreground mr-auto">Not sure about the format?</span>
                <Button size="sm" variant="outline" onClick={downloadSampleCsv}><Download className="h-3.5 w-3.5 mr-1" /> Sample CSV</Button>
                <Button size="sm" variant="outline" onClick={downloadSampleXlsx}><Download className="h-3.5 w-3.5 mr-1" /> Sample Excel</Button>
              </div>
              <div className="text-xs text-muted-foreground">
                Required columns: <code>Question, Option A, Option B, Correct Answer</code>. Optional: Option C/D, Marks, Difficulty, Explanation, Category, Topic, Negative Marks, Question Image URL. Correct answer accepts A/B/C/D, 1–4, or the actual option text.
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline">Total: {stats.total}</Badge>
                <Badge className="bg-green-500/10 text-green-700 border-green-500/30">Ready: {stats.ready}</Badge>
                {stats.warnings > 0 && <Badge className="bg-amber-500/10 text-amber-700 border-amber-500/30">Warnings: {stats.warnings}</Badge>}
                {stats.errors > 0 && <Badge variant="destructive">Errors: {stats.errors}</Badge>}
                {stats.skipped > 0 && <Badge variant="secondary">Skipped: {stats.skipped}</Badge>}
                <div className="ml-auto text-xs text-muted-foreground">{file?.name}</div>
              </div>
              <div className="border rounded-md overflow-auto max-h-[45vh]">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Question</TableHead>
                      <TableHead className="w-56">Options</TableHead>
                      <TableHead className="w-32">Correct</TableHead>
                      <TableHead className="w-16">Marks</TableHead>
                      <TableHead className="w-24">Difficulty</TableHead>
                      <TableHead className="w-32">Status</TableHead>
                      <TableHead className="w-24 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r, idx) => (
                      <TableRow key={idx} className={r.status === "error" ? "bg-destructive/5" : r.status === "warning" ? "bg-amber-500/5" : r.status === "skipped" ? "opacity-50" : ""}>
                        <TableCell className="text-xs text-muted-foreground">{r.rowNumber}</TableCell>
                        <TableCell>
                          {editingRow === idx ? (
                            <Textarea
                              className="min-h-[60px] text-sm"
                              value={r.question}
                              onChange={(e) => setRows((rs) => rs.map((x, i) => i === idx ? { ...x, question: e.target.value, edited: true } : x))}
                            />
                          ) : (
                            <div className="text-sm max-w-md line-clamp-2">{r.question}</div>
                          )}
                          {r.errors.length > 0 && (
                            <div className="text-xs text-destructive mt-1">{r.errors.join(" • ")}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-xs space-y-0.5">
                            {r.options.map((o, i) => o && (
                              <div key={i} className={i === r.correctIndex ? "text-green-600 font-medium" : ""}>
                                {String.fromCharCode(65 + i)}. {o}
                              </div>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {r.correctIndex >= 0 ? String.fromCharCode(65 + r.correctIndex) : <span className="text-destructive">?</span>}
                          <div className="text-xs text-muted-foreground truncate max-w-[120px]">{r.correctRaw}</div>
                        </TableCell>
                        <TableCell className="text-sm">{r.marks}</TableCell>
                        <TableCell>
                          <Select value={r.difficulty} onValueChange={(v: any) => setRows((rs) => rs.map((x, i) => i === idx ? { ...x, difficulty: v, edited: true } : x))}>
                            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="easy">Easy</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="hard">Hard</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {r.status === "ok" && <Badge className="bg-green-500/10 text-green-700 border-green-500/30"><CheckCircle2 className="h-3 w-3 mr-1" />OK</Badge>}
                          {r.status === "warning" && <Badge className="bg-amber-500/10 text-amber-700 border-amber-500/30"><AlertTriangle className="h-3 w-3 mr-1" />Warning</Badge>}
                          {r.status === "error" && <Badge variant="destructive"><X className="h-3 w-3 mr-1" />Error</Badge>}
                          {r.status === "skipped" && <Badge variant="secondary"><SkipForward className="h-3 w-3 mr-1" />Skipped</Badge>}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7" title="Edit" onClick={() => setEditingRow(editingRow === idx ? null : idx)}>
                              <Edit3 className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" title="Skip" onClick={() => setRows((rs) => rs.map((x, i) => i === idx ? { ...x, status: x.status === "skipped" ? (x.errors.length ? "error" : "ok") : "skipped" } : x))}>
                              <SkipForward className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" title="Remove" onClick={() => setRows((rs) => rs.filter((_, i) => i !== idx))}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {stats.errors > 0 && (
                <Button size="sm" variant="outline" onClick={downloadErrorReport}>
                  <FileDown className="h-3.5 w-3.5 mr-1" /> Download error report
                </Button>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-3">
                <div className="rounded-md border p-3"><div className="text-2xl font-semibold">{stats.total}</div><div className="text-xs text-muted-foreground">Total rows</div></div>
                <div className="rounded-md border p-3"><div className="text-2xl font-semibold text-green-600">{stats.ready}</div><div className="text-xs text-muted-foreground">Ready</div></div>
                <div className="rounded-md border p-3"><div className="text-2xl font-semibold text-amber-600">{stats.warnings}</div><div className="text-xs text-muted-foreground">Warnings</div></div>
                <div className="rounded-md border p-3"><div className="text-2xl font-semibold text-destructive">{stats.errors}</div><div className="text-xs text-muted-foreground">Errors</div></div>
              </div>

              <div className="border rounded-md p-4 space-y-3">
                <div className="font-medium text-sm">Destination</div>
                <div className="flex flex-col gap-2 text-sm">
                  <label className="flex items-center gap-2">
                    <Checkbox checked={importIntoQuiz} onCheckedChange={(v) => setImportIntoQuiz(!!v)} />
                    Import directly into this quiz {quizId ? "" : "(will be added once quiz is saved)"}
                  </label>
                  <label className="flex items-center gap-2">
                    <Checkbox checked={saveToBank} onCheckedChange={(v) => setSaveToBank(!!v)} />
                    <Library className="h-3.5 w-3.5" /> Also save into Question Bank for reuse
                  </label>
                </div>
              </div>

              <div className="border rounded-md p-4 space-y-3">
                <div className="font-medium text-sm">If a duplicate question is found</div>
                <Select value={duplicateAction} onValueChange={(v: any) => setDuplicateAction(v)}>
                  <SelectTrigger className="w-full max-w-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="skip">Skip duplicates</SelectItem>
                    <SelectItem value="keep_both">Keep both</SelectItem>
                    <SelectItem value="replace">Replace (keep both for now)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {stats.errors > 0 && (
                <div className="rounded-md bg-amber-500/10 border border-amber-500/40 p-3 text-sm flex gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-600" />
                  <div>{stats.errors} row(s) have errors and will be skipped. Go back to fix or remove them.</div>
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4 py-4">
              {!result ? (
                <>
                  <div className="text-center text-sm text-muted-foreground">Importing questions…</div>
                  <Progress value={progress} />
                </>
              ) : (
                <div className="space-y-4">
                  <div className="text-center py-4">
                    <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-2" />
                    <div className="text-xl font-semibold">Import complete</div>
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    <div className="rounded-md border p-3 text-center">
                      <div className="text-2xl font-semibold text-green-600">{result.imported}</div>
                      <div className="text-xs text-muted-foreground">Imported</div>
                    </div>
                    <div className="rounded-md border p-3 text-center">
                      <div className="text-2xl font-semibold">{result.skipped}</div>
                      <div className="text-xs text-muted-foreground">Skipped</div>
                    </div>
                    <div className="rounded-md border p-3 text-center">
                      <div className="text-2xl font-semibold text-amber-600">{result.duplicates}</div>
                      <div className="text-xs text-muted-foreground">Duplicates</div>
                    </div>
                    <div className="rounded-md border p-3 text-center">
                      <div className="text-2xl font-semibold text-destructive">{result.errors}</div>
                      <div className="text-xs text-muted-foreground">Errors</div>
                    </div>
                  </div>
                  {result.errors > 0 && (
                    <div className="text-center">
                      <Button size="sm" variant="outline" onClick={downloadErrorReport}>
                        <FileDown className="h-3.5 w-3.5 mr-1" /> Download error report
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-3">
          {step === 1 && (
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          )}
          {step === 2 && (
            <>
              <Button variant="ghost" onClick={() => { setStep(1); setRows([]); setFile(null); }}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button onClick={() => setStep(3)} disabled={rows.length === 0}>
                Continue <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </>
          )}
          {step === 3 && (
            <>
              <Button variant="ghost" onClick={() => setStep(2)}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
              <Button onClick={runImport} disabled={isImporting || (stats.ready + stats.warnings) === 0}>
                Import {stats.ready + stats.warnings} question(s)
              </Button>
            </>
          )}
          {step === 4 && result && (
            <Button onClick={() => { reset(); onOpenChange(false); }}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
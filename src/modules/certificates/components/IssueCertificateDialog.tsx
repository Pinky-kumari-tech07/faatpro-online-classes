import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Award, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/components/ui/use-toast";
import { certificateService, settingsService } from "@/services/supabase";
import { CertificatePreview } from "./CertificatePreview";
import { CanvasRenderer } from "../canvas/CanvasRenderer";
import { useManageableCourses } from "@/shared/hooks/useManageableCourses";
import { CourseSelectItems } from "@/shared/components/CourseSelectItems";

function genCertNumber() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = ""; for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `CERT-${new Date().getFullYear()}-${s}`;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  workspaceId: string;
  templates: any[];
  onSaved: () => void;
}

export function IssueCertificateDialog({ open, onOpenChange, workspaceId, templates, onSaved }: Props) {
  const [courseId, setCourseId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [percentage, setPercentage] = useState<string>("100");
  const [completionDate, setCompletionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [certNumber, setCertNumber] = useState(genCertNumber());
  const [completion, setCompletion] = useState<any>(null);

  useEffect(() => {
    if (open) {
      setCourseId(""); setStudentId(""); setTemplateId("");
      setPercentage("100"); setCompletionDate(new Date().toISOString().slice(0, 10));
      setCertNumber(genCertNumber());
    }
  }, [open]);

  // Auto-select the default (or most recent) template once templates are loaded,
  // so the preview reflects the user's actual choice and the issued certificate
  // is persisted with an explicit template_id.
  useEffect(() => {
    if (!open || templateId || !templates?.length) return;
    const def = templates.find((t: any) => t.is_default) ?? templates[0];
    if (def?.id) setTemplateId(def.id);
  }, [open, templates, templateId]);

  const { courses: manageableCourses, isLoading: coursesLoading, error: coursesError } = useManageableCourses({ enabled: open });
  const { data: members } = useQuery({
    queryKey: ["cert-students", workspaceId],
    queryFn: () => settingsService.listMembers(workspaceId),
    enabled: open,
  });

  useEffect(() => {
    if (studentId && courseId) {
      certificateService.getCompletionStatus(studentId, courseId)
        .then((s) => {
          setCompletion(s);
          if (s?.completion_percentage != null) setPercentage(String(s.completion_percentage));
        })
        .catch(() => setCompletion(null));
    } else {
      setCompletion(null);
    }
  }, [studentId, courseId]);

  const tpl =
    templates.find((t: any) => t.id === templateId) ??
    templates.find((t: any) => t.is_default) ??
    templates[0];
  const student = (members ?? []).find((m: any) => m.profile_id === studentId);
  const course = manageableCourses.find((c: any) => c.id === courseId);
  const instructor = (members ?? []).find(
    (m: any) => m.profile_id === (course?.instructor_id ?? null)
  );

  const previewData = {
    student_name: student?.profiles?.full_name ?? "Student name",
    course_title: course?.title ?? "Course title",
    completion_date: completionDate,
    completion_percentage: Number(percentage) || 0,
    certificate_number: certNumber,
    verification_code: certNumber,
    issue_date: new Date(),
    instructor_name: instructor?.profiles?.full_name ?? "Instructor",
    academy_name: (tpl as any)?.workspace_name ?? "Academy",
    grade: Number(percentage) >= 90 ? "A+" : Number(percentage) >= 75 ? "A" : Number(percentage) >= 60 ? "B" : "C",
    batch: new Date().getFullYear().toString(),
    duration: (course as any)?.duration ?? "",
  };

  // Debug logs
  // eslint-disable-next-line no-console
  if (tpl) console.log("[IssueCertificate] template:", { id: (tpl as any)?.id, hasDesign: !!(tpl as any)?.design_json, design: (tpl as any)?.design_json });

  const mut = useMutation({
    mutationFn: () => certificateService.issue({
      workspace_id: course?.workspace_id ?? workspaceId, course_id: courseId, student_id: studentId,
      template_id: templateId || null,
      completion_percentage: Number(percentage) || 0,
      completion_date: new Date(completionDate).toISOString(),
      certificate_number: certNumber,
    }),
    onSuccess: () => { toast({ title: "Certificate issued" }); onSaved(); onOpenChange(false); },
    onError: (e: any) => {
      const msg = String(e?.message ?? "");
      if (msg.includes("course_not_complete")) {
        toast({
          title: "Course not complete",
          description: "This student has not finished all lessons, quizzes, and assignments for this course.",
          variant: "destructive",
        });
      } else {
        toast({ title: "Error", description: e.message, variant: "destructive" });
      }
    },
  });

  const canIssue = !!courseId && !!studentId && !!completion?.is_complete;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1100px] w-[95vw] max-h-[90vh] p-0 overflow-hidden gap-0 flex flex-col">
        <DialogHeader className="px-5 py-3 border-b">
          <DialogTitle className="flex items-center gap-2"><Award className="h-4 w-4 text-primary" /> Issue certificate</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] flex-1 overflow-hidden">
          <div className="bg-muted/30 overflow-auto grid place-items-center p-6">
            {tpl ? (
              (tpl as any).design_json ? (
                <CanvasRenderer
                  design={(tpl as any).design_json}
                  scale={0.5}
                  data={previewData}
                />
              ) : (
                <CertificatePreview template={tpl as any} scale={0.5} data={previewData} />
              )
            ) : (
              <div className="text-sm text-muted-foreground">Create a template first to see a preview.</div>
            )}
          </div>
          <ScrollArea className="border-l">
            <div className="p-5 space-y-4">
              <div>
                <Label>Course</Label>
                <Select value={courseId} onValueChange={setCourseId}>
                  <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
                  <SelectContent><CourseSelectItems courses={manageableCourses} isLoading={coursesLoading} error={coursesError} /></SelectContent>
                </Select>
              </div>
              <div>
                <Label>Student</Label>
                <Select value={studentId} onValueChange={setStudentId}>
                  <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
                  <SelectContent>
                    {(members ?? []).filter((m: any) => m.role === "student").map((m: any) => (
                      <SelectItem key={m.profile_id} value={m.profile_id}>{m.profiles?.full_name ?? m.profile_id.slice(0, 8)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Template</Label>
                <Select value={templateId} onValueChange={setTemplateId}>
                  <SelectTrigger><SelectValue placeholder="Use default" /></SelectTrigger>
                  <SelectContent>{templates.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Completion %</Label>
                  <Input type="number" min={0} max={100} value={percentage} onChange={(e) => setPercentage(e.target.value)} />
                </div>
                <div>
                  <Label>Completion date</Label>
                  <Input type="date" value={completionDate} onChange={(e) => setCompletionDate(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Certificate number</Label>
                <Input value={certNumber} onChange={(e) => setCertNumber(e.target.value)} className="font-mono" />
              </div>
              {courseId && studentId && completion && (
                <div className={`rounded-md border p-3 text-xs space-y-1 ${completion.is_complete ? "border-success/40 bg-success/5" : "border-destructive/40 bg-destructive/5"}`}>
                  <div className="flex items-center gap-2 font-medium">
                    {completion.is_complete
                      ? <><CheckCircle2 className="h-4 w-4 text-success" /> Course completed</>
                      : <><AlertCircle className="h-4 w-4 text-destructive" /> Completion requirements not met</>}
                  </div>
                  <div>Lessons: {completion.completed_lessons}/{completion.total_lessons}</div>
                  <div>Quizzes passed: {completion.passed_quizzes}/{completion.total_quizzes}</div>
                  <div>Assignments passed: {completion.passed_assignments}/{completion.total_assignments}</div>
                  {!completion.is_complete && (
                    <div className="pt-1 text-muted-foreground">Certificates can only be issued after 100% lessons, quizzes, and assignments are complete.</div>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
        <DialogFooter className="px-5 py-3 border-t">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => mut.mutate()} disabled={!canIssue || mut.isPending}>Issue certificate</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
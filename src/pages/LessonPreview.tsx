import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, ArrowRight, CheckCircle2, ChevronLeft, Clock, Edit, ExternalLink,
  FileText, Lock, MessageSquare, NotebookPen, PlayCircle, Video, Loader2, Download,
  Home, GraduationCap, Radio, User, Bookmark, Sparkles, Play, ListChecks,
  ClipboardList, FileSignature, Eye, Award,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { resolveStorageUrl } from "@/lib/storageUrl";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useAuth } from "@/shared/hooks/useAuth";
import { useWorkspace } from "@/shared/hooks/useWorkspace";
import { supabase } from "@/integrations/supabase/client";
import {
  learningService, studentNotesService, lessonAssetService, discussionService,
} from "@/services/supabase/learningService";
import { certificateService } from "@/services/supabase";
import { downloadCertificatePdf } from "@/modules/certificates/utils/downloadCertificate";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CertificatePreview } from "@/modules/certificates/components/CertificatePreview";
import { SecureVideoPlayer } from "@/shared/components/SecureVideoPlayer";
import { savePostLoginRedirect } from "@/lib/authRedirect";
import { AssignmentSubmitDialog } from "@/modules/assignments/AssignmentSubmitDialog";

function timeAgo(iso?: string) {
  if (!iso) return "";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24); if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function fmtTime(sec?: number | null) {
  const s = Math.max(0, Math.floor(sec ?? 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function isYouTube(u: string) { return /youtu\.?be/.test(u); }
function isVimeo(u: string) { return /vimeo\.com/.test(u); }
function toEmbed(u: string) {
  try {
    if (isYouTube(u)) {
      const url = new URL(u);
      let id = "";
      if (url.hostname.includes("youtu.be")) {
        id = url.pathname.replace(/^\//, "");
      } else if (url.pathname.startsWith("/embed/")) {
        id = url.pathname.replace("/embed/", "");
      } else if (url.pathname.startsWith("/shorts/")) {
        id = url.pathname.replace("/shorts/", "");
      } else {
        id = url.searchParams.get("v") ?? "";
      }
      if (!id) return u;
      const params = new URLSearchParams();
      const t = url.searchParams.get("t") ?? url.searchParams.get("start");
      if (t) {
        const m = /^(\d+)(s)?$/.exec(t);
        params.set("start", m ? m[1] : String(parseInt(t, 10) || 0));
      }
      const list = url.searchParams.get("list");
      if (list) params.set("list", list);
      const qs = params.toString();
      return `https://www.youtube.com/embed/${id}${qs ? `?${qs}` : ""}`;
    }
    if (isVimeo(u)) {
      const url = new URL(u);
      const id = url.pathname.replace(/^\//, "").split("/")[0];
      return id ? `https://player.vimeo.com/video/${id}` : u;
    }
  } catch {
    // fall through
  }
  return u;
}

function LessonIcon({ type }: { type: string }) {
  if (type === "video") return <PlayCircle className="h-3.5 w-3.5" />;
  if (type === "pdf") return <FileText className="h-3.5 w-3.5" />;
  if (type === "embed") return <ExternalLink className="h-3.5 w-3.5" />;
  return <NotebookPen className="h-3.5 w-3.5" />;
}

function ItemIcon({ kind, lessonType }: { kind: "lesson" | "quiz" | "assignment"; lessonType?: string }) {
  if (kind === "quiz") return <ClipboardList className="h-3.5 w-3.5" />;
  if (kind === "assignment") return <FileSignature className="h-3.5 w-3.5" />;
  return <LessonIcon type={lessonType ?? "text"} />;
}

export default function LessonPreviewPage() {
  const { lessonId } = useParams();
  const nav = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { membership } = useWorkspace();
  const qc = useQueryClient();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [activeTab, setActiveTab] = useState("notes");
  const [noteText, setNoteText] = useState("");
  const [resumed, setResumed] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [replyBody, setReplyBody] = useState("");
  const [newThreadTitle, setNewThreadTitle] = useState("");
  const [newThreadBody, setNewThreadBody] = useState("");
  const [openThreadId, setOpenThreadId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [certPreviewOpen, setCertPreviewOpen] = useState(false);
  const [certPreviewData, setCertPreviewData] = useState<any | null>(null);
  const [submitAssignment, setSubmitAssignment] = useState<any | null>(null);

  const lessonQ = useQuery({
    queryKey: ["learn-lesson", lessonId],
    enabled: !!lessonId,
    queryFn: () => learningService.getLessonWithCourse(lessonId!),
  });
  const lesson: any = lessonQ.data;
  const courseId = lesson?.course_id;
  const workspaceId = lesson?.workspace_id ?? membership?.workspace.id;

  const curriculumQ = useQuery({
    queryKey: ["learn-curriculum", courseId],
    enabled: !!courseId,
    queryFn: () => learningService.getCurriculum(courseId!),
  });

  const enrollmentQ = useQuery({
    queryKey: ["learn-enroll", user?.id, courseId],
    enabled: !!user?.id && !!courseId,
    queryFn: () => learningService.getEnrollment(user!.id, courseId!),
  });

  const progressQ = useQuery({
    queryKey: ["learn-progress", user?.id, lessonId],
    enabled: !!user?.id && !!lessonId,
    queryFn: () => learningService.getProgress(user!.id, lessonId!),
  });

  const allLessons = curriculumQ.data?.lessons ?? [];
  const lessonIds = useMemo(() => allLessons.map((l: any) => l.id), [allLessons]);
  const progressMapQ = useQuery({
    queryKey: ["learn-progress-map", user?.id, lessonIds.join(",")],
    enabled: !!user?.id && lessonIds.length > 0,
    queryFn: () => learningService.listLessonProgressForStudent(user!.id, lessonIds),
  });

  const notesQ = useQuery({
    queryKey: ["learn-notes", user?.id, lessonId],
    enabled: !!user?.id && !!lessonId,
    queryFn: () => studentNotesService.list(user!.id, lessonId!),
  });

  const assetsQ = useQuery({
    queryKey: ["learn-assets", lessonId],
    enabled: !!lessonId,
    queryFn: () => lessonAssetService.list(lessonId!),
  });

  const threadsQ = useQuery({
    queryKey: ["learn-threads", lessonId],
    enabled: !!lessonId,
    queryFn: () => discussionService.listForLesson(lessonId!),
  });

  const courseAssignmentsQ = useQuery({
    queryKey: ["learn-assignments", courseId],
    enabled: !!courseId,
    queryFn: async () => {
      const { data } = await supabase
        .from("assignments")
        .select("id, title, due_at, max_points, status, instructions, lesson_id, position, created_at")
        .eq("course_id", courseId!)
        .eq("status", "published")
        .order("position", { ascending: true })
        .order("created_at", { ascending: true });
      return data ?? [];
    },
  });

  const courseQuizzesQ = useQuery({
    queryKey: ["learn-quizzes", courseId],
    enabled: !!courseId,
    queryFn: async () => {
      const { data } = await supabase
        .from("quizzes")
        .select("id, title, time_limit_minutes, status, instructions, lesson_id, position, created_at")
        .eq("course_id", courseId!)
        .eq("status", "published")
        .order("position", { ascending: true })
        .order("created_at", { ascending: true });
      return data ?? [];
    },
  });

  // Student's quiz attempts (completion = any attempt exists)
  const quizAttemptsQ = useQuery({
    queryKey: ["learn-quiz-attempts", user?.id, courseId],
    enabled: !!user?.id && !!courseId && (courseQuizzesQ.data ?? []).length > 0,
    queryFn: async () => {
      const ids = (courseQuizzesQ.data ?? []).map((q: any) => q.id);
      if (!ids.length) return new Set<string>();
      const { data } = await supabase
        .from("quiz_attempts")
        .select("quiz_id")
        .eq("student_id", user!.id)
        .in("quiz_id", ids);
      return new Set((data ?? []).map((r: any) => r.quiz_id));
    },
  });

  // Student's assignment submissions
  const assignmentSubsQ = useQuery({
    queryKey: ["learn-assign-subs", user?.id, courseId],
    enabled: !!user?.id && !!courseId && (courseAssignmentsQ.data ?? []).length > 0,
    queryFn: async () => {
      const ids = (courseAssignmentsQ.data ?? []).map((a: any) => a.id);
      if (!ids.length) return new Set<string>();
      const { data } = await supabase
        .from("assignment_submissions")
        .select("assignment_id")
        .eq("student_id", user!.id)
        .in("assignment_id", ids);
      return new Set((data ?? []).map((r: any) => r.assignment_id));
    },
  });

  const threadAuthorIds = useMemo(
    () => Array.from(new Set((threadsQ.data ?? []).map((t: any) => t.author_id).filter(Boolean))),
    [threadsQ.data],
  );
  const authorsQ = useQuery({
    queryKey: ["learn-thread-authors", threadAuthorIds.join(",")],
    enabled: threadAuthorIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, avatar_url").in("id", threadAuthorIds as string[]);
      const map: Record<string, any> = {};
      (data ?? []).forEach((p: any) => { map[p.id] = p; });
      return map;
    },
  });

  const repliesQ = useQuery({
    queryKey: ["learn-replies", openThreadId],
    enabled: !!openThreadId,
    queryFn: () => discussionService.listReplies(openThreadId!),
  });
  const replyAuthorIds = useMemo(
    () => Array.from(new Set((repliesQ.data ?? []).map((r: any) => r.author_id).filter(Boolean))),
    [repliesQ.data],
  );
  const replyAuthorsQ = useQuery({
    queryKey: ["learn-reply-authors", replyAuthorIds.join(",")],
    enabled: replyAuthorIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, avatar_url").in("id", replyAuthorIds as string[]);
      const map: Record<string, any> = {};
      (data ?? []).forEach((p: any) => { map[p.id] = p; });
      return map;
    },
  });

  const sections = curriculumQ.data?.sections ?? [];
  const lessonsBySection = useMemo(() => {
    const map: Record<string, any[]> = { __none: [] };
    for (const l of allLessons) {
      const k = l.section_id ?? "__none";
      (map[k] ||= []).push(l);
    }
    return map;
  }, [allLessons]);

  const orderedLessons = useMemo(() => {
    const out: any[] = [];
    for (const s of sections) (lessonsBySection[s.id] ?? []).forEach((l) => out.push(l));
    (lessonsBySection.__none ?? []).forEach((l) => out.push(l));
    return out;
  }, [sections, lessonsBySection]);

  // Build unified items: lessons + attached quizzes/assignments grouped by parent lesson; orphans separate
  const quizzes = courseQuizzesQ.data ?? [];
  const assignments = courseAssignmentsQ.data ?? [];
  const attemptedQuizIds = quizAttemptsQ.data ?? new Set<string>();
  const submittedAssignIds = assignmentSubsQ.data ?? new Set<string>();

  const itemsByLesson = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const q of quizzes) {
      if (q.lesson_id) (map[q.lesson_id] ||= []).push({
        kind: "quiz", id: q.id, title: q.title, raw: q,
        completed: attemptedQuizIds.has(q.id),
      });
    }
    for (const a of assignments) {
      if (a.lesson_id) (map[a.lesson_id] ||= []).push({
        kind: "assignment", id: a.id, title: a.title, raw: a,
        completed: submittedAssignIds.has(a.id),
      });
    }
    Object.values(map).forEach((items) => items.sort((x, y) => ((x.raw.position ?? 0) - (y.raw.position ?? 0)) || String(x.raw.created_at ?? "").localeCompare(String(y.raw.created_at ?? ""))));
    return map;
  }, [quizzes, assignments, attemptedQuizIds, submittedAssignIds]);

  const orphanItems = useMemo(() => {
    const out: any[] = [];
    for (const q of quizzes) {
      if (!q.lesson_id) out.push({
        kind: "quiz", id: q.id, title: q.title, raw: q,
        completed: attemptedQuizIds.has(q.id),
      });
    }
    for (const a of assignments) {
      if (!a.lesson_id) out.push({
        kind: "assignment", id: a.id, title: a.title, raw: a,
        completed: submittedAssignIds.has(a.id),
      });
    }
    return out.sort((x, y) => ((x.raw.position ?? 0) - (y.raw.position ?? 0)) || String(x.raw.created_at ?? "").localeCompare(String(y.raw.created_at ?? "")));
  }, [quizzes, assignments, attemptedQuizIds, submittedAssignIds]);

  const currentIdx = orderedLessons.findIndex((l) => l.id === lessonId);
  const prevLesson = currentIdx > 0 ? orderedLessons[currentIdx - 1] : null;
  const nextLesson = currentIdx >= 0 && currentIdx < orderedLessons.length - 1 ? orderedLessons[currentIdx + 1] : null;

  const progressByLesson: Record<string, any> = {};
  (progressMapQ.data ?? []).forEach((p: any) => { progressByLesson[p.lesson_id] = p; });

  // Unified progress: lessons + quizzes + assignments
  const lessonsCompleted = orderedLessons.filter((l) => progressByLesson[l.id]?.is_completed).length;
  const quizzesCompleted = quizzes.filter((q: any) => attemptedQuizIds.has(q.id)).length;
  const assignmentsCompleted = assignments.filter((a: any) => submittedAssignIds.has(a.id)).length;
  const completedCount = lessonsCompleted + quizzesCompleted + assignmentsCompleted;
  const totalItems = orderedLessons.length + quizzes.length + assignments.length;
  const totalCount = totalItems || 1;
  const coursePct = Math.round((completedCount / totalCount) * 100);
  const contentLoaded = !curriculumQ.isLoading && !courseQuizzesQ.isLoading && !courseAssignmentsQ.isLoading && !quizAttemptsQ.isLoading && !assignmentSubsQ.isLoading;
  const courseCompleted = contentLoaded && totalItems > 0 &&
    orderedLessons.length > 0 &&
    lessonsCompleted >= orderedLessons.length &&
    quizzesCompleted >= quizzes.length &&
    assignmentsCompleted >= assignments.length;

  // ---- Certificate (auto-issue when course reaches 100%) ----
  // Authoritative, server-computed completion (lessons + passed quizzes + passed assignments).
  const completionStatusQ = useQuery({
    queryKey: ["course-completion-status", user?.id, courseId, completedCount, totalItems],
    enabled: !!user?.id && !!courseId && courseCompleted,
    queryFn: async () => certificateService.getCompletionStatus(user!.id, courseId!),
  });
  const serverComplete = !!(completionStatusQ.data as any)?.is_complete;
  // The lesson row carries the course's workspace, which is what the RPC expects.
  const certWorkspaceId = lesson?.workspace_id ?? workspaceId;
  const certQ = useQuery({
    queryKey: ["learn-cert", user?.id, courseId],
    enabled: !!user?.id && !!courseId,
    queryFn: async () => {
      const { data } = await supabase
        .from("certificates")
        .select("id, certificate_number, verification_code, issued_at, revoked_at")
        .eq("student_id", user!.id).eq("course_id", courseId!)
        // Revoked certificates must not count as issued, otherwise the player
        // shows a dead download link and never re-issues.
        .is("revoked_at", null)
        .order("issued_at", { ascending: false }).limit(1).maybeSingle();
      return data;
    },
  });
  const issuingRef = useRef(false);
  const [certIssuing, setCertIssuing] = useState(false);
  const [certError, setCertError] = useState<string | null>(null);
  const [certAttempt, setCertAttempt] = useState(0);
  const [downloading, setDownloading] = useState(false);
  useEffect(() => {
    // Authoritative eligibility comes from the server; the local percentage is
    // only a display heuristic (it counts attempts/submissions, the server
    // requires passes).
    if (!serverComplete || !user?.id || !certWorkspaceId || !courseId) return;
    if (certQ.isLoading || certQ.data || issuingRef.current) return;
    issuingRef.current = true;
    setCertIssuing(true);
    setCertError(null);
    (async () => {
      try {
        // Template is resolved server-side (course-assigned -> workspace default -> oldest)
        const { error: rpcErr } = await supabase.rpc("issue_self_certificate", {
          _workspace_id: certWorkspaceId,
          _course_id: courseId,
          _template_id: null,
          _completion_percentage: 100,
          _completion_date: new Date().toISOString(),
        });
        if (rpcErr) throw rpcErr;
        toast({ title: "🎉 Certificate issued!", description: "You can now download your certificate." });
        await qc.invalidateQueries({ queryKey: ["learn-cert", user.id, courseId] });
      } catch (e: any) {
        console.warn("cert issue failed", e?.message);
        const msg = String(e?.message ?? "");
        setCertError(msg || "Certificate generation failed. Please try again.");
        if (!msg.includes("course_not_complete") && !msg.includes("not_enrolled") && !msg.includes("enrollment_not_active")) {
          toast({
            title: "Certificate generation failed",
            description: e?.message || "Please refresh and try again.",
            variant: "destructive",
          });
        }
      } finally { issuingRef.current = false; setCertIssuing(false); }
    })();
  }, [serverComplete, user?.id, certWorkspaceId, courseId, certQ.data, certQ.isLoading, qc, certAttempt]);

  async function retryCertificate() {
    setCertError(null);
    await completionStatusQ.refetch();
    await certQ.refetch();
    setCertAttempt((n) => n + 1);
  }

  async function downloadCertificate() {
    if (!certQ.data?.id) return;
    setDownloading(true);
    try {
      await downloadCertificatePdf(certQ.data.id);
    } catch (e: any) {
      toast({ title: "Download failed", description: e?.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  }

  const savedProgress = progressQ.data?.progress_seconds ?? 0;
  const isCompleted = !!progressQ.data?.is_completed;
  const isEnrolled = !!enrollmentQ.data;
  const previewMode = !isEnrolled;

  const canSaveProgress = !!user?.id && !!workspaceId && !!lessonId;

  async function ensureEnrollment() {
    // Do NOT auto-create enrollment here. Enrollment must come from the
    // official Cart/Checkout/Payment flow (or admin/free enrollment).
    return enrollmentQ.data ?? null;
  }

  // ------------------------------------------------------------------
  // Access control — enforce login + enrollment/preview before rendering.
  // ------------------------------------------------------------------
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      const nextPath = window.location.pathname + window.location.search;
      savePostLoginRedirect(nextPath);
      const next = encodeURIComponent(nextPath);
      nav(`/auth/login?next=${next}`, { replace: true });
    }
  }, [authLoading, user, nav]);

  useEffect(() => {
    if (!user || !lesson) return;
    if (enrollmentQ.isLoading) return;
    if (isEnrolled) return;
    if (lesson.is_preview) return;
    const slug = lesson.courses?.slug;
    nav(slug ? `/courses/${slug}` : "/courses", { replace: true });
  }, [user, lesson, isEnrolled, enrollmentQ.isLoading, nav]);

  async function persistProgress(seconds: number, complete?: boolean, opts?: { silent?: boolean }) {
    if (!canSaveProgress) return;
    try {
      const enrollment = await ensureEnrollment();
      await learningService.saveProgress({
        workspace_id: workspaceId,
        lesson_id: lessonId!,
        student_id: user!.id,
        enrollment_id: enrollment?.id ?? enrollmentQ.data?.id ?? null,
        progress_seconds: Math.floor(seconds),
        is_completed: complete,
      });
      qc.invalidateQueries({ queryKey: ["learn-progress", user!.id, lessonId] });
      qc.invalidateQueries({ queryKey: ["learn-progress-map", user!.id] });
    } catch (e: any) {
      if (!opts?.silent) {
        toast({ title: "Couldn't save progress", description: e.message, variant: "destructive" });
      }
      throw e;
    }
  }

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    let lastSave = 0;
    const onTime = () => {
      setCurrentTime(el.currentTime);
      if (Date.now() - lastSave > 10000) {
        lastSave = Date.now();
        persistProgress(el.currentTime, undefined, { silent: true });
      }
      if (el.duration > 0 && el.currentTime / el.duration >= 0.9 && !isCompleted) {
        persistProgress(el.currentTime, true, { silent: true });
      }
    };
    const onPause = () => persistProgress(el.currentTime, undefined, { silent: true });
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("pause", onPause);
    const beforeUnload = () => persistProgress(el.currentTime, undefined, { silent: true });
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("pause", onPause);
      window.removeEventListener("beforeunload", beforeUnload);
      persistProgress(el.currentTime, undefined, { silent: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson?.id, isCompleted]);

  function resume() {
    const el = videoRef.current;
    if (el && savedProgress > 0) {
      el.currentTime = savedProgress;
      el.play();
      setResumed(true);
    }
  }

  async function markComplete() {
    try {
      await persistProgress(videoRef.current?.currentTime ?? savedProgress, true);
      toast({ title: "Lesson marked complete ✓" });
      if (nextLesson) {
        setTimeout(() => nav(`/lessons/${nextLesson.id}/preview`), 800);
      }
    } catch {
      /* error already toasted */
    }
  }

  async function addNote() {
    if (!user?.id || !workspaceId || !lesson || !noteText.trim()) return;
    try {
      await studentNotesService.create({
        workspace_id: workspaceId,
        student_id: user.id,
        course_id: lesson.course_id,
        lesson_id: lesson.id,
        timestamp_seconds: Math.floor(currentTime),
        body: noteText.trim(),
      });
      setNoteText("");
      qc.invalidateQueries({ queryKey: ["learn-notes", user.id, lesson.id] });
      toast({ title: "Note saved" });
    } catch (e: any) {
      toast({ title: "Couldn't save note", description: e.message, variant: "destructive" });
    }
  }

  function seekTo(sec: number) {
    const el = videoRef.current;
    if (el) { el.currentTime = sec; el.play(); }
  }

  async function createThread() {
    if (!user?.id || !workspaceId || !lesson || !newThreadTitle.trim()) return;
    try {
      await discussionService.createThread({
        workspace_id: workspaceId,
        course_id: lesson.course_id,
        lesson_id: lesson.id,
        author_id: user.id,
        title: newThreadTitle.trim(),
        body: newThreadBody.trim(),
      });
      setNewThreadTitle(""); setNewThreadBody("");
      qc.invalidateQueries({ queryKey: ["learn-threads", lesson.id] });
      toast({ title: "Discussion posted" });
    } catch (e: any) {
      toast({ title: "Couldn't post", description: e.message, variant: "destructive" });
    }
  }

  async function postReply(threadId: string) {
    if (!user?.id || !workspaceId || !replyText.trim()) return;
    try {
      await discussionService.createReply({
        workspace_id: workspaceId,
        discussion_id: threadId,
        author_id: user.id,
        body: replyText.trim(),
      });
      setReplyText("");
      qc.invalidateQueries({ queryKey: ["learn-replies", threadId] });
      qc.invalidateQueries({ queryKey: ["learn-threads", lesson?.id] });
    } catch (e: any) {
      toast({ title: "Couldn't reply", description: e.message, variant: "destructive" });
    }
  }

  if (lessonQ.isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-[1400px] mx-auto p-6 space-y-4">
          <Skeleton className="h-14 w-full rounded-2xl" />
          <div className="grid xl:grid-cols-[300px_minmax(0,1fr)] gap-6">
            <Skeleton className="h-[600px] rounded-2xl" />
            <Skeleton className="h-[600px] rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (lessonQ.error || !lesson) {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <Card className="p-8 text-center max-w-md">
          <h1 className="text-xl font-semibold">Lesson not found</h1>
          <p className="text-sm text-muted-foreground mt-1">This lesson may have been removed or you don't have access.</p>
          <Button className="mt-5" onClick={() => nav(-1)}><ArrowLeft className="h-4 w-4" /> Go back</Button>
        </Card>
      </div>
    );
  }

  const remainingSeconds = Math.max(0, (lesson.duration_seconds ?? 0) - Math.floor(currentTime));

  const sectionMeta = (s: any) => {
    const list = lessonsBySection[s.id] ?? [];
    let total = list.length;
    let done = list.filter((l: any) => progressByLesson[l.id]?.is_completed).length;
    for (const l of list) {
      const items = itemsByLesson[l.id] ?? [];
      total += items.length;
      done += items.filter((it) => it.completed).length;
    }
    return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
  };

  const defaultOpenSections: string[] = (() => {
    const open: string[] = [];
    for (const s of sections) {
      if ((lessonsBySection[s.id] ?? []).some((l: any) => l.id === lesson.id)) open.push(s.id);
    }
    if (open.length === 0 && sections[0]) open.push(sections[0].id);
    return open;
  })();

  const Curriculum = (
    <div className="h-full flex flex-col bg-card">
      <div className="p-5 border-b border-border">
        <div className="font-semibold text-[15px] leading-snug line-clamp-2">{lesson.courses?.title}</div>
        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <span>{completedCount} of {totalCount} items completed</span>
          <span className="font-semibold text-foreground tabular-nums">{coursePct}%</span>
        </div>
        <Progress value={coursePct} className="h-1.5 mt-2" />
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {sections.length === 0 && (lessonsBySection.__none?.length ?? 0) === 0 && (
          <div className="p-6 text-sm text-muted-foreground">No lessons yet.</div>
        )}
        <Accordion type="multiple" defaultValue={defaultOpenSections} className="space-y-1">
          {sections.map((s: any) => {
            const m = sectionMeta(s);
            return (
              <AccordionItem key={s.id} value={s.id} className="border-0">
                <AccordionTrigger className="px-3 py-2.5 hover:no-underline hover:bg-muted/60 rounded-lg [&[data-state=open]]:bg-muted/40">
                  <div className="flex-1 text-left">
                    <div className="text-sm font-semibold truncate">{s.title}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{m.done}/{m.total} · {m.pct}%</div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-1 pt-1">
                  <div className="space-y-0.5">
                    {(lessonsBySection[s.id] ?? []).map((l: any) => (
                      <Fragment key={l.id}>
                        <CurriculumRow l={l} currentId={lesson.id} progress={progressByLesson[l.id]} isEnrolled={isEnrolled} />
                        {(itemsByLesson[l.id] ?? []).map((it) => (
                          <ActivityRow key={`${it.kind}-${it.id}`} item={it} isEnrolled={isEnrolled} onOpenAssignment={setSubmitAssignment} />
                        ))}
                      </Fragment>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
        {(lessonsBySection.__none?.length ?? 0) > 0 && (
          <div className="mt-2">
            <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Other lessons</div>
            {lessonsBySection.__none!.map((l: any) => (
              <Fragment key={l.id}>
                <CurriculumRow l={l} currentId={lesson.id} progress={progressByLesson[l.id]} isEnrolled={isEnrolled} />
                {(itemsByLesson[l.id] ?? []).map((it) => (
                  <ActivityRow key={`${it.kind}-${it.id}`} item={it} isEnrolled={isEnrolled} onOpenAssignment={setSubmitAssignment} />
                ))}
              </Fragment>
            ))}
          </div>
        )}
        {orphanItems.length > 0 && (
          <div className="mt-2">
            <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Activities</div>
            {orphanItems.map((it) => (
              <ActivityRow key={`${it.kind}-${it.id}`} item={it} isEnrolled={isEnrolled} onOpenAssignment={setSubmitAssignment} />
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const courseHref = "/app/courses";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="max-w-[1400px] mx-auto px-3 sm:px-4 lg:px-6 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="xl:hidden h-9 w-9 shrink-0"><ListChecks className="h-4 w-4" /></Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-[340px] sm:w-[380px]">{Curriculum}</SheetContent>
            </Sheet>
            <button onClick={() => nav(courseHref)} className="hidden md:inline-flex text-sm items-center gap-1 text-muted-foreground hover:text-foreground shrink-0">
              <ChevronLeft className="h-4 w-4" /> Back to course
            </button>
            <div className="min-w-0">
              <div className="text-[10px] sm:text-[11px] uppercase tracking-wide text-muted-foreground truncate">{lesson.course_sections?.title || "Lesson"}</div>
              <div className="text-xs sm:text-sm font-semibold truncate">{lesson.title}</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <div className="hidden lg:flex items-center gap-2 mr-1 text-xs text-muted-foreground">
              <Progress value={coursePct} className="h-1.5 w-20 xl:w-28" />
              <span className="tabular-nums font-medium text-foreground">{coursePct}%</span>
            </div>
            <Button variant="outline" size="sm" disabled={!prevLesson} onClick={() => prevLesson && nav(`/lessons/${prevLesson.id}/preview`)} className="hidden md:inline-flex rounded-full">
              <ArrowLeft className="h-3.5 w-3.5" /> Previous
            </Button>
            <Button size="sm" disabled={!nextLesson} onClick={() => nextLesson && nav(`/lessons/${nextLesson.id}/preview`)} className="rounded-full">
              <span className="hidden sm:inline">Continue</span><span className="sm:hidden">Next</span> <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-3 sm:px-4 lg:px-6 py-3 sm:py-4 lg:py-5">
        <div className="grid grid-cols-1 xl:grid-cols-[260px_minmax(0,1fr)] 2xl:grid-cols-[280px_minmax(0,1fr)] gap-4 lg:gap-5">
          {/* Curriculum (desktop sticky) */}
          <aside className="hidden xl:block">
            <Card className="border-border shadow-[var(--shadow-sm)] overflow-hidden h-[calc(100vh-5rem)] sticky top-[68px] rounded-2xl">
              {Curriculum}
            </Card>
          </aside>

          {/* Center content */}
          <div className="space-y-3 sm:space-y-4 min-w-0">
            {/* Lesson title row */}
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl lg:text-2xl font-bold tracking-tight break-words">{lesson.title}</h1>
                <div className="mt-1 flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                  <span>{lesson.courses?.title}</span>
                  {lesson.duration_seconds > 0 && <><span>·</span><span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{Math.round(lesson.duration_seconds / 60)} min</span></>}
                  {lesson.is_preview && <Badge className="bg-primary/10 text-primary border-0" variant="secondary">Free preview</Badge>}
                  {previewMode && <Badge variant="outline">Preview mode</Badge>}
                </div>
              </div>
            </div>

            {/* Video player */}
            <Card className="border-border shadow-[var(--shadow-md)] overflow-hidden rounded-2xl">
              <PlayerArea
                lesson={lesson}
                videoRef={videoRef}
                savedProgress={savedProgress}
                onResume={resume}
                resumed={resumed}
              />
            </Card>

            {/* Mark Complete / Completed state */}
            <Card className="border-border shadow-[var(--shadow-sm)] rounded-xl p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              {isCompleted ? (
                <div className="flex items-center gap-2 text-success font-semibold text-sm">
                  <CheckCircle2 className="h-5 w-5" /> Lesson Completed
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Done with this lesson? Mark it complete to track progress.
                </div>
              )}
              <div className="flex items-center gap-2">
                {!isCompleted && user && (
                  <Button size="sm" onClick={markComplete} className="rounded-full h-9 px-4 text-xs">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Mark Complete
                  </Button>
                )}
                {nextLesson && (
                  <Button size="sm" variant={isCompleted ? "default" : "outline"} onClick={() => { nav(`/lessons/${nextLesson.id}/preview`); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="rounded-full h-9 px-4 text-xs">
                    Continue Lesson <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </Card>

            {/* Up next preview */}
            {nextLesson && !courseCompleted && (
              <Card className="border-border shadow-[var(--shadow-sm)] rounded-xl p-3 sm:p-3.5">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Up next</div>
                <button
                  onClick={() => { nav(`/lessons/${nextLesson.id}/preview`); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  className="flex items-center gap-3 w-full min-w-0 text-left group"
                >
                  <div className="h-12 w-16 rounded-lg bg-gradient-brand grid place-items-center shrink-0">
                    <Play className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate group-hover:text-primary transition-colors">{nextLesson.title}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 capitalize">{nextLesson.lesson_type}{nextLesson.duration_seconds ? ` · ${Math.round(nextLesson.duration_seconds / 60)} min` : ""}</div>
                  </div>
                </button>
              </Card>
            )}

            {/* Course completed */}
            {courseCompleted && (
              <Card className="border-border shadow-[var(--shadow-md)] rounded-xl p-5 text-center bg-gradient-to-br from-primary/5 to-success/5">
                <div className="text-3xl mb-1">🎉</div>
                <div className="font-bold text-lg">Course Completed</div>
                <div className="text-xs text-muted-foreground mt-1">Congratulations! You have completed all lessons, quizzes, and assignments.</div>
                <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
                  {certQ.data?.id ? (
                    <>
                      <Button size="sm" className="rounded-full" onClick={downloadCertificate} disabled={downloading}>
                        {downloading
                          ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Preparing…</>
                          : <><Download className="h-3.5 w-3.5" /> Download Certificate</>}
                      </Button>
                      <Button size="sm" variant="outline" className="rounded-full" onClick={() => nav("/app/certificates")}>
                        <Award className="h-3.5 w-3.5" /> View My Certificate
                      </Button>
                    </>
                  ) : certIssuing || certQ.isLoading || completionStatusQ.isFetching ? (
                    <Button size="sm" className="rounded-full" disabled>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating certificate…
                    </Button>
                  ) : (
                    <div className="space-y-2">
                      <div className="text-xs text-destructive">
                        {certError
                          ? "Certificate generation failed. Please try again."
                          : "Your certificate isn't ready yet."}
                      </div>
                      <Button size="sm" variant="outline" className="rounded-full" onClick={retryCertificate}>
                        Retry
                      </Button>
                    </div>
                  )}
                </div>
                {certQ.data?.certificate_number && (
                  <div className="text-[10px] font-mono text-muted-foreground mt-2">{certQ.data.certificate_number}</div>
                )}
              </Card>
            )}

            {/* Tabs */}
            <Card className="border-border shadow-[var(--shadow-sm)] rounded-xl overflow-hidden">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <div className="border-b border-border px-1 sm:px-2 overflow-x-auto scrollbar-none">
                  <TabsList className="bg-transparent h-10 p-0 gap-0.5 sm:gap-1 w-max min-w-full">
                    <TabTrigger value="overview" label="Overview" icon={<Sparkles className="h-3.5 w-3.5" />} />
                    <TabTrigger value="notes" label="Notes" icon={<NotebookPen className="h-3.5 w-3.5" />} />
                    <TabTrigger value="resources" label="Resources" icon={<FileText className="h-3.5 w-3.5" />} count={(assetsQ.data ?? []).length} />
                    <TabTrigger value="assignments" label="Assignments" icon={<ListChecks className="h-3.5 w-3.5" />} count={(courseAssignmentsQ.data ?? []).length} />
                    <TabTrigger value="quizzes" label="Quizzes" icon={<ListChecks className="h-3.5 w-3.5" />} count={(courseQuizzesQ.data ?? []).length} />
                    <TabTrigger value="discussion" label="Discussion" icon={<MessageSquare className="h-3.5 w-3.5" />} count={(threadsQ.data ?? []).length} />
                  </TabsList>
                </div>

                <TabsContent value="overview" className="p-3 sm:p-4 space-y-4 animate-fade-in m-0">
                  <div>
                    <h3 className="text-sm font-semibold">About this lesson</h3>
                    <p className="mt-1.5 text-sm text-muted-foreground whitespace-pre-line">
                      {lesson.content || lesson.courses?.summary || "In this lesson, you'll dive deeper into the key concepts and build practical understanding through guided walkthroughs."}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">What you'll learn</h3>
                    <ul className="mt-2 space-y-1.5 text-sm">
                      {["Understand the core ideas behind this lesson", "Apply techniques to real-world scenarios", "Best practices and common pitfalls to avoid"].map((t) => (
                        <li key={t} className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />{t}</li>
                      ))}
                    </ul>
                  </div>
                  {(assetsQ.data ?? []).length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold mb-2">Resources</h3>
                      <div className="grid sm:grid-cols-2 gap-2">
                        {(assetsQ.data ?? []).slice(0, 4).map((a: any) => <ResourceCard key={a.id} a={a} />)}
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="notes" className="p-3 sm:p-4 space-y-3 animate-fade-in m-0">
                  {user ? (
                    <div className="rounded-lg border border-border bg-muted/30 p-2.5">
                      <Textarea
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder="Write a note…"
                        rows={2}
                        className="border-0 bg-transparent focus-visible:ring-0 resize-none p-0"
                      />
                      <div className="flex items-center justify-between pt-1.5 border-t border-border/60 mt-1.5">
                        <div className="text-xs text-muted-foreground">Timestamp · <span className="font-mono">{fmtTime(currentTime)}</span></div>
                        <Button size="sm" onClick={addNote} disabled={!noteText.trim()} className="rounded-full h-7 px-3 text-xs">Save note</Button>
                      </div>
                    </div>
                  ) : <p className="text-sm text-muted-foreground">Sign in to take notes.</p>}
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {(notesQ.data ?? []).map((n: any) => (
                      <div key={n.id} className="rounded-lg border border-border p-2.5 hover:shadow-[var(--shadow-sm)] transition-all">
                        <button onClick={() => seekTo(n.timestamp_seconds ?? 0)} className="text-xs font-mono inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary hover:bg-primary/15">
                          <Play className="h-3 w-3" /> {fmtTime(n.timestamp_seconds)}
                        </button>
                        <div className="text-sm mt-1.5 whitespace-pre-line">{n.body}</div>
                      </div>
                    ))}
                    {(notesQ.data ?? []).length === 0 && (
                      <div className="flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground">
                        <NotebookPen className="h-4 w-4 opacity-50" />
                        No notes created yet.
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="resources" className="p-3 sm:p-4 animate-fade-in m-0">
                  {assetsQ.isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  <div className="grid sm:grid-cols-2 gap-2">
                    {(assetsQ.data ?? []).map((a: any) => <ResourceCard key={a.id} a={a} />)}
                  </div>
                  {!assetsQ.isLoading && (assetsQ.data ?? []).length === 0 && (
                    <div className="flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground">
                      <FileText className="h-4 w-4 opacity-50" />
                      Resources will appear here.
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="assignments" className="p-3 sm:p-4 space-y-2 animate-fade-in m-0">
                  {(courseAssignmentsQ.data ?? []).map((a: any) => (
                    <div key={a.id} className="flex items-start justify-between gap-3 rounded-lg border border-border p-3 hover:shadow-[var(--shadow-sm)] transition-all">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{a.title}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {a.max_points} pts{a.due_at ? ` · Due ${new Date(a.due_at).toLocaleDateString("en-GB")}` : ""}
                        </div>
                        {a.instructions && <div className="text-xs text-muted-foreground mt-1 line-clamp-2 whitespace-pre-line">{a.instructions}</div>}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full shrink-0"
                        disabled={!isEnrolled}
                        onClick={() => setSubmitAssignment(a)}
                      >
                        {submittedAssignIds.has(a.id) ? "View / update" : "Open"}
                      </Button>
                    </div>
                  ))}
                  {(courseAssignmentsQ.data ?? []).length === 0 && (
                    <div className="flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground">
                      <ListChecks className="h-4 w-4 opacity-50" />
                      No assignments for this course yet.
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="quizzes" className="p-3 sm:p-4 space-y-2 animate-fade-in m-0">
                  {(courseQuizzesQ.data ?? []).map((q: any) => (
                    <div key={q.id} className="flex items-start justify-between gap-3 rounded-lg border border-border p-3 hover:shadow-[var(--shadow-sm)] transition-all">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{q.title}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {q.time_limit_minutes ? `${q.time_limit_minutes} min` : "No time limit"}
                        </div>
                        {q.instructions && <div className="text-xs text-muted-foreground mt-1 line-clamp-2 whitespace-pre-line">{q.instructions}</div>}
                      </div>
                      <Button asChild size="sm" variant="outline" className="rounded-full shrink-0">
                        <Link to="/app/quizzes">Take</Link>
                      </Button>
                    </div>
                  ))}
                  {(courseQuizzesQ.data ?? []).length === 0 && (
                    <div className="flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground">
                      <ListChecks className="h-4 w-4 opacity-50" />
                      No quizzes for this course yet.
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="discussion" className="p-3 sm:p-4 space-y-3 animate-fade-in m-0">
                  {user && (
                    <div className="rounded-lg border border-border bg-muted/30 p-2.5 space-y-1.5">
                      <input
                        value={newThreadTitle}
                        onChange={(e) => setNewThreadTitle(e.target.value)}
                        placeholder="Start a discussion…"
                        className="w-full text-sm border-0 bg-transparent focus:outline-none px-1 py-1 font-medium placeholder:text-muted-foreground"
                      />
                      <Textarea rows={2} value={newThreadBody} onChange={(e) => setNewThreadBody(e.target.value)} placeholder="Add more context (optional)" className="border-0 bg-transparent focus-visible:ring-0 resize-none p-1" />
                      <div className="flex justify-end pt-1 border-t border-border/60">
                        <Button size="sm" onClick={createThread} disabled={!newThreadTitle.trim()} className="rounded-full h-7 px-3 text-xs">Post</Button>
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    {(threadsQ.data ?? []).map((t: any) => {
                      const author = authorsQ.data?.[t.author_id];
                      const name = author?.full_name || "User";
                      const initial = name.charAt(0).toUpperCase();
                      const expanded = openThreadId === t.id;
                      return (
                        <div key={t.id} className="rounded-lg border border-border p-3 hover:shadow-[var(--shadow-sm)] transition-all">
                          <div className="flex items-start gap-3">
                            {author?.avatar_url ? (
                              <img src={author.avatar_url} alt={name} className="h-8 w-8 rounded-full object-cover shrink-0" />
                            ) : (
                              <div className="h-8 w-8 rounded-full bg-gradient-brand grid place-items-center text-primary-foreground text-xs font-semibold shrink-0">{initial}</div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-semibold">{name}</span>
                                <span className="text-[11px] text-muted-foreground">{timeAgo(t.created_at)}</span>
                              </div>
                              <div className="text-sm font-semibold mt-0.5">{t.title}</div>
                              {t.body && <div className="text-xs text-muted-foreground mt-1 whitespace-pre-line">{t.body}</div>}
                              <button
                                onClick={() => { setOpenThreadId(expanded ? null : t.id); setReplyText(""); }}
                                className="text-[11px] text-primary hover:underline mt-2 inline-flex items-center gap-1"
                              >
                                <MessageSquare className="h-3 w-3" /> {expanded ? "Hide replies" : `${t.reply_count ?? 0} ${t.reply_count === 1 ? "reply" : "replies"} · Reply`}
                              </button>
                              {expanded && (
                                <div className="mt-3 space-y-2 border-l-2 border-border pl-3">
                                  {repliesQ.isLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                                  {(repliesQ.data ?? []).map((r: any) => {
                                    const ra = replyAuthorsQ.data?.[r.author_id];
                                    const rn = ra?.full_name || "User";
                                    return (
                                      <div key={r.id} className="flex items-start gap-2">
                                        {ra?.avatar_url ? (
                                          <img src={ra.avatar_url} alt={rn} className="h-6 w-6 rounded-full object-cover shrink-0" />
                                        ) : (
                                          <div className="h-6 w-6 rounded-full bg-muted grid place-items-center text-[10px] font-semibold shrink-0">{rn.charAt(0).toUpperCase()}</div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                          <div className="text-[11px] text-muted-foreground"><span className="font-semibold text-foreground">{rn}</span> · {timeAgo(r.created_at)}{r.is_instructor_answer && <span className="ml-1 text-primary">· Instructor</span>}</div>
                                          <div className="text-xs whitespace-pre-line mt-0.5">{r.body}</div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                  {!repliesQ.isLoading && (repliesQ.data ?? []).length === 0 && (
                                    <div className="text-[11px] text-muted-foreground">No replies yet.</div>
                                  )}
                                  {user && (
                                    <div className="flex items-center gap-2 pt-1">
                                      <input
                                        value={replyText}
                                        onChange={(e) => setReplyText(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === "Enter" && replyText.trim()) postReply(t.id); }}
                                        placeholder="Write a reply…"
                                        className="flex-1 text-xs border border-border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                                      />
                                      <Button size="sm" onClick={() => postReply(t.id)} disabled={!replyText.trim()} className="rounded-full h-7 px-3 text-xs">Reply</Button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {(threadsQ.data ?? []).length === 0 && (
                      <div className="flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground">
                        <MessageSquare className="h-4 w-4 opacity-50" />
                        Start the first discussion.
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </Card>

            {/* Course content (mobile-friendly accordion) */}
            <Card className="border-border shadow-[var(--shadow-sm)] rounded-2xl xl:hidden">
              <div className="flex items-center justify-between p-5 pb-3">
                <div className="font-semibold">Course content</div>
                <span className="text-xs text-muted-foreground">{completedCount}/{totalCount} · {coursePct}%</span>
              </div>
              <div className="px-2 pb-3">
                <Accordion type="multiple" defaultValue={defaultOpenSections}>
                  {sections.map((s: any) => {
                    const m = sectionMeta(s);
                    return (
                      <AccordionItem key={s.id} value={s.id} className="border-0">
                        <AccordionTrigger className="px-3 py-2.5 hover:no-underline hover:bg-muted/60 rounded-lg">
                          <div className="flex-1 text-left">
                            <div className="text-sm font-semibold">{s.title}</div>
                            <div className="text-[11px] text-muted-foreground">{m.done}/{m.total} · {m.pct}%</div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          {(lessonsBySection[s.id] ?? []).map((l: any) => (
                            <Fragment key={l.id}>
                              <CurriculumRow l={l} currentId={lesson.id} progress={progressByLesson[l.id]} isEnrolled={isEnrolled} />
                              {(itemsByLesson[l.id] ?? []).map((it) => (
                                <ActivityRow key={`${it.kind}-${it.id}`} item={it} isEnrolled={isEnrolled} onOpenAssignment={setSubmitAssignment} />
                              ))}
                            </Fragment>
                          ))}
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </div>
            </Card>
          </div>
        </div>
      </main>

      {submitAssignment && user?.id && workspaceId && (
        <AssignmentSubmitDialog
          assignment={submitAssignment}
          workspaceId={workspaceId}
          studentId={user.id}
          onClose={() => setSubmitAssignment(null)}
          onSubmitted={() => {
            qc.invalidateQueries({ queryKey: ["learn-assign-subs", user.id, courseId] });
            qc.invalidateQueries({ queryKey: ["course-completion-status"] });
            qc.invalidateQueries({ queryKey: ["learn-cert", user.id, courseId] });
          }}
        />
      )}

      <Dialog open={certPreviewOpen} onOpenChange={setCertPreviewOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Certificate Preview</DialogTitle>
          </DialogHeader>
          {certPreviewData && (
            <div className="flex flex-col items-center gap-4">
              <div className="overflow-auto max-h-[70vh] border rounded-md bg-muted/30 p-4">
                <CertificatePreview
                  template={certPreviewData.certificate_templates ?? {
                    name: "Default", title: "Certificate of Completion",
                    body_template: "This is to certify that {{student_name}} has successfully completed {{course_title}}.",
                    accent_color: "#6366f1", background_style: "modern_vertical",
                    show_qr: true, show_percentage: true, show_completion_date: true, show_certificate_number: true,
                  }}
                  data={{
                    student_name: certPreviewData.profiles?.full_name || "Student",
                    course_title: certPreviewData.courses?.title || "Course",
                    completion_date: certPreviewData.completion_date,
                    completion_percentage: certPreviewData.completion_percentage,
                    certificate_number: certPreviewData.certificate_number,
                    verification_code: certPreviewData.verification_code,
                    issue_date: certPreviewData.issued_at,
                    academy_name: certPreviewData.workspaces?.name || "Academy",
                  }}
                  scale={0.7}
                />
              </div>
              <Button
                onClick={async () => {
                  try {
                    toast({ title: "Preparing certificate…" });
                    await downloadCertificatePdf(certPreviewData.id);
                  } catch (e: any) {
                    toast({ title: "Download failed", description: e?.message || "Please try again.", variant: "destructive" });
                  }
                }}
              >
                <Download className="h-4 w-4 mr-1" /> Download PDF
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}

function TabTrigger({ value, label, icon, count }: { value: string; label: string; icon: React.ReactNode; count?: number }) {
  return (
    <TabsTrigger
      value={value}
      className="h-12 px-4 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary text-muted-foreground font-medium gap-1.5"
    >
      {icon}<span>{label}</span>
      {typeof count === "number" && count > 0 && <span className="ml-1 text-[10px] bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 tabular-nums">{count}</span>}
    </TabsTrigger>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
      <div className="text-sm font-semibold mt-0.5 tabular-nums">{value}</div>
    </div>
  );
}

function ResourceCard({ a }: { a: any }) {
  const type = (a.asset_type || "").toLowerCase();
  const color =
    type.includes("pdf") ? "text-rose-600 bg-rose-50" :
    type.includes("xls") || type.includes("sheet") ? "text-emerald-600 bg-emerald-50" :
    type.includes("doc") ? "text-blue-600 bg-blue-50" :
    type.includes("zip") ? "text-amber-600 bg-amber-50" :
    "text-primary bg-primary/10";
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border p-3 hover:shadow-[var(--shadow-sm)] transition-all">
      <div className={cn("h-10 w-10 rounded-lg grid place-items-center shrink-0", color)}>
        <FileText className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold truncate">{a.title || a.asset_type}</div>
        <div className="text-[11px] text-muted-foreground uppercase">{a.asset_type}{a.file_size ? ` · ${Math.round(a.file_size / 1024)} KB` : ""}</div>
      </div>
      {(a.public_url || a.storage_path) && (
        <Button
          size="icon"
          variant="ghost"
          className="h-9 w-9 rounded-full"
          onClick={async () => {
            const url = await resolveStorageUrl(a.storage_path || a.public_url, { bucket: "lesson-files" });
            if (url) window.open(url, "_blank", "noopener,noreferrer");
          }}
        >
          <Download className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

function MobileNavItem({ to, icon, label, active }: { to: string; icon: React.ReactNode; label: string; active?: boolean }) {
  return (
    <Link to={to} className={cn(
      "flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-xl transition-colors",
      active ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
    )}>
      {icon}
      <span className="text-[10px] font-medium">{label}</span>
    </Link>
  );
}

function CurriculumRow({ l, currentId, progress, isEnrolled }: { l: any; currentId: string; progress: any; isEnrolled: boolean }) {
  const isCurrent = l.id === currentId;
  const locked = !isEnrolled && !l.is_preview;
  return (
    <Link
      to={locked ? "#" : `/lessons/${l.id}/preview`}
      onClick={(e) => locked && e.preventDefault()}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 mx-1 my-0.5 rounded-lg text-sm transition-all",
        isCurrent
          ? "bg-primary/10 text-foreground ring-1 ring-primary/20 shadow-[var(--shadow-sm)]"
          : "hover:bg-muted/60 text-foreground/80",
        locked && "opacity-60 cursor-not-allowed",
      )}
    >
      <div className={cn("h-7 w-7 rounded-full grid place-items-center shrink-0",
        progress?.is_completed ? "bg-success text-success-foreground"
        : isCurrent ? "bg-primary text-primary-foreground"
        : "bg-muted text-muted-foreground")}>
        {progress?.is_completed ? <CheckCircle2 className="h-3.5 w-3.5" /> : <LessonIcon type={l.lesson_type} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className={cn("truncate", isCurrent && "font-semibold")}>{l.title}</div>
        <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
          <span className="capitalize">{l.lesson_type}</span>
          {l.duration_seconds > 0 && <><span>·</span><span>{Math.round(l.duration_seconds / 60)} min</span></>}
          {l.is_preview && <Badge variant="secondary" className="h-4 px-1.5 text-[9px] bg-primary/10 text-primary border-0">Free</Badge>}
        </div>
      </div>
      {locked
        ? <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        : isCurrent ? <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" /> : null}
    </Link>
  );
}

function ActivityRow({ item, isEnrolled, onOpenAssignment }: { item: { kind: "quiz" | "assignment"; id: string; title: string; completed: boolean; raw?: any }; isEnrolled: boolean; onOpenAssignment?: (a: any) => void }) {
  const to = item.kind === "quiz" ? "/app/quizzes" : "/app/assignments";
  const label = item.kind === "quiz" ? "Quiz" : "Assignment";
  const locked = !isEnrolled;
  const inner = (
    <>
      <div className={cn("h-7 w-7 rounded-full grid place-items-center shrink-0",
        item.completed ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground")}>
        {item.completed ? <CheckCircle2 className="h-3.5 w-3.5" /> : <ItemIcon kind={item.kind} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="truncate">{item.title}</div>
        <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
          <span>{label}</span>
          {item.completed && <><span>·</span><span className="text-success">Completed</span></>}
        </div>
      </div>
      {locked && <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
    </>
  );
  const rowClass = cn(
    "flex items-center gap-3 px-3 py-2.5 mx-1 my-0.5 rounded-lg text-sm transition-all hover:bg-muted/60 text-foreground/80 w-[calc(100%-0.5rem)] text-left",
    locked && "opacity-60 cursor-not-allowed",
  );

  // Assignments open inside the course player so the student keeps their place.
  if (item.kind === "assignment" && onOpenAssignment) {
    return (
      <button type="button" className={rowClass} disabled={locked} onClick={() => onOpenAssignment(item.raw)}>
        {inner}
      </button>
    );
  }
  return (
    <Link
      to={locked ? "#" : to}
      onClick={(e) => locked && e.preventDefault()}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 mx-1 my-0.5 rounded-lg text-sm transition-all hover:bg-muted/60 text-foreground/80",
        locked && "opacity-60 cursor-not-allowed",
      )}
    >
      {inner}
    </Link>
  );
}

function PlayerArea({
  lesson, videoRef, savedProgress, onResume, resumed,
}: {
  lesson: any;
  videoRef: React.RefObject<HTMLVideoElement>;
  savedProgress: number;
  onResume: () => void;
  resumed: boolean;
}) {
  const url = lesson.asset_url as string | null;

  if (lesson.lesson_type === "video") {
    return (
      <div className="relative bg-black w-full aspect-video min-h-[240px] sm:min-h-0 max-h-[650px] mx-auto overflow-hidden">
        {url ? (
          <SecureVideoPlayer
            url={url}
            videoRef={videoRef}
            courseId={lesson.course_id}
            lessonId={lesson.id}
            workspaceId={lesson.workspace_id}
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-white/80">
            <div className="text-center">
              <Video className="h-10 w-10 mx-auto opacity-60" />
              <div className="mt-2 text-sm">No video source added yet</div>
              <Button asChild size="sm" variant="secondary" className="mt-3">
                <Link to="/app/lessons"><Edit className="h-3.5 w-3.5" /> Edit lesson</Link>
              </Button>
            </div>
          </div>
        )}
        {url && !isYouTube(url) && !isVimeo(url) && savedProgress > 0 && !resumed && (
          <button onClick={onResume} className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-2 rounded-full text-sm font-medium shadow-lg hover:bg-primary/90">
            Resume from {fmtTime(savedProgress)}
          </button>
        )}
      </div>
    );
  }

  if (lesson.lesson_type === "pdf") {
    if (!url) {
      return (
        <div className="p-8 bg-muted/20 min-h-[320px] grid place-items-center">
          <div className="text-sm text-muted-foreground text-center">
            No PDF attached yet.
            <div className="mt-3"><Button asChild size="sm" variant="outline"><Link to="/app/lessons"><Edit className="h-3.5 w-3.5" /> Edit lesson</Link></Button></div>
          </div>
        </div>
      );
    }
    return (
      <div className="bg-muted/20">
        <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2 border-b border-border bg-card">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="h-4 w-4 text-primary shrink-0" />
            <span className="text-sm font-medium truncate">{lesson.title}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Button asChild size="sm" variant="outline" className="rounded-full">
              <a href={url} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" /> Open</a>
            </Button>
            <Button asChild size="sm" className="rounded-full">
              <a href={url} download><Download className="h-3.5 w-3.5" /> Download</a>
            </Button>
          </div>
        </div>
        <iframe
          src={`${url}#toolbar=1&view=FitH`}
          title={lesson.title}
          className="w-full h-[60vh] sm:h-[70vh] lg:h-[78vh] bg-white"
        />
      </div>
    );
  }

  if (lesson.lesson_type === "embed") {
    return (
      <div className="relative bg-black w-full aspect-video min-h-[240px] sm:min-h-0 max-h-[650px] mx-auto overflow-hidden">
        {url ? (
          <iframe src={url} className="absolute inset-0 w-full h-full" sandbox="allow-scripts allow-same-origin allow-presentation allow-forms" />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-white/80 text-sm">No embed URL provided.</div>
        )}
      </div>
    );
  }

  // text
  return (
    <article className="p-6 sm:p-8 prose prose-sm max-w-none whitespace-pre-line">
      {lesson.content || <span className="text-muted-foreground">No content yet.</span>}
    </article>
  );
}
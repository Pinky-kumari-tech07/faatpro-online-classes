import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/shared/hooks/useWorkspace";
import { useAuth } from "@/shared/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft, Eye, Loader2, Save,
  BookOpen, FileText, ClipboardList, Paperclip, Video, Award, Megaphone, Users, Settings as SettingsIcon,
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import Stepper, { type StepKey } from "./Stepper";
import BasicsStep from "./BasicsStep";
import CurriculumStep from "./CurriculumStep";
import AdditionalStep from "./AdditionalStep";
import { useAutosave, formatRelative } from "./useAutosave";

const DEFAULT_FORM = {
  title: "",
  slug: "",
  description: "",
  summary: "",
  thumbnail_url: "",
  category: "",
  subcategory: "",
  tags: [],
  status: "draft",
  visibility: "public",
  level: "all_levels",
  pricing_type: "free",
  currency: "INR",
  price_amount: 0,
  sale_price: "",
  intro_video_url: "",
  intro_video_provider: "url",
  is_featured: false,
  allow_preview: true,
  enable_discussion: true,
  enable_certificates: true,
  learning_outcomes: [] as string[],
  target_audience: [] as string[],
  materials_included: [] as string[],
  requirements: [] as string[],
  total_duration_minutes: 0,
  certificate_template_id: "",
  passing_percentage: 60,
  // Access & enrollment
  course_password: "",
  enrollment_type: "lifetime",
  access_duration: null as number | null,
  access_duration_type: "days",
  enrollment_start_at: "",
  enrollment_end_at: "",
  is_enrollment_paused: false,
  launch_at: "",
  coming_soon_thumbnail_url: "",
  // Meta
  language: "English",
  languages: [] as string[],
  boards: [] as string[],
  child_category: "",
  difficulty: "beginner",
  preview_mode: "selected_lessons",
  badges: [] as string[],
  discussion_settings: {
    enabled: true,
    instructor_moderation: true,
    student_replies: true,
    anonymous_questions: false,
  },
  // Certificate
  certificate_eligibility_type: "complete_100",
  certificate_eligibility_threshold: null as number | null,
  estimated_completion_minutes: null as number | null,
  // SEO
  seo_title: "",
  seo_description: "",
  seo_focus_keyword: "",
  og_image_url: "",
};

function buildPayload(form: any, workspaceId: string, instructorId: string | null) {
  return {
    workspace_id: workspaceId,
    title: form.title || "Untitled course",
    slug: form.slug || null,
    description: form.description || null,
    summary: form.summary || null,
    thumbnail_url: form.thumbnail_url || null,
    category: form.category || null,
    subcategory: form.subcategory || null,
    tags: Array.isArray(form.tags) ? form.tags.filter(Boolean) : [],
    visibility: form.visibility || "public",
    level: form.level || "all_levels",
    instructor_id: instructorId,
    pricing_type: form.pricing_type || "free",
    currency: form.currency || "INR",
    price_amount: form.pricing_type === "paid" ? Number(form.price_amount || 0) : 0,
    sale_price:
      form.pricing_type === "paid" && form.sale_price !== "" && form.sale_price != null
        ? Number(form.sale_price)
        : null,
    intro_video_url: form.intro_video_url || null,
    intro_video_provider: form.intro_video_provider || null,
    is_featured: !!form.is_featured,
    allow_preview: !!form.allow_preview,
    enable_discussion: !!form.enable_discussion,
    enable_certificates: !!form.enable_certificates,
    learning_outcomes: form.learning_outcomes ?? [],
    target_audience: form.target_audience ?? [],
    materials_included: form.materials_included ?? [],
    requirements: form.requirements ?? [],
    total_duration_minutes: form.total_duration_minutes ?? null,
    certificate_template_id: form.certificate_template_id || null,
    passing_percentage: form.passing_percentage ?? 60,
    course_password: form.visibility === "password_protected" ? (form.course_password || null) : null,
    enrollment_type: form.enrollment_type || "lifetime",
    access_duration: form.enrollment_type === "fixed" ? (form.access_duration ?? null) : null,
    access_duration_type: form.access_duration_type || "days",
    enrollment_start_at: form.enrollment_start_at || null,
    enrollment_end_at: form.enrollment_end_at || null,
    is_enrollment_paused: !!form.is_enrollment_paused,
    launch_at: form.launch_at || null,
    coming_soon_thumbnail_url: form.coming_soon_thumbnail_url || null,
    language: (Array.isArray(form.languages) && form.languages[0]) || form.language || "English",
    languages: Array.isArray(form.languages) ? form.languages : (form.language ? [form.language] : []),
    boards: Array.isArray(form.boards) ? form.boards : [],
    child_category: form.child_category || null,
    difficulty: form.difficulty || "beginner",
    preview_mode: form.preview_mode || "selected_lessons",
    badges: Array.isArray(form.badges) ? form.badges : [],
    discussion_settings: form.discussion_settings ?? {
      enabled: true, instructor_moderation: true, student_replies: true, anonymous_questions: false,
    },
    certificate_eligibility_type: form.certificate_eligibility_type || "complete_100",
    certificate_eligibility_threshold:
      form.certificate_eligibility_type === "complete_100"
        ? null
        : (form.certificate_eligibility_threshold ?? null),
    estimated_completion_minutes: form.estimated_completion_minutes ?? null,
    seo_title: form.seo_title || null,
    seo_description: form.seo_description || null,
    seo_focus_keyword: form.seo_focus_keyword || null,
    og_image_url: form.og_image_url || null,
    // Revenue model
    revenue_model: form.revenue_model || "revenue_share",
    revenue_platform_pct: form.revenue_platform_pct ?? 50,
    revenue_instructor_pct: form.revenue_instructor_pct ?? 50,
    revenue_fixed_amount: form.revenue_fixed_amount ?? null,
    revenue_per_student_amount: form.revenue_per_student_amount ?? null,
    revenue_one_time_amount: form.revenue_one_time_amount ?? null,
    revenue_min_settlement: form.revenue_min_settlement ?? 0,
    revenue_max_settlement: form.revenue_max_settlement ?? null,
    settlement_frequency: form.settlement_frequency || "monthly",
  };
}

export default function CourseBuilderPage() {
  const { id: paramId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { membership, primaryRole } = useWorkspace();
  const { user } = useAuth();
  const wsId = membership!.workspace.id;
  const isAdmin = ["organization_admin", "super_admin"].includes(primaryRole ?? "");
  const isInstructorOnly = primaryRole === "instructor";

  const [courseId, setCourseId] = useState<string | null>(paramId ?? null);
  const [form, setFormState] = useState<any>(DEFAULT_FORM);
  const [dirty, setDirty] = useState(false);
  const [savingNow, setSavingNow] = useState(false);

  const setForm = (updater: (f: any) => any) => {
    setFormState((f: any) => updater(f));
    setDirty(true);
  };

  const stepParam = (searchParams.get("step") as StepKey) || "basics";
  const step: StepKey = ["basics", "curriculum", "additional"].includes(stepParam) ? stepParam : "basics";

  const setStep = (s: StepKey) => {
    const next = new URLSearchParams(searchParams);
    next.set("step", s);
    setSearchParams(next, { replace: true });
  };

  // Load existing course
  const { data: existing } = useQuery({
    queryKey: ["course-builder", courseId],
    enabled: !!courseId,
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("*").eq("id", courseId!).single();
      if (error) throw error;
      return data;
    },
  });

  const initialised = useRef(false);
  useEffect(() => {
    if (existing && !initialised.current) {
      const e = existing as any;
      setFormState({
        ...DEFAULT_FORM,
        ...e,
        learning_outcomes: e.learning_outcomes ?? [],
        target_audience: e.target_audience ?? [],
        materials_included: e.materials_included ?? [],
        requirements: e.requirements ?? [],
      });
      initialised.current = true;
      setDirty(false);
    }
  }, [existing]);

  async function saveCore(opts?: { silent?: boolean }) {
    if (!form.title.trim() && !courseId) return; // no-op until title set on first save
    setSavingNow(true);
    try {
      const effectiveInstructor =
        form.instructor_id ||
        existing?.instructor_id ||
        user?.id ||
        null;
      const payload = buildPayload(form, wsId, effectiveInstructor);
      if (courseId) {
        const { error } = await (supabase.from("courses") as any).update(payload).eq("id", courseId);
        if (error) throw error;
      } else {
        const { data, error } = await (supabase.from("courses") as any).insert(payload).select("id").single();
        if (error) throw error;
        setCourseId(data.id);
        // update URL without navigation flicker
        navigate(`/app/courses/${data.id}/edit?step=${step}`, { replace: true });
      }
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["courses"] });
      qc.invalidateQueries({ queryKey: ["course-builder", courseId] });
      if (!opts?.silent) toast({ title: "Draft saved" });
    } catch (e: any) {
      if (!opts?.silent) toast({ title: "Save failed", description: e.message, variant: "destructive" });
      throw e;
    } finally {
      setSavingNow(false);
    }
  }

  const { lastSavedAt } = useAutosave({
    dirty,
    saveFn: () => saveCore({ silent: true }),
    enabled: !!form.title.trim(),
  });

  // Beforeunload guard
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (dirty) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const publishMut = useMutation({
    mutationFn: async () => {
      if (!courseId) throw new Error("Save the course first.");
      await saveCore({ silent: true });
      // Instructors must submit for review; staff can publish directly.
      const next = isAdmin ? "published" : "pending_review";
      const { error } = await supabase.from("courses").update({ status: next as any }).eq("id", courseId);
      if (error) throw error;
      return next;
    },
    onSuccess: (next) => {
      toast({ title: next === "published" ? "Course published" : "Submitted for review" });
      qc.invalidateQueries({ queryKey: ["courses"] });
      qc.invalidateQueries({ queryKey: ["course-builder", courseId] });
      navigate(`/app/courses`);
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const stepOrder: StepKey[] = ["basics", "curriculum", "additional"];
  const stepIdx = stepOrder.indexOf(step);
  const goPrev = () => stepIdx > 0 && setStep(stepOrder[stepIdx - 1]);
  const goNext = async () => {
    if (!form.title.trim()) {
      toast({ title: "Title required", description: "Add a course title before continuing.", variant: "destructive" });
      return;
    }
    try {
      await saveCore({ silent: true });
      if (stepIdx < stepOrder.length - 1) setStep(stepOrder[stepIdx + 1]);
    } catch {}
  };

  const status = existing?.status ?? "draft";

  return (
    <div className="space-y-5 max-w-7xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link to="/app/courses" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" /> Back to courses
        </Link>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {savingNow ? (
            <span className="inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Saving…</span>
          ) : (
            <span>{dirty ? "Unsaved changes" : formatRelative(lastSavedAt)}</span>
          )}
        </div>
      </div>

      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {courseId ? form.title || "Untitled course" : "New course"}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary" className="capitalize">{status.replace("_", " ")}</Badge>
            {form.pricing_type === "paid" && (
              <Badge variant="outline">{form.currency} {form.price_amount}</Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => saveCore()} disabled={savingNow}>
            <Save className="h-4 w-4 mr-1" /> Save draft
          </Button>
          {courseId && (
            <Button variant="outline" onClick={() => window.open(`/app/courses/${courseId}`, "_blank")}>
              <Eye className="h-4 w-4 mr-1" /> Preview
            </Button>
          )}
          <Button onClick={() => publishMut.mutate()} disabled={!courseId || publishMut.isPending}>
            {isAdmin ? "Publish course" : "Submit for review"}
          </Button>
        </div>
      </div>

      <Card className="p-4 border-border shadow-none sticky top-0 z-10 bg-background/95 backdrop-blur">
        <Stepper current={step} onChange={setStep} />
      </Card>

      {courseId && (
        <Card className="p-3 border-border shadow-none">
          <div className="flex items-center gap-2 flex-wrap text-sm">
            <span className="text-xs uppercase tracking-wide text-muted-foreground mr-2">Course modules</span>
            {[
              { to: `/app/courses/${courseId}/edit?step=curriculum`, icon: BookOpen, label: "Curriculum" },
              { to: `/app/lessons?course=${courseId}`, icon: FileText, label: "Lessons" },
              { to: `/app/assignments?course=${courseId}`, icon: ClipboardList, label: "Assignments" },
              { to: `/app/quizzes?course=${courseId}`, icon: ClipboardList, label: "Quizzes" },
              { to: `/app/courses/${courseId}/edit?step=additional`, icon: Paperclip, label: "Resources" },
              { to: `/app/live-classes?course=${courseId}`, icon: Video, label: "Live classes" },
              { to: `/app/certificates`, icon: Award, label: "Certificates" },
              { to: `/app/announcements`, icon: Megaphone, label: "Announcements" },
              { to: `/app/courses/${courseId}`, icon: Users, label: "Students" },
              { to: `/app/courses/${courseId}/edit?step=basics`, icon: SettingsIcon, label: "Settings" },
            ].map((item) => (
              <Link
                key={item.label}
                to={item.to}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
              </Link>
            ))}
          </div>
        </Card>
      )}

      <div>
        {step === "basics" && (
          <BasicsStep form={form} setForm={setForm} workspaceId={wsId} />
        )}
        {step === "curriculum" && (
          <CurriculumStep courseId={courseId ?? ""} workspaceId={wsId} />
        )}
        {step === "additional" && (
          <AdditionalStep
            form={form} setForm={setForm}
            courseId={courseId ?? ""} workspaceId={wsId}
          />
        )}
      </div>

      <div className="flex items-center justify-between border-t border-border pt-4">
        <Button variant="outline" onClick={goPrev} disabled={stepIdx === 0}>Previous</Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => saveCore()} disabled={savingNow}>Save draft</Button>
          {stepIdx < stepOrder.length - 1 ? (
            <Button onClick={goNext}>Next</Button>
          ) : (
            <Button onClick={() => publishMut.mutate()} disabled={!courseId || publishMut.isPending}>
              {isAdmin ? "Publish course" : "Submit for review"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
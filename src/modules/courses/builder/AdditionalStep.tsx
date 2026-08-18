import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Trash2, Upload, Loader2, X, FileText } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { resolveStorageUrl } from "@/lib/storageUrl";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge as UIBadge } from "@/components/ui/badge";

function toLocalInput(v: any) {
  if (!v) return "";
  try { const d = new Date(v); const off = d.getTimezoneOffset();
    return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
  } catch { return ""; }
}

function Repeater({
  label, hint, value, onChange, placeholder,
}: {
  label: string;
  hint?: string;
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const items = value.length ? value : [""];
  return (
    <div className="space-y-2">
      <div>
        <Label className="font-medium">{label}</Label>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </div>
      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className="flex gap-2">
            <Input
              value={it}
              placeholder={placeholder}
              onChange={(e) => {
                const next = [...items]; next[i] = e.target.value; onChange(next);
              }}
            />
            <Button
              variant="ghost" size="icon"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              disabled={items.length === 1 && !it}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button size="sm" variant="outline" onClick={() => onChange([...items, ""])}>
          <Plus className="h-3 w-3 mr-1" /> Add row
        </Button>
      </div>
    </div>
  );
}

export default function AdditionalStep({
  form, setForm, courseId, workspaceId,
}: {
  form: any;
  setForm: (updater: (f: any) => any) => void;
  courseId: string;
  workspaceId: string;
}) {
  const [uploadingAttach, setUploadingAttach] = useState(false);
  const [uploadingOg, setUploadingOg] = useState(false);

  const { data: templates = [], refetch: refetchTpl } = useQuery({
    queryKey: ["builder-cert-templates", workspaceId],
    queryFn: async () => {
      const { data } = await supabase
        .from("certificate_templates").select("id, name, is_default")
        .eq("workspace_id", workspaceId)
        .order("is_default", { ascending: false }).order("name");
      return data ?? [];
    },
  });

  const { data: attachments = [], refetch: refetchAttach } = useQuery({
    queryKey: ["builder-attachments", courseId],
    enabled: !!courseId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("course_assets").select("*")
        .eq("course_id", courseId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  // Other workspace courses for prerequisites
  const { data: otherCourses = [] } = useQuery({
    queryKey: ["builder-other-courses", workspaceId, courseId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("courses").select("id, title, status").eq("workspace_id", workspaceId).order("title");
      return (data ?? []).filter((c: any) => c.id !== courseId);
    },
  });

  // Existing prerequisites
  const { data: prereqs = [], refetch: refetchPrereqs } = useQuery({
    queryKey: ["builder-prereqs", courseId],
    enabled: !!courseId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("course_prerequisites").select("id, prerequisite_course_id").eq("course_id", courseId);
      return data ?? [];
    },
  });

  const togglePrereq = async (prereqCourseId: string) => {
    if (!courseId) {
      toast({ title: "Save the course first", variant: "destructive" });
      return;
    }
    const existing = (prereqs as any[]).find((p) => p.prerequisite_course_id === prereqCourseId);
    if (existing) {
      await (supabase as any).from("course_prerequisites").delete().eq("id", existing.id);
    } else {
      await (supabase as any).from("course_prerequisites").insert({
        workspace_id: workspaceId, course_id: courseId, prerequisite_course_id: prereqCourseId,
      });
    }
    refetchPrereqs();
  };

  async function uploadOgImage(file: File) {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Choose an image.", variant: "destructive" }); return;
    }
    if (file.size > 4 * 1024 * 1024) {
      toast({ title: "Too large", description: "Max 4MB.", variant: "destructive" }); return;
    }
    setUploadingOg(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${workspaceId}/og/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("course-thumbnails").upload(path, file, { contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("course-thumbnails").getPublicUrl(path);
      setForm((f) => ({ ...f, og_image_url: data.publicUrl }));
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally { setUploadingOg(false); }
  }

  const ds = form.discussion_settings ?? {
    enabled: true, instructor_moderation: true, student_replies: true, anonymous_questions: false,
  };
  const setDS = (patch: any) => setForm((f) => ({ ...f, discussion_settings: { ...ds, ...patch } }));

  async function uploadAttachment(file: File) {
    if (file.size > 50 * 1024 * 1024) {
      toast({ title: "Too large", description: "Max 50MB.", variant: "destructive" });
      return;
    }
    setUploadingAttach(true);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const path = `${workspaceId}/course-${courseId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("lesson-files").upload(path, file, { contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("lesson-files").getPublicUrl(path);
      const { data: userRes } = await supabase.auth.getUser();
      const { error: dbErr } = await (supabase as any).from("course_assets").insert({
        workspace_id: workspaceId,
        course_id: courseId,
        file_name: file.name,
        storage_path: path,
        public_url: data.publicUrl,
        mime_type: file.type || null,
        file_size: file.size,
        uploaded_by: userRes?.user?.id ?? null,
      });
      if (dbErr) throw dbErr;
      refetchAttach();
      toast({ title: "File uploaded" });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setUploadingAttach(false);
    }
  }

  async function deleteAttachment(a: any) {
    if (a.storage_path) await supabase.storage.from("lesson-files").remove([a.storage_path]);
    await (supabase as any).from("course_assets").delete().eq("id", a.id);
    refetchAttach();
  }

  /** lesson-files is a private bucket: open through a short-lived signed URL. */
  async function openAttachment(a: any) {
    const url = await resolveStorageUrl(a.storage_path || a.public_url, { bucket: "lesson-files" });
    if (!url) {
      toast({ title: "Download failed", description: "You do not have access to this file.", variant: "destructive" });
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <Card className="p-6 border-border shadow-none space-y-5">
          <h3 className="font-semibold">Overview</h3>
          <Repeater
            label="What students will learn"
            placeholder="e.g. Build a full-stack app with React + Supabase"
            value={form.learning_outcomes ?? []}
            onChange={(v) => setForm((f) => ({ ...f, learning_outcomes: v }))}
          />
          <Repeater
            label="Target audience"
            placeholder="e.g. Junior developers wanting to ship real products"
            value={form.target_audience ?? []}
            onChange={(v) => setForm((f) => ({ ...f, target_audience: v }))}
          />
          <div className="space-y-2">
            <Label>Total course duration</Label>
            <div className="flex gap-3">
              <div className="flex items-center gap-2">
                <Input
                  type="number" min={0} className="w-24"
                  value={Math.floor((form.total_duration_minutes ?? 0) / 60) || ""}
                  onChange={(e) => {
                    const h = Number(e.target.value || 0);
                    const m = (form.total_duration_minutes ?? 0) % 60;
                    setForm((f) => ({ ...f, total_duration_minutes: h * 60 + m }));
                  }}
                />
                <span className="text-sm text-muted-foreground">hours</span>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number" min={0} max={59} className="w-24"
                  value={(form.total_duration_minutes ?? 0) % 60 || ""}
                  onChange={(e) => {
                    const m = Math.min(59, Math.max(0, Number(e.target.value || 0)));
                    const h = Math.floor((form.total_duration_minutes ?? 0) / 60);
                    setForm((f) => ({ ...f, total_duration_minutes: h * 60 + m }));
                  }}
                />
                <span className="text-sm text-muted-foreground">minutes</span>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6 border-border shadow-none space-y-5">
          <h3 className="font-semibold">Materials & requirements</h3>
          <Repeater
            label="Materials included"
            hint="Examples: downloadable PDFs, templates, source code, Excel sheets."
            placeholder="e.g. Downloadable PDFs"
            value={form.materials_included ?? []}
            onChange={(v) => setForm((f) => ({ ...f, materials_included: v }))}
          />
          <Repeater
            label="Requirements / instructions"
            hint="Examples: laptop, stable internet connection, basic JavaScript."
            placeholder="e.g. Laptop required"
            value={form.requirements ?? []}
            onChange={(v) => setForm((f) => ({ ...f, requirements: v }))}
          />
        </Card>

        <Card className="p-6 border-border shadow-none space-y-5">
          <h3 className="font-semibold">Enrollment settings</h3>

          <div className="space-y-3">
            <Label className="font-medium">Access duration</Label>
            <RadioGroup
              value={form.enrollment_type || "lifetime"}
              onValueChange={(v) => setForm((f) => ({ ...f, enrollment_type: v }))}
              className="grid sm:grid-cols-2 gap-2"
            >
              <label className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm cursor-pointer hover:bg-muted/40">
                <RadioGroupItem value="lifetime" /> Lifetime access
              </label>
              <label className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm cursor-pointer hover:bg-muted/40">
                <RadioGroupItem value="fixed" /> Fixed duration
              </label>
            </RadioGroup>
            {form.enrollment_type === "fixed" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-wrap gap-2">
                  {[30, 60, 90, 180, 365].map((d) => (
                    <button
                      key={d}
                      onClick={() => setForm((f) => ({ ...f, access_duration: d, access_duration_type: "days" }))}
                      className={`text-xs px-2.5 py-1 rounded-full border ${form.access_duration === d && form.access_duration_type === "days" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
                    >
                      {d} days
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    type="number" min={1} placeholder="Custom"
                    value={form.access_duration ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, access_duration: e.target.value ? Number(e.target.value) : null }))}
                  />
                  <Select
                    value={form.access_duration_type || "days"}
                    onValueChange={(v) => setForm((f) => ({ ...f, access_duration_type: v }))}
                  >
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="days">Days</SelectItem>
                      <SelectItem value="months">Months</SelectItem>
                      <SelectItem value="years">Years</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3 pt-2 border-t border-border">
            <Label className="font-medium">Enrollment window</Label>
            <p className="text-xs text-muted-foreground">Leave blank for open enrollment.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Opens</Label>
                <Input
                  type="datetime-local"
                  value={toLocalInput(form.enrollment_start_at)}
                  onChange={(e) => setForm((f) => ({ ...f, enrollment_start_at: e.target.value || "" }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Closes</Label>
                <Input
                  type="datetime-local"
                  value={toLocalInput(form.enrollment_end_at)}
                  onChange={(e) => setForm((f) => ({ ...f, enrollment_end_at: e.target.value || "" }))}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border">
            <div>
              <Label className="font-medium">Pause enrollment</Label>
              <p className="text-xs text-muted-foreground">Existing students keep access. New students cannot enroll.</p>
            </div>
            <Switch
              checked={!!form.is_enrollment_paused}
              onCheckedChange={(v) => setForm((f) => ({ ...f, is_enrollment_paused: v }))}
            />
          </div>

          <div className="space-y-3 pt-2 border-t border-border">
            <Label className="font-medium">Coming soon / scheduled launch</Label>
            <p className="text-xs text-muted-foreground">When set, the course shows a countdown and a "Notify me" button until launch.</p>
            <Input
              type="datetime-local"
              value={toLocalInput(form.launch_at)}
              onChange={(e) => setForm((f) => ({ ...f, launch_at: e.target.value || "" }))}
            />
          </div>
        </Card>

        <Card className="p-6 border-border shadow-none space-y-4">
          <h3 className="font-semibold">Prerequisites</h3>
          <p className="text-xs text-muted-foreground">Students must complete these courses before enrolling.</p>
          {!courseId ? (
            <p className="text-xs text-muted-foreground">Save the course first to add prerequisites.</p>
          ) : (otherCourses as any[]).length === 0 ? (
            <p className="text-xs text-muted-foreground">No other courses in this workspace yet.</p>
          ) : (
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {(otherCourses as any[]).map((c: any) => {
                const on = (prereqs as any[]).some((p) => p.prerequisite_course_id === c.id);
                return (
                  <label key={c.id} className="flex items-center gap-3 px-3 py-2 rounded-md border border-border cursor-pointer hover:bg-muted/40">
                    <Checkbox checked={on} onCheckedChange={() => togglePrereq(c.id)} />
                    <span className="text-sm flex-1 truncate">{c.title}</span>
                    <UIBadge variant="outline" className="capitalize text-xs">{c.status?.replace("_", " ")}</UIBadge>
                  </label>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="p-6 border-border shadow-none space-y-4">
          <h3 className="font-semibold">Discussion settings</h3>
          {[
            { k: "enabled", label: "Enable discussion" },
            { k: "instructor_moderation", label: "Instructor moderation" },
            { k: "student_replies", label: "Allow student replies" },
            { k: "anonymous_questions", label: "Allow anonymous questions" },
          ].map((o) => (
            <label key={o.k} className="flex items-center justify-between gap-3 cursor-pointer">
              <span className="text-sm">{o.label}</span>
              <Switch
                checked={!!ds[o.k]}
                onCheckedChange={(v) => setDS({ [o.k]: v })}
              />
            </label>
          ))}
        </Card>

        <Card className="p-6 border-border shadow-none space-y-4">
          <h3 className="font-semibold">Promotional badges</h3>
          <p className="text-xs text-muted-foreground">
            Badges appear on the course card in the public catalog. "New" is added
            automatically for the first 30 days after publishing.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              { k: "best_seller", label: "Best Seller" },
              { k: "featured", label: "Featured" },
              { k: "trending", label: "Trending" },
              { k: "editors_choice", label: "Editor's Choice" },
              { k: "new", label: "New (force)" },
            ].map((b) => {
              const arr: string[] = Array.isArray(form.badges) ? form.badges : [];
              const on = arr.includes(b.k);
              return (
                <label
                  key={b.k}
                  className="flex items-center gap-3 px-3 py-2 rounded-md border border-border cursor-pointer hover:bg-muted/40"
                >
                  <Checkbox
                    checked={on}
                    onCheckedChange={(v) => {
                      const next = v
                        ? Array.from(new Set([...arr, b.k]))
                        : arr.filter((x) => x !== b.k);
                      setForm((f) => ({ ...f, badges: next }));
                    }}
                  />
                  <span className="text-sm flex-1">{b.label}</span>
                </label>
              );
            })}
          </div>
        </Card>

        <Card className="p-6 border-border shadow-none space-y-4">
          <h3 className="font-semibold">SEO</h3>
          <div className="space-y-2">
            <Label>Meta title</Label>
            <Input
              maxLength={70}
              value={form.seo_title || ""}
              onChange={(e) => setForm((f) => ({ ...f, seo_title: e.target.value }))}
              placeholder="Defaults to course title"
            />
          </div>
          <div className="space-y-2">
            <Label>Meta description</Label>
            <Textarea
              rows={3} maxLength={170}
              value={form.seo_description || ""}
              onChange={(e) => setForm((f) => ({ ...f, seo_description: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Focus keyword</Label>
            <Input
              value={form.seo_focus_keyword || ""}
              onChange={(e) => setForm((f) => ({ ...f, seo_focus_keyword: e.target.value }))}
              placeholder="e.g. GST course"
            />
          </div>
          <div className="space-y-2">
            <Label>Social share image (OG)</Label>
            <div className="flex gap-2 items-center">
              {form.og_image_url && (
                <img src={form.og_image_url} alt="" className="h-12 w-20 object-cover rounded border border-border" />
              )}
              <label className="inline-flex items-center gap-2 cursor-pointer rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-muted">
                {uploadingOg ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                <span>{uploadingOg ? "Uploading…" : "Upload"}</span>
                <input type="file" accept="image/*" className="hidden"
                  onChange={(e) => e.target.files?.[0] && uploadOgImage(e.target.files[0])} />
              </label>
              {form.og_image_url && (
                <Button variant="ghost" size="icon" onClick={() => setForm((f) => ({ ...f, og_image_url: "" }))}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </Card>

        <Card className="p-6 border-border shadow-none space-y-4">
          <h3 className="font-semibold">Course attachments</h3>
          <p className="text-xs text-muted-foreground">Files shared with all enrolled students. PDFs, PPT, ZIP, DOC, XLS up to 50MB.</p>
          <label className="inline-flex items-center gap-2 cursor-pointer rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-muted">
            {uploadingAttach ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            <span>{uploadingAttach ? "Uploading…" : "Upload file"}</span>
            <input
              type="file"
              className="hidden"
              accept=".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.zip"
              disabled={uploadingAttach || !courseId}
              onChange={(e) => e.target.files?.[0] && uploadAttachment(e.target.files[0])}
            />
          </label>
          {!courseId && <p className="text-xs text-muted-foreground">Save the course first to add attachments.</p>}
          <div className="space-y-2">
            {attachments.map((a: any) => (
              <div key={a.id} className="flex items-center gap-3 px-3 py-2 rounded-md border border-border">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <button
                  type="button"
                  onClick={() => openAttachment(a)}
                  className="flex-1 text-left text-sm hover:underline truncate"
                >
                  {a.file_name || (a.title || "").replace(/^course:[^:]+:/, "")}
                </button>
                <Button size="icon" variant="ghost" onClick={() => deleteAttachment(a)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="p-5 border-border shadow-none space-y-4">
          <h3 className="font-semibold">Certificate template</h3>
          <Tabs defaultValue="default">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="default">Default</TabsTrigger>
              <TabsTrigger value="custom">Custom</TabsTrigger>
            </TabsList>
            <TabsContent value="default" className="space-y-2 pt-3">
              {templates.filter((t: any) => t.is_default).map((t: any) => (
                <button
                  key={t.id}
                  onClick={() => setForm((f) => ({ ...f, certificate_template_id: t.id }))}
                  className={`w-full text-left px-3 py-2 rounded-md border text-sm ${form.certificate_template_id === t.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted"}`}
                >
                  {t.name}
                </button>
              ))}
              {templates.filter((t: any) => t.is_default).length === 0 && (
                <p className="text-xs text-muted-foreground">No default templates available.</p>
              )}
            </TabsContent>
            <TabsContent value="custom" className="space-y-2 pt-3">
              {templates.filter((t: any) => !t.is_default).map((t: any) => (
                <button
                  key={t.id}
                  onClick={() => setForm((f) => ({ ...f, certificate_template_id: t.id }))}
                  className={`w-full text-left px-3 py-2 rounded-md border text-sm ${form.certificate_template_id === t.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted"}`}
                >
                  {t.name}
                </button>
              ))}
              {templates.filter((t: any) => !t.is_default).length === 0 && (
                <p className="text-xs text-muted-foreground">No custom templates yet. Add them in Certificates.</p>
              )}
            </TabsContent>
          </Tabs>
          {form.certificate_template_id && (
            <Button variant="ghost" size="sm" onClick={() => setForm((f) => ({ ...f, certificate_template_id: "" }))}>
              Clear selection
            </Button>
          )}
        </Card>

        <Card className="p-5 border-border shadow-none space-y-4">
          <h3 className="font-semibold">Certificate eligibility</h3>
          <RadioGroup
            value={form.certificate_eligibility_type || "complete_100"}
            onValueChange={(v) => setForm((f) => ({ ...f, certificate_eligibility_type: v }))}
            className="space-y-2"
          >
            <label className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm cursor-pointer hover:bg-muted/40">
              <RadioGroupItem value="complete_100" /> Complete 100% of course
            </label>
            <label className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm cursor-pointer hover:bg-muted/40">
              <RadioGroupItem value="complete_percentage" /> Complete X% of course
            </label>
            <label className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm cursor-pointer hover:bg-muted/40">
              <RadioGroupItem value="quiz_threshold" /> Pass quiz threshold
            </label>
          </RadioGroup>
          {form.certificate_eligibility_type !== "complete_100" && (
            <div className="space-y-1.5">
              <Label className="text-xs">
                {form.certificate_eligibility_type === "quiz_threshold" ? "Minimum quiz score (%)" : "Required completion (%)"}
              </Label>
              <Input
                type="number" min={1} max={100}
                value={form.certificate_eligibility_threshold ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, certificate_eligibility_threshold: e.target.value ? Number(e.target.value) : null }))}
              />
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
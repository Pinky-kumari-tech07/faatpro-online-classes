import { useEffect, useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, X, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import CoursePrice from "@/modules/shared/CoursePrice";
import { toast } from "@/components/ui/use-toast";
import { categoryService } from "@/services/supabase/categoryService";
import { useWorkspace } from "@/shared/hooks/useWorkspace";
import { LANGUAGES, BOARDS } from "@/modules/courses/constants";

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function syncCoInstructors(courseId: string, workspaceId: string, ids: string[]) {
  const { data: existing } = await supabase
    .from("course_instructors").select("instructor_id").eq("course_id", courseId);
  const have = new Set((existing ?? []).map((r: any) => r.instructor_id));
  const want = new Set(ids);
  const toAdd = ids.filter((id) => !have.has(id));
  const toRemove = [...have].filter((id) => !want.has(id));
  if (toAdd.length) {
    await supabase.from("course_instructors").insert(
      toAdd.map((id) => ({ course_id: courseId, instructor_id: id, workspace_id: workspaceId }))
    );
  }
  if (toRemove.length) {
    await supabase.from("course_instructors").delete()
      .eq("course_id", courseId).in("instructor_id", toRemove);
  }
}

export default function CourseFormDialog({
  open, onOpenChange, initial, workspaceId,
}: { open: boolean; onOpenChange: (v: boolean) => void; initial: any; workspaceId: string }) {
  const qc = useQueryClient();
  const { primaryRole } = useWorkspace();
  const isStaff = ["organization_admin", "super_admin"].includes(primaryRole ?? "");
  const [uploading, setUploading] = useState(false);
  const [coInstructorIds, setCoInstructorIds] = useState<string[]>([]);
  const [form, setForm] = useState<any>({
    title: "", slug: "", description: "", summary: "", thumbnail_url: "",
    category: "", subcategory: "", child_category: "", languages: [] as string[], boards: [] as string[],
    tags: "", status: "draft", visibility: "public",
    instructor_id: "", seo_title: "", seo_description: "",
    pricing_type: "free", currency: "INR", price_amount: 0, sale_price: "",
    discount_type: "none", discount_value: "", discount_starts_at: "", discount_ends_at: "",
    gst_enabled: false, gst_rate: "", tax_inclusive: false, allow_coupons: true,
    passing_percentage: 90,
    certificate_template_id: "",
  });

  useEffect(() => {
    if (initial) {
      setForm({
        ...initial,
        tags: (initial.tags ?? []).join(", "),
        languages: Array.isArray(initial.languages) && initial.languages.length
          ? initial.languages
          : (initial.language ? [initial.language] : []),
        boards: Array.isArray(initial.boards) ? initial.boards : [],
        child_category: initial.child_category ?? "",
        instructor_id: initial.instructor_id ?? "",
        pricing_type: initial.pricing_type ?? "free",
        currency: initial.currency ?? "INR",
        price_amount: initial.price_amount ?? 0,
        sale_price: initial.sale_price ?? "",
        discount_type: initial.discount_type ?? "none",
        discount_value: initial.discount_value ?? "",
        discount_starts_at: initial.discount_starts_at ? String(initial.discount_starts_at).slice(0, 10) : "",
        discount_ends_at: initial.discount_ends_at ? String(initial.discount_ends_at).slice(0, 10) : "",
        gst_enabled: initial.gst_rate != null && initial.gst_rate > 0,
        gst_rate: initial.gst_rate ?? "",
        tax_inclusive: !!initial.tax_inclusive,
        allow_coupons: initial.allow_coupons ?? true,
        passing_percentage: initial.passing_percentage ?? 90,
        certificate_template_id: initial.certificate_template_id ?? "",
      });
      // load existing co-instructors
      (async () => {
        if (initial.id) {
          const { data } = await supabase
            .from("course_instructors")
            .select("instructor_id")
            .eq("course_id", initial.id);
          setCoInstructorIds((data ?? []).map((r: any) => r.instructor_id));
        } else {
          setCoInstructorIds([]);
        }
      })();
    } else {
      setForm({
        title: "", slug: "", description: "", summary: "", thumbnail_url: "",
        category: "", subcategory: "", child_category: "", languages: [], boards: [],
        tags: "", status: "draft", visibility: "public",
        instructor_id: "", seo_title: "", seo_description: "",
        pricing_type: "free", currency: "INR", price_amount: 0, sale_price: "",
        discount_type: "none", discount_value: "", discount_starts_at: "", discount_ends_at: "",
        gst_enabled: false, gst_rate: "", tax_inclusive: false, allow_coupons: true,
        passing_percentage: 90,
        certificate_template_id: "",
      });
      setCoInstructorIds([]);
    }
  }, [initial, open]);

  const { data: instructors } = useQuery({
    queryKey: ["instructors", workspaceId],
    queryFn: async () => {
      const { data } = await supabase
        .from("workspace_members")
        .select("profile_id, role, profiles:profile_id(id, full_name)")
        .eq("workspace_id", workspaceId)
        .in("role", ["instructor", "organization_admin"]);
      return data ?? [];
    },
  });

  const { data: categoryOptions = [] } = useQuery({
    queryKey: ["course-categories-options-all"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("course_categories")
        .select("id, name, slug, status, workspace_id, parent_id")
        .eq("status", "active")
        .order("name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: certTemplates = [] } = useQuery({
    queryKey: ["cert-templates-options", workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("certificate_templates")
        .select("id, name, is_default")
        .eq("workspace_id", initial?.workspace_id ?? workspaceId)
        .order("is_default", { ascending: false })
        .order("name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id ?? null;
      // Determine if current user is an instructor (not admin/staff) in this workspace
      const { data: myRoles } = await supabase
        .from("workspace_members")
        .select("role")
        .eq("workspace_id", workspaceId)
        .eq("profile_id", uid as string);
      const roles = (myRoles ?? []).map((r: any) => r.role);
      const isAdminLike = roles.some((r: string) =>
        ["organization_admin", "super_admin"].includes(r)
      );
      const isInstructor = roles.includes("instructor");
      // Instructors MUST own the course they create (RLS requirement)
      const effectiveInstructorId =
        form.instructor_id ||
        (!isAdminLike && isInstructor ? uid : null);
      const targetWorkspaceId = initial?.workspace_id ?? workspaceId;
      const payload: any = {
        workspace_id: targetWorkspaceId,
        title: form.title,
        slug: form.slug || slugify(form.title),
        description: form.description || null,
        summary: form.summary || null,
        thumbnail_url: form.thumbnail_url || null,
        category: form.category || null,
        subcategory: form.subcategory || null,
        child_category: form.child_category || null,
        languages: Array.isArray(form.languages) ? form.languages : [],
        boards: Array.isArray(form.boards) ? form.boards : [],
        tags: form.tags ? form.tags.split(",").map((t: string) => t.trim()).filter(Boolean) : [],
        status: form.status,
        visibility: form.visibility,
        instructor_id: effectiveInstructorId,
        seo_title: form.seo_title || null,
        seo_description: form.seo_description || null,
        pricing_type: form.pricing_type,
        currency: form.currency || "INR",
        price_amount: form.pricing_type === "paid" ? Number(form.price_amount || 0) : 0,
        sale_price: form.pricing_type === "paid" && form.sale_price !== "" ? Number(form.sale_price) : null,
        discount_type: form.pricing_type === "paid" ? form.discount_type : "none",
        discount_value: form.pricing_type === "paid" && form.discount_value !== "" ? Number(form.discount_value) : null,
        discount_starts_at: form.pricing_type === "paid" && form.discount_starts_at ? new Date(form.discount_starts_at).toISOString() : null,
        discount_ends_at: form.pricing_type === "paid" && form.discount_ends_at ? new Date(form.discount_ends_at).toISOString() : null,
        gst_rate: form.gst_enabled && form.gst_rate !== "" ? Number(form.gst_rate) : null,
        tax_inclusive: !!form.tax_inclusive,
        allow_coupons: !!form.allow_coupons,
        passing_percentage: Math.min(100, Math.max(1, Number(form.passing_percentage) || 90)),
        certificate_template_id: form.certificate_template_id || null,
      };
      if (initial?.id) {
        const { error } = await supabase.from("courses").update(payload).eq("id", initial.id);
        if (error) throw error;
        await syncCoInstructors(initial.id, targetWorkspaceId, coInstructorIds);
      } else {
        // Debug logs to help diagnose RLS/permission issues
        console.log("[CourseCreate] user:", uid, "roles:", roles, "workspace:", targetWorkspaceId, "instructor_id:", effectiveInstructorId);
        console.log("[CourseCreate] payload:", payload);
        const { data: inserted, error } = await supabase.from("courses").insert(payload).select("id").single();
        if (error) throw error;
        if (inserted?.id) await syncCoInstructors(inserted.id, targetWorkspaceId, coInstructorIds);
      }
    },
    onSuccess: () => {
      toast({ title: initial ? "Course updated" : "Course created" });
      qc.invalidateQueries({ queryKey: ["courses", workspaceId] });
      qc.invalidateQueries({ queryKey: ["manageable-courses"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const previewCourse = {
    pricing_type: form.pricing_type,
    currency: form.currency,
    price_amount: Number(form.price_amount || 0),
    sale_price: form.sale_price !== "" ? Number(form.sale_price) : null,
    discount_type: form.discount_type,
    discount_value: form.discount_value !== "" ? Number(form.discount_value) : null,
    discount_starts_at: form.discount_starts_at || null,
    discount_ends_at: form.discount_ends_at || null,
  };

  async function handleThumbnailUpload(file: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please upload an image file.", variant: "destructive" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max size is 2MB.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${workspaceId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("course-thumbnails").upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("course-thumbnails").getPublicUrl(path);
      setForm((f: any) => ({ ...f, thumbnail_url: data.publicUrl }));
      toast({ title: "Thumbnail uploaded" });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{initial ? "Edit course" : "New course"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5"><Label>Title</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value, slug: form.slug || slugify(e.target.value) })} />
            </div>
            <div className="space-y-1.5"><Label>Slug</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Category</Label>
              <Select value={form.category || "none"} onValueChange={(v) => setForm({ ...form, category: v === "none" ? "" : v, subcategory: "", child_category: "" })}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Uncategorized</SelectItem>
                  {categoryOptions.filter((c: any) => !c.parent_id).map((c: any) => (
                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Subcategory</Label>
              {(() => {
                const parent = categoryOptions.find((c: any) => !c.parent_id && c.name === form.category);
                const subs = categoryOptions.filter((c: any) => parent && c.parent_id === parent.id);
                return (
                  <Select
                    value={form.subcategory || "none"}
                    onValueChange={(v) => setForm({ ...form, subcategory: v === "none" ? "" : v, child_category: "" })}
                    disabled={!parent || subs.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={parent ? (subs.length ? "Select subcategory" : "—") : "Pick a category first"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {subs.map((c: any) => (
                        <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                );
              })()}
            </div>
            <div className="col-span-2 space-y-1.5"><Label>Child category</Label>
              {(() => {
                const parent = categoryOptions.find((c: any) => !c.parent_id && c.name === form.category);
                const sub = categoryOptions.find((c: any) => parent && c.parent_id === parent.id && c.name === form.subcategory);
                const kids = categoryOptions.filter((c: any) => sub && c.parent_id === sub.id);
                return (
                  <Select
                    value={form.child_category || "none"}
                    onValueChange={(v) => setForm({ ...form, child_category: v === "none" ? "" : v })}
                    disabled={!sub || kids.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={sub ? (kids.length ? "Select child category" : "—") : "Pick a subcategory first"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {kids.map((c: any) => (
                        <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                );
              })()}
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Languages</Label>
              <div className="flex flex-wrap gap-2">
                {LANGUAGES.map((l) => {
                  const on = (form.languages ?? []).includes(l);
                  return (
                    <button key={l} type="button"
                      className={`text-xs px-2.5 py-1 rounded-full border ${on ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
                      onClick={() => {
                        const cur: string[] = form.languages ?? [];
                        setForm({ ...form, languages: on ? cur.filter((x) => x !== l) : [...cur, l] });
                      }}>
                      {l}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Boards (optional)</Label>
              <div className="flex flex-wrap gap-2">
                {BOARDS.map((b) => {
                  const on = (form.boards ?? []).includes(b);
                  return (
                    <button key={b} type="button"
                      className={`text-xs px-2.5 py-1 rounded-full border ${on ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
                      onClick={() => {
                        const cur: string[] = form.boards ?? [];
                        setForm({ ...form, boards: on ? cur.filter((x) => x !== b) : [...cur, b] });
                      }}>
                      {b}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="col-span-2 space-y-1.5"><Label>Summary</Label>
              <Input value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} />
            </div>
            <div className="col-span-2 space-y-1.5"><Label>Description</Label>
              <Textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Thumbnail image</Label>
              <div className="flex items-start gap-3">
                <div className="h-24 w-40 rounded-md border border-border bg-muted/40 overflow-hidden flex items-center justify-center shrink-0">
                  {form.thumbnail_url ? (
                    <img src={form.thumbnail_url} alt="Thumbnail" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xs text-muted-foreground">No image</span>
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="inline-flex items-center gap-2 cursor-pointer rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-muted">
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      <span>{uploading ? "Uploading…" : "Upload image"}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={uploading}
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleThumbnailUpload(f); e.currentTarget.value = ""; }}
                      />
                    </label>
                    {form.thumbnail_url && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => setForm({ ...form, thumbnail_url: "" })}>
                        <X className="h-4 w-4 mr-1" /> Remove
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Recommended 1280×720 (16:9). JPG or PNG, up to 2MB.
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-1.5"><Label>Tags (comma-separated)</Label><Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  {isStaff && <SelectItem value="pending_review">Pending review</SelectItem>}
                  {isStaff && <SelectItem value="approved">Approved</SelectItem>}
                  {isStaff && <SelectItem value="rejected">Rejected</SelectItem>}
                  {isStaff && <SelectItem value="published">Published</SelectItem>}
                  {isStaff && <SelectItem value="archived">Archived</SelectItem>}
                </SelectContent>
              </Select>
              {!isStaff && (
                <p className="text-xs text-muted-foreground">Use "Submit for review" from the course page to request publishing.</p>
              )}
            </div>
            <div className="space-y-1.5"><Label>Visibility</Label>
              <Select value={form.visibility} onValueChange={(v) => setForm({ ...form, visibility: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">Private</SelectItem>
                  <SelectItem value="public">Public</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1.5"><Label>Instructor</Label>
              <Select value={form.instructor_id || "none"} onValueChange={(v) => setForm({ ...form, instructor_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Select instructor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {(instructors ?? []).map((i: any) => (
                    <SelectItem key={i.profile_id} value={i.profile_id}>{i.profiles?.full_name ?? "User"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Co-instructors</Label>
              <p className="text-xs text-muted-foreground">Assigned instructors can manage lessons, quizzes, assignments and live classes for this course.</p>
              <div className="rounded-md border border-border p-3 max-h-40 overflow-y-auto space-y-2">
                {(instructors ?? [])
                  .filter((i: any) => i.profile_id !== form.instructor_id)
                  .map((i: any) => (
                  <label key={i.profile_id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={coInstructorIds.includes(i.profile_id)}
                      onCheckedChange={(v) => {
                        setCoInstructorIds((prev) =>
                          v ? Array.from(new Set([...prev, i.profile_id])) : prev.filter((id) => id !== i.profile_id)
                        );
                      }}
                    />
                    <span>{i.profiles?.full_name ?? "User"}</span>
                  </label>
                ))}
                {(instructors ?? []).filter((i: any) => i.profile_id !== form.instructor_id).length === 0 && (
                  <div className="text-xs text-muted-foreground">No additional instructors available.</div>
                )}
              </div>
            </div>
            <div className="space-y-1.5"><Label>SEO title</Label><Input value={form.seo_title} onChange={(e) => setForm({ ...form, seo_title: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>SEO description</Label><Input value={form.seo_description} onChange={(e) => setForm({ ...form, seo_description: e.target.value })} /></div>
            <div className="col-span-2 space-y-1.5">
              <Label>Passing Percentage Required for Certification</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={form.passing_percentage}
                onChange={(e) => setForm({ ...form, passing_percentage: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Students must score at least this percentage across all quizzes (and complete every lesson and assignment) to earn the course certificate. Default: 90%.
              </p>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Certificate template</Label>
              <Select
                value={form.certificate_template_id || "default"}
                onValueChange={(v) => setForm({ ...form, certificate_template_id: v === "default" ? "" : v })}
              >
                <SelectTrigger><SelectValue placeholder="Use system default" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Use system default</SelectItem>
                  {(certTemplates as any[]).map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}{t.is_default ? " (default)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Issued to students who complete this course. Leave on "Use system default" to follow the workspace default template.
              </p>
            </div>
          </div>

          <Separator />
          <div className="space-y-3">
            <div>
              <h3 className="font-semibold">Pricing</h3>
              <p className="text-xs text-muted-foreground">Configure how learners pay for this course.</p>
            </div>
            <div className="inline-flex rounded-md border border-border p-1 bg-muted/40">
              {(["free", "paid"] as const).map((t) => (
                <button key={t} type="button"
                  className={`px-4 py-1.5 text-sm rounded ${form.pricing_type === t ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}
                  onClick={() => setForm({ ...form, pricing_type: t })}>{t === "free" ? "Free" : "Paid"}</button>
              ))}
            </div>

            {form.pricing_type === "paid" && (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5"><Label>Currency</Label>
                    <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="INR">INR (₹)</SelectItem>
                        <SelectItem value="USD">USD ($)</SelectItem>
                        <SelectItem value="EUR">EUR (€)</SelectItem>
                        <SelectItem value="GBP">GBP (£)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5"><Label>Base price</Label>
                    <Input type="number" min={0} value={form.price_amount} onChange={(e) => setForm({ ...form, price_amount: e.target.value })} />
                  </div>
                  <div className="space-y-1.5"><Label>Sale price (optional)</Label>
                    <Input type="number" min={0} value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5"><Label>Discount type</Label>
                    <Select value={form.discount_type} onValueChange={(v) => setForm({ ...form, discount_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="percentage">Percentage</SelectItem>
                        <SelectItem value="fixed">Fixed amount</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5"><Label>Discount value</Label>
                    <Input type="number" min={0} value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: e.target.value })} disabled={form.discount_type === "none"} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 col-span-1">
                    <div className="space-y-1.5"><Label>Starts</Label>
                      <Input type="date" value={form.discount_starts_at} onChange={(e) => setForm({ ...form, discount_starts_at: e.target.value })} disabled={form.discount_type === "none"} />
                    </div>
                    <div className="space-y-1.5"><Label>Ends</Label>
                      <Input type="date" value={form.discount_ends_at} onChange={(e) => setForm({ ...form, discount_ends_at: e.target.value })} disabled={form.discount_type === "none"} />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 items-end">
                  <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                    <Label className="text-sm">GST</Label>
                    <Switch checked={form.gst_enabled} onCheckedChange={(v) => setForm({ ...form, gst_enabled: v })} />
                  </div>
                  <div className="space-y-1.5"><Label>GST rate (%)</Label>
                    <Input type="number" min={0} value={form.gst_rate} onChange={(e) => setForm({ ...form, gst_rate: e.target.value })} disabled={!form.gst_enabled} />
                  </div>
                  <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                    <Label className="text-sm">Tax inclusive</Label>
                    <Switch checked={form.tax_inclusive} onCheckedChange={(v) => setForm({ ...form, tax_inclusive: v })} />
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                  <Label className="text-sm">Allow coupons</Label>
                  <Switch checked={form.allow_coupons} onCheckedChange={(v) => setForm({ ...form, allow_coupons: v })} />
                </div>
              </>
            )}

            <div className="rounded-md border border-dashed border-border bg-muted/30 p-3">
              <div className="text-xs text-muted-foreground mb-1">Live preview</div>
              <CoursePrice course={previewCourse} size="md" />
              {form.pricing_type === "paid" && form.gst_enabled && form.gst_rate && (
                <div className="text-xs text-muted-foreground mt-1">{form.tax_inclusive ? "Inclusive" : "Exclusive"} of {form.gst_rate}% GST</div>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={!form.title || save.isPending}>{save.isPending ? "Saving…" : "Save course"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
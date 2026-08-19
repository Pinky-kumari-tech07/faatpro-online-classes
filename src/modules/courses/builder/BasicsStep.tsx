import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Upload, Loader2, X, Image as ImageIcon, Check } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import RichTextEditor from "@/components/editor/RichTextEditor";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LANGUAGES, BOARDS } from "@/modules/courses/constants";
import RevenueModelSection from "@/modules/finance/revenue/RevenueModelSection";
import { useAuth } from "@/shared/hooks/useAuth";
import { useWorkspace } from "@/shared/hooks/useWorkspace";
import { courseLifecycleService } from "@/services/supabase/courseLifecycleService";

const DIFFICULTIES = [
  { v: "beginner", label: "Beginner" },
  { v: "intermediate", label: "Intermediate" },
  { v: "advanced", label: "Advanced" },
  { v: "expert", label: "Expert" },
];
const BADGE_OPTIONS = ["Featured", "Best Seller", "New", "Trending", "Editor's Choice"];

function slugify(s: string) {
  return (s || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export default function BasicsStep({
  form,
  setForm,
  workspaceId,
}: {
  form: any;
  setForm: (updater: (f: any) => any) => void;
  workspaceId: string;
}) {
  const [uploadingThumb, setUploadingThumb] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [slugTouched, setSlugTouched] = useState(!!form.slug);
  const { user } = useAuth();
  const { primaryRole } = useWorkspace();
  const canAssign = primaryRole === "organization_admin" || primaryRole === "super_admin";

  const { data: assignableInstructors = [] } = useQuery({
    queryKey: ["basics-active-instructors"],
    queryFn: () => courseLifecycleService.listActiveInstructors(),
    enabled: canAssign,
  });

  // Default owner: admin → self, instructor → self (only when unset)
  useEffect(() => {
    if (!user?.id) return;
    if (form.instructor_id) return;
    setForm((f: any) => (f.instructor_id ? f : { ...f, instructor_id: user.id }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (!slugTouched && form.title) {
      const auto = slugify(form.title);
      setForm((f) => (f.slug === auto ? f : { ...f, slug: auto }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.title]);

  const { data: categories = [] } = useQuery({
    queryKey: ["builder-categories"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("course_categories")
        .select("id, name, slug, parent_id, status")
        .eq("status", "active")
        .order("name");
      return data ?? [];
    },
  });

  const parents = categories.filter((c: any) => !c.parent_id);
  const parentRow = parents.find((p: any) => p.name === form.category);
  const subcats = categories.filter((c: any) => parentRow && c.parent_id === parentRow.id);
  const subRow = subcats.find((s: any) => s.name === form.subcategory);
  const childCats = categories.filter((c: any) => subRow && c.parent_id === subRow.id);

  const languages: string[] = Array.isArray(form.languages)
    ? form.languages
    : form.language
    ? [form.language]
    : [];
  const boards: string[] = Array.isArray(form.boards) ? form.boards : [];
  const toggleLang = (l: string) =>
    setForm((f) => {
      const cur: string[] = Array.isArray(f.languages) ? f.languages : f.language ? [f.language] : [];
      const next = cur.includes(l) ? cur.filter((x) => x !== l) : [...cur, l];
      return { ...f, languages: next, language: next[0] ?? "English" };
    });
  const toggleBoard = (b: string) =>
    setForm((f) => {
      const cur: string[] = Array.isArray(f.boards) ? f.boards : [];
      return { ...f, boards: cur.includes(b) ? cur.filter((x) => x !== b) : [...cur, b] };
    });

  // Tags suggestions from other published courses in workspace
  const { data: tagSuggestions = [] } = useQuery({
    queryKey: ["builder-tag-suggestions", workspaceId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("courses").select("tags").eq("workspace_id", workspaceId).limit(200);
      const set = new Set<string>();
      (data ?? []).forEach((r: any) => (r.tags ?? []).forEach((t: string) => t && set.add(t)));
      return Array.from(set).sort();
    },
  });
  const [tagInput, setTagInput] = useState("");
  const tags: string[] = Array.isArray(form.tags) ? form.tags : [];
  const addTag = (raw: string) => {
    const t = (raw || "").trim();
    if (!t) return;
    if (tags.includes(t)) return;
    setForm((f) => ({ ...f, tags: [...tags, t] }));
    setTagInput("");
  };
  const removeTag = (t: string) => setForm((f) => ({ ...f, tags: tags.filter((x) => x !== t) }));
  const toggleBadge = (b: string) => {
    const cur: string[] = Array.isArray(form.badges) ? form.badges : [];
    setForm((f) => ({
      ...f,
      badges: cur.includes(b) ? cur.filter((x) => x !== b) : [...cur, b],
    }));
  };

  async function uploadThumb(file: File) {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Choose an image.", variant: "destructive" });
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      toast({ title: "Too large", description: "Max 4MB.", variant: "destructive" });
      return;
    }
    setUploadingThumb(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${workspaceId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage
        .from("course-thumbnails")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("course-thumbnails").getPublicUrl(path);
      setForm((f) => ({ ...f, thumbnail_url: data.publicUrl }));
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setUploadingThumb(false);
    }
  }

  async function uploadVideo(file: File) {
    if (!file.type.startsWith("video/")) {
      toast({ title: "Invalid file", description: "Choose a video.", variant: "destructive" });
      return;
    }
    if (file.size > 200 * 1024 * 1024) {
      toast({ title: "Too large", description: "Max 200MB.", variant: "destructive" });
      return;
    }
    setUploadingVideo(true);
    try {
      const ext = file.name.split(".").pop() || "mp4";
      const path = `${workspaceId}/intro/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage
        .from("course-thumbnails")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("course-thumbnails").getPublicUrl(path);
      setForm((f) => ({ ...f, intro_video_url: data.publicUrl, intro_video_provider: "upload" }));
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setUploadingVideo(false);
    }
  }

  const slug = form.slug || slugify(form.title);
  const previewUrl = `/courses/${slug || "your-course"}`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <Card className="p-6 border-border shadow-none space-y-5">
          <div>
            <h3 className="font-semibold mb-1">Course information</h3>
            <p className="text-sm text-muted-foreground">Title, slug, and a public-facing URL.</p>
          </div>
          <div className="space-y-2">
            <Label>Course title <span className="text-destructive">*</span></Label>
            <Input
              value={form.title || ""}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Mastering React from Scratch"
            />
          </div>
          <div className="space-y-2">
            <Label>Course slug</Label>
            <Input
              value={form.slug || ""}
              onChange={(e) => {
                setSlugTouched(true);
                setForm((f) => ({ ...f, slug: slugify(e.target.value) }));
              }}
              placeholder="auto-generated-from-title"
            />
            <div className="text-xs text-muted-foreground break-all">
              URL preview: <span className="font-mono text-foreground">{previewUrl}</span>
            </div>
          </div>
        </Card>

        {canAssign && (
          <Card className="p-6 border-border shadow-none space-y-3">
            <div>
              <h3 className="font-semibold">Instructor (owner)</h3>
              <p className="text-sm text-muted-foreground">
                Assign during course creation. You can change this later from Transfer instructor.
              </p>
            </div>
            <Select
              value={form.instructor_id || (user?.id ?? "")}
              onValueChange={(v) => setForm((f: any) => ({ ...f, instructor_id: v }))}
            >
              <SelectTrigger><SelectValue placeholder="Select instructor" /></SelectTrigger>
              <SelectContent>
                {user?.id && (
                  <SelectItem value={user.id}>Me (default)</SelectItem>
                )}
                {(assignableInstructors as any[])
                  .filter((i) => i.id !== user?.id)
                  .map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.full_name || i.email}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </Card>
        )}

        <Card className="p-6 border-border shadow-none space-y-3">
          <div>
            <h3 className="font-semibold">Course description</h3>
            <p className="text-sm text-muted-foreground">
              Rich-text description shown on the course detail page.
            </p>
          </div>
          <RichTextEditor
            value={form.description || ""}
            onChange={(html) => setForm((f) => ({ ...f, description: html }))}
          />
        </Card>

        <Card className="p-6 border-border shadow-none space-y-5">
          <h3 className="font-semibold">Category, level & language</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={form.category || "_none"}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, category: v === "_none" ? "" : v, subcategory: "", child_category: "" }))
                }
              >
                <SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Uncategorized</SelectItem>
                  {parents.map((c: any) => (
                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Subcategory</Label>
              <Select
                value={form.subcategory || "_none"}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, subcategory: v === "_none" ? "" : v, child_category: "" }))
                }
                disabled={!form.category || subcats.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={subcats.length ? "Choose" : "—"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">None</SelectItem>
                  {subcats.map((c: any) => (
                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Child category</Label>
              <Select
                value={form.child_category || "_none"}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, child_category: v === "_none" ? "" : v }))
                }
                disabled={!form.subcategory || childCats.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={childCats.length ? "Choose" : "—"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">None</SelectItem>
                  {childCats.map((c: any) => (
                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Difficulty</Label>
              <Select
                value={form.difficulty || "beginner"}
                onValueChange={(v) => setForm((f) => ({ ...f, difficulty: v, level: v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DIFFICULTIES.map((d) => (
                    <SelectItem key={d.v} value={d.v}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Languages <span className="text-xs text-muted-foreground">(multi-select)</span></Label>
            <div className="flex flex-wrap gap-2">
              {LANGUAGES.map((l) => {
                const on = languages.includes(l);
                return (
                  <button
                    key={l}
                    type="button"
                    onClick={() => toggleLang(l)}
                    className={`text-xs px-2.5 py-1 rounded-full border inline-flex items-center gap-1 ${on ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
                  >
                    {on && <Check className="h-3 w-3" />} {l}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Boards <span className="text-xs text-muted-foreground">(multi-select, optional)</span></Label>
            <div className="flex flex-wrap gap-2">
              {BOARDS.map((b) => {
                const on = boards.includes(b);
                return (
                  <button
                    key={b}
                    type="button"
                    onClick={() => toggleBoard(b)}
                    className={`text-xs px-2.5 py-1 rounded-full border inline-flex items-center gap-1 ${on ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
                  >
                    {on && <Check className="h-3 w-3" />} {b}
                  </button>
                );
              })}
            </div>
          </div>
        </Card>

        <Card className="p-6 border-border shadow-none space-y-4">
          <div>
            <h3 className="font-semibold">Tags</h3>
            <p className="text-sm text-muted-foreground">Help students find this course. Press Enter to add.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {tags.map((t) => (
              <Badge key={t} variant="secondary" className="gap-1 pl-2 pr-1 py-1">
                {t}
                <button onClick={() => removeTag(t)} className="hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          <Input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(tagInput); }
              if (e.key === "Backspace" && !tagInput && tags.length) removeTag(tags[tags.length - 1]);
            }}
            placeholder="GST, Taxation, Excel…"
            list="tag-suggestions"
          />
          <datalist id="tag-suggestions">
            {tagSuggestions.filter((t: string) => !tags.includes(t)).map((t: string) => (
              <option key={t} value={t} />
            ))}
          </datalist>
          {tagSuggestions.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {tagSuggestions
                .filter((t: string) => !tags.includes(t))
                .slice(0, 12)
                .map((t: string) => (
                  <button
                    key={t}
                    onClick={() => addTag(t)}
                    className="text-xs px-2 py-0.5 rounded-full border border-border hover:bg-muted"
                  >
                    + {t}
                  </button>
                ))}
            </div>
          )}
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="p-5 border-border shadow-none space-y-4">
          <h3 className="font-semibold">Featured thumbnail</h3>
          <div className="aspect-video rounded-lg border border-dashed border-border bg-muted/30 overflow-hidden flex items-center justify-center">
            {form.thumbnail_url ? (
              <img src={form.thumbnail_url} alt="thumbnail" className="h-full w-full object-cover" />
            ) : (
              <ImageIcon className="h-8 w-8 text-muted-foreground" />
            )}
          </div>
          <div className="flex gap-2">
            <label className="flex-1 inline-flex items-center justify-center gap-2 cursor-pointer rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-muted">
              {uploadingThumb ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              <span>{uploadingThumb ? "Uploading…" : "Upload image"}</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploadingThumb}
                onChange={(e) => e.target.files?.[0] && uploadThumb(e.target.files[0])}
              />
            </label>
            {form.thumbnail_url && (
              <Button variant="ghost" size="icon" onClick={() => setForm((f) => ({ ...f, thumbnail_url: "" }))}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </Card>

        <Card className="p-5 border-border shadow-none space-y-3">
          <h3 className="font-semibold">Intro video</h3>
          <RadioGroup
            value={form.intro_video_provider || "url"}
            onValueChange={(v) => setForm((f) => ({ ...f, intro_video_provider: v }))}
            className="grid grid-cols-2 gap-2"
          >
            {[
              { v: "upload", label: "Upload" },
              { v: "youtube", label: "YouTube" },
              { v: "vimeo", label: "Vimeo" },
              { v: "url", label: "External URL" },
            ].map((o) => (
              <label
                key={o.v}
                className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm cursor-pointer hover:bg-muted/40"
              >
                <RadioGroupItem value={o.v} />
                {o.label}
              </label>
            ))}
          </RadioGroup>
          {form.intro_video_provider === "upload" ? (
            <label className="inline-flex w-full items-center justify-center gap-2 cursor-pointer rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-muted">
              {uploadingVideo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              <span>{uploadingVideo ? "Uploading…" : "Upload video"}</span>
              <input
                type="file"
                accept="video/*"
                className="hidden"
                disabled={uploadingVideo}
                onChange={(e) => e.target.files?.[0] && uploadVideo(e.target.files[0])}
              />
            </label>
          ) : (
            <Input
              value={form.intro_video_url || ""}
              onChange={(e) => setForm((f) => ({ ...f, intro_video_url: e.target.value }))}
              placeholder="https://…"
            />
          )}
          {form.intro_video_url && (
            <div className="text-xs text-muted-foreground break-all">{form.intro_video_url}</div>
          )}
        </Card>

        <Card className="p-5 border-border shadow-none space-y-4">
          <h3 className="font-semibold">Pricing</h3>
          <RadioGroup
            value={form.pricing_type || "free"}
            onValueChange={(v) => setForm((f) => ({ ...f, pricing_type: v }))}
            className="grid grid-cols-2 gap-2"
          >
            <label className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm cursor-pointer hover:bg-muted/40">
              <RadioGroupItem value="free" /> Free
            </label>
            <label className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm cursor-pointer hover:bg-muted/40">
              <RadioGroupItem value="paid" /> Paid
            </label>
          </RadioGroup>
          {form.pricing_type === "paid" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Regular price</Label>
                  <Input
                    type="number"
                    value={form.price_amount ?? 0}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, price_amount: Number(e.target.value || 0) }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Sale price</Label>
                  <Input
                    type="number"
                    value={form.sale_price ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, sale_price: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Currency</Label>
                <Select
                  value={form.currency || "INR"}
                  onValueChange={(v) => setForm((f) => ({ ...f, currency: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["INR", "USD", "EUR", "GBP", "AUD", "CAD", "AED"].map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </Card>

        <Card className="p-5 border-border shadow-none space-y-4">
          <h3 className="font-semibold">Course access</h3>
          <RadioGroup
            value={form.visibility || "public"}
            onValueChange={(v) => setForm((f) => ({ ...f, visibility: v }))}
            className="space-y-2"
          >
            {[
              { v: "public", t: "Public", d: "Listed in catalog & searchable." },
              { v: "private", t: "Private", d: "Hidden — invitation/enrollment only." },
              { v: "password_protected", t: "Password protected", d: "Visible but requires password to enroll." },
            ].map((o) => (
              <label key={o.v} className="flex items-start gap-2 rounded-md border border-border p-3 text-sm cursor-pointer hover:bg-muted/40">
                <RadioGroupItem value={o.v} className="mt-0.5" />
                <div>
                  <div className="font-medium">{o.t}</div>
                  <div className="text-xs text-muted-foreground">{o.d}</div>
                </div>
              </label>
            ))}
          </RadioGroup>
          {form.visibility === "password_protected" && (
            <div className="space-y-1.5">
              <Label>Course password</Label>
              <Input
                type="text"
                value={form.course_password || ""}
                onChange={(e) => setForm((f) => ({ ...f, course_password: e.target.value }))}
                placeholder="Set a password"
              />
            </div>
          )}
        </Card>

        <Card className="p-5 border-border shadow-none space-y-4">
          <h3 className="font-semibold">Course preview</h3>
          <RadioGroup
            value={form.preview_mode || "selected_lessons"}
            onValueChange={(v) => setForm((f) => ({ ...f, preview_mode: v, allow_preview: v !== "none" }))}
            className="space-y-2"
          >
            {[
              { v: "full", t: "Preview entire curriculum" },
              { v: "selected_lessons", t: "Preview selected lessons only" },
              { v: "none", t: "No preview" },
            ].map((o) => (
              <label key={o.v} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm cursor-pointer hover:bg-muted/40">
                <RadioGroupItem value={o.v} /> {o.t}
              </label>
            ))}
          </RadioGroup>
        </Card>

        <Card className="p-5 border-border shadow-none space-y-3">
          <h3 className="font-semibold">Other settings</h3>
          {[
            { k: "is_featured", label: "Featured course" },
            { k: "enable_discussion", label: "Enable discussion" },
            { k: "enable_certificates", label: "Enable certificates" },
          ].map((o) => (
            <label key={o.k} className="flex items-center gap-3 cursor-pointer">
              <Checkbox
                checked={!!form[o.k]}
                onCheckedChange={(v) => setForm((f) => ({ ...f, [o.k]: !!v }))}
              />
              <span className="text-sm">{o.label}</span>
            </label>
          ))}
        </Card>
      </div>

      {canAssign && (
        <RevenueModelSection
          value={form}
          currency={form.currency ?? "INR"}
          onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
        />
      )}
    </div>
  );
}
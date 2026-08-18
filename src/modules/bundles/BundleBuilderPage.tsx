import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, ArrowLeft, Search, Check, X, BookOpen, PackageOpen, Loader2, Upload, ImageIcon } from "lucide-react";
import { useWorkspace } from "@/shared/hooks/useWorkspace";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/modules/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import {
  createBundle, updateBundle, getBundle, getBundleCourses, listWorkspaceCourses, setBundleCourses, slugify,
  type AccessType, type BundleStatus, type CertificateMode,
} from "./bundlesService";

export default function BundleBuilderPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { membership } = useWorkspace();
  const wsId = membership?.workspace.id;
  const qc = useQueryClient();

  const [form, setForm] = useState({
    name: "",
    slug: "",
    short_description: "",
    description: "",
    thumbnail_url: "",
    banner_url: "",
    category: "",
    regular_price: 0,
    sale_price: "" as string | number,
    currency: "INR",
    access_type: "lifetime" as AccessType,
    access_duration: "" as string | number,
    status: "draft" as BundleStatus,
    certificate_mode: "individual" as CertificateMode,
  });
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [uploadingThumb, setUploadingThumb] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  async function uploadImage(file: File, kind: "thumbnail" | "banner") {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Choose an image.", variant: "destructive" });
      return;
    }
    const maxMb = kind === "banner" ? 6 : 4;
    if (file.size > maxMb * 1024 * 1024) {
      toast({ title: "Too large", description: `Max ${maxMb}MB.`, variant: "destructive" });
      return;
    }
    const setUploading = kind === "banner" ? setUploadingBanner : setUploadingThumb;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${wsId}/bundles/${kind}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage
        .from("course-thumbnails")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("course-thumbnails").getPublicUrl(path);
      setForm((f) => ({ ...f, [`${kind}_url`]: data.publicUrl } as any));
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  const { data: existing } = useQuery({
    queryKey: ["bundle", id],
    queryFn: () => getBundle(id!),
    enabled: isEdit,
  });
  const { data: existingCourses } = useQuery({
    queryKey: ["bundle-courses", id],
    queryFn: () => getBundleCourses(id!),
    enabled: isEdit,
  });
  const { data: courses = [] } = useQuery({
    queryKey: ["workspace-courses", wsId],
    queryFn: () => listWorkspaceCourses(wsId!),
    enabled: !!wsId,
  });

  useEffect(() => {
    if (existing) {
      setForm({
        name: existing.name,
        slug: existing.slug,
        short_description: existing.short_description ?? "",
        description: existing.description ?? "",
        thumbnail_url: existing.thumbnail_url ?? "",
        banner_url: existing.banner_url ?? "",
        category: existing.category ?? "",
        regular_price: Number(existing.regular_price),
        sale_price: existing.sale_price ?? "",
        currency: existing.currency,
        access_type: existing.access_type,
        access_duration: existing.access_duration ?? "",
        status: existing.status,
        certificate_mode: existing.certificate_mode,
      });
    }
  }, [existing]);

  useEffect(() => {
    if (existingCourses) setSelectedCourses(existingCourses.map((c: any) => c.course_id));
  }, [existingCourses]);

  const filteredCourses = useMemo(
    () => courses.filter((c: any) => c.title.toLowerCase().includes(search.toLowerCase())),
    [courses, search]
  );

  const save = useMutation({
    mutationFn: async () => {
      if (!wsId) throw new Error("No workspace");
      if (!form.name.trim()) throw new Error("Bundle name is required");
      const payload: any = {
        workspace_id: wsId,
        name: form.name.trim(),
        slug: form.slug?.trim() || slugify(form.name),
        short_description: form.short_description || null,
        description: form.description || null,
        thumbnail_url: form.thumbnail_url || null,
        banner_url: form.banner_url || null,
        category: form.category || null,
        regular_price: Number(form.regular_price) || 0,
        sale_price: form.sale_price === "" ? null : Number(form.sale_price),
        currency: form.currency,
        access_type: form.access_type,
        access_duration: form.access_type === "lifetime" || form.access_duration === ""
          ? null : Number(form.access_duration),
        status: form.status,
        certificate_mode: form.certificate_mode,
      };
      const bundle = isEdit ? await updateBundle(id!, payload) : await createBundle(payload);
      await setBundleCourses(bundle.id, wsId, selectedCourses);
      return bundle;
    },
    onSuccess: (b) => {
      qc.invalidateQueries({ queryKey: ["bundles"] });
      qc.invalidateQueries({ queryKey: ["bundle", b.id] });
      qc.invalidateQueries({ queryKey: ["bundle-courses", b.id] });
      toast({ title: isEdit ? "Bundle updated" : "Bundle created" });
      navigate(`/app/bundles/${b.id}`);
    },
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const toggleCourse = (cid: string) =>
    setSelectedCourses((prev) => (prev.includes(cid) ? prev.filter((x) => x !== cid) : [...prev, cid]));

  return (
    <div className="container mx-auto py-6 space-y-6">
      <PageHeader
        title={isEdit ? "Edit bundle" : "Create bundle"}
        description="Group courses into a single package students can buy or be assigned together."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/app/bundles")}>
              <ArrowLeft className="h-4 w-4 mr-2" />Back
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save bundle
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT — Details */}
        <div className="space-y-4">
          <Card className="p-5 space-y-4">
            <h3 className="font-semibold">Bundle details</h3>
            <div className="space-y-2">
              <Label>Bundle name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: form.slug || slugify(e.target.value) })} placeholder="Complete Digital Marketing Mastery" />
            </div>
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="complete-digital-marketing-mastery" />
            </div>
            <div className="space-y-2">
              <Label>Short description</Label>
              <Input value={form.short_description} onChange={(e) => setForm({ ...form, short_description: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Full description</Label>
              <Textarea rows={5} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Thumbnail</Label>
                <div className="aspect-video w-full rounded-md border bg-muted overflow-hidden flex items-center justify-center">
                  {form.thumbnail_url ? (
                    <img src={form.thumbnail_url} alt="thumbnail" className="h-full w-full object-cover" />
                  ) : (
                    <ImageIcon className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <label className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-md border cursor-pointer hover:bg-muted">
                    {uploadingThumb ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    <span>{uploadingThumb ? "Uploading…" : form.thumbnail_url ? "Replace" : "Upload image"}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploadingThumb}
                      onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0], "thumbnail")}
                    />
                  </label>
                  {form.thumbnail_url && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setForm({ ...form, thumbnail_url: "" })}>
                      Remove
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Recommended 1280×720. Max 4MB.</p>
              </div>
              <div className="space-y-2">
                <Label>Banner</Label>
                <div className="aspect-[3/1] w-full rounded-md border bg-muted overflow-hidden flex items-center justify-center">
                  {form.banner_url ? (
                    <img src={form.banner_url} alt="banner" className="h-full w-full object-cover" />
                  ) : (
                    <ImageIcon className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <label className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-md border cursor-pointer hover:bg-muted">
                    {uploadingBanner ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    <span>{uploadingBanner ? "Uploading…" : form.banner_url ? "Replace" : "Upload image"}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploadingBanner}
                      onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0], "banner")}
                    />
                  </label>
                  {form.banner_url && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setForm({ ...form, banner_url: "" })}>
                      Remove
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Recommended 1920×640. Max 6MB.</p>
              </div>
            </div>
          </Card>

          <Card className="p-5 space-y-4">
            <h3 className="font-semibold">Pricing & access</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Regular price</Label>
                <Input type="number" value={form.regular_price} onChange={(e) => setForm({ ...form, regular_price: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>Sale price</Label>
                <Input type="number" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Access type</Label>
                <Select value={form.access_type} onValueChange={(v: AccessType) => setForm({ ...form, access_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lifetime">Lifetime</SelectItem>
                    <SelectItem value="days">Days</SelectItem>
                    <SelectItem value="months">Months</SelectItem>
                    <SelectItem value="years">Years</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.access_type !== "lifetime" && (
                <div className="space-y-2">
                  <Label>Duration</Label>
                  <Input type="number" min={1} value={form.access_duration} onChange={(e) => setForm({ ...form, access_duration: e.target.value })} />
                </div>
              )}
            </div>
          </Card>

          <Card className="p-5 space-y-4">
            <h3 className="font-semibold">Status & certificates</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v: BundleStatus) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Certificate</Label>
                <Select value={form.certificate_mode} onValueChange={(v: CertificateMode) => setForm({ ...form, certificate_mode: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual">Individual course certificates</SelectItem>
                    <SelectItem value="bundle">Bundle completion certificate only</SelectItem>
                    <SelectItem value="both">Both individual + bundle</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </div>
          </Card>
        </div>

        {/* RIGHT — Course selector */}
        <div className="space-y-4">
          <Card className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Included courses</h3>
              <Badge variant="secondary">{selectedCourses.length} selected</Badge>
            </div>

            {selectedCourses.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedCourses.map((cid) => {
                  const c = courses.find((x: any) => x.id === cid);
                  if (!c) return null;
                  return (
                    <Badge key={cid} variant="secondary" className="pl-2 pr-1 py-1 gap-1">
                      <BookOpen className="h-3 w-3" />
                      <span className="max-w-[160px] truncate">{(c as any).title}</span>
                      <button type="button" onClick={() => toggleCourse(cid)} className="ml-1 rounded-sm hover:bg-muted p-0.5">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  );
                })}
              </div>
            )}

            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Search courses..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>

            <div className="max-h-[480px] overflow-y-auto border rounded-md divide-y">
              {filteredCourses.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">No courses found.</div>
              ) : (
                filteredCourses.map((c: any) => {
                  const checked = selectedCourses.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleCourse(c.id)}
                      className={cn("w-full flex items-center gap-3 p-2.5 text-left hover:bg-muted/50 transition-colors", checked && "bg-primary/5")}
                    >
                      <div className="h-9 w-9 rounded bg-muted overflow-hidden shrink-0 flex items-center justify-center">
                        {c.thumbnail_url ? <img src={c.thumbnail_url} className="h-full w-full object-cover" /> : <BookOpen className="h-4 w-4 text-muted-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{c.title}</div>
                        <div className="text-xs text-muted-foreground capitalize">{c.status} · {c.currency} {c.price_amount}</div>
                      </div>
                      <div className={cn("h-5 w-5 rounded-full border flex items-center justify-center shrink-0", checked && "bg-primary border-primary text-primary-foreground")}>
                        {checked && <Check className="h-3 w-3" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

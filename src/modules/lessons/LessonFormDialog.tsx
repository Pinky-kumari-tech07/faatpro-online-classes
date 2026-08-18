import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/use-toast";
import { Upload, Loader2, FileText, Video as VideoIcon, X, Plus } from "lucide-react";
import { useManageableCourses } from "@/shared/hooks/useManageableCourses";
import { CourseSelectItems } from "@/shared/components/CourseSelectItems";
import { useRealtimeInvalidate } from "@/shared/hooks/useRealtimeInvalidate";

function parseYouTubeId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?[^#]*v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function getDurationFromVideoSrc(src: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    v.crossOrigin = "anonymous";
    const cleanup = () => {
      v.removeAttribute("src");
      v.load();
    };
    v.onloadedmetadata = () => {
      const d = Number.isFinite(v.duration) ? Math.round(v.duration) : 0;
      cleanup();
      resolve(d);
    };
    v.onerror = () => {
      cleanup();
      reject(new Error("Could not read video metadata"));
    };
    v.src = src;
  });
}

let ytApiPromise: Promise<void> | null = null;
function loadYouTubeApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("No window"));
  if ((window as any).YT && (window as any).YT.Player) return Promise.resolve();
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise((resolve) => {
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
    (window as any).onYouTubeIframeAPIReady = () => resolve();
  });
  return ytApiPromise;
}

function getYouTubeDuration(videoId: string): Promise<number> {
  return new Promise(async (resolve, reject) => {
    try {
      await loadYouTubeApi();
      const host = document.createElement("div");
      host.style.position = "fixed";
      host.style.left = "-9999px";
      host.style.width = "1px";
      host.style.height = "1px";
      const mount = document.createElement("div");
      host.appendChild(mount);
      document.body.appendChild(host);
      const YT = (window as any).YT;
      const player = new YT.Player(mount, {
        videoId,
        events: {
          onReady: () => {
            const tryGet = (attempt = 0) => {
              const d = player.getDuration?.();
              if (d && Number.isFinite(d) && d > 0) {
                try { player.destroy(); } catch {}
                host.remove();
                resolve(Math.round(d));
              } else if (attempt < 10) {
                setTimeout(() => tryGet(attempt + 1), 250);
              } else {
                try { player.destroy(); } catch {}
                host.remove();
                reject(new Error("YouTube duration unavailable"));
              }
            };
            tryGet();
          },
          onError: () => {
            try { player.destroy(); } catch {}
            host.remove();
            reject(new Error("YouTube player error"));
          },
        },
      });
    } catch (e) {
      reject(e);
    }
  });
}

function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m === 0) return `${r} sec`;
  return `${m} min ${r} sec`;
}

export default function LessonFormDialog({
  open, onOpenChange, initial, workspaceId, courseId, defaultSectionId,
}: {
  open: boolean; onOpenChange: (v: boolean) => void; initial: any;
  workspaceId: string; courseId?: string; defaultSectionId?: string | null;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<any>({
    title: "", course_id: courseId ?? "", section_id: defaultSectionId ?? "",
    lesson_type: "video", content: "", asset_url: "", duration_seconds: 0,
    position: 0, is_preview: false,
  });
  const [uploading, setUploading] = useState(false);
  const [detectingDuration, setDetectingDuration] = useState(false);
  const [durationAutoFilled, setDurationAutoFilled] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [creatingSection, setCreatingSection] = useState(false);
  const [showNewSectionInput, setShowNewSectionInput] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const lastDetectedUrlRef = useRef<string>("");

  useEffect(() => {
    if (initial) setForm({ ...initial, section_id: initial.section_id ?? "" });
    else setForm({
      title: "", course_id: courseId ?? "", section_id: defaultSectionId ?? "",
      lesson_type: "video", content: "", asset_url: "", duration_seconds: 0,
      position: 0, is_preview: false,
    });
    setShowNewSectionInput(false);
    setNewSectionTitle("");
    setDurationAutoFilled(!!initial?.duration_seconds);
    lastDetectedUrlRef.current = initial?.asset_url ?? "";
  }, [initial, open, courseId, defaultSectionId]);

  const { courses, isLoading: coursesLoading, error: coursesError } = useManageableCourses({ enabled: open });

  useRealtimeInvalidate(["course_sections"], [["sections-for"]]);

  const { data: sections, isLoading: sectionsLoading, refetch: refetchSections } = useQuery({
    queryKey: ["sections-for", form.course_id],
    enabled: !!form.course_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_sections")
        .select("id, title")
        .eq("course_id", form.course_id)
        .order("position");
      if (error) {
        console.error("[LessonFormDialog] sections query failed", error);
        throw error;
      }
      return data ?? [];
    },
  });

  const selectedCourse = courses.find((c: any) => c.id === form.course_id);

  async function createSectionInline() {
    if (!form.course_id || !newSectionTitle.trim()) return;
    setCreatingSection(true);
    try {
      const wsForCourse = selectedCourse?.workspace_id ?? workspaceId;
      const pos = (sections?.length ?? 0);
      const { data, error } = await supabase
        .from("course_sections")
        .insert({
          workspace_id: wsForCourse,
          course_id: form.course_id,
          title: newSectionTitle.trim(),
          position: pos,
        })
        .select("id, title")
        .single();
      if (error) throw error;
      await refetchSections();
      qc.invalidateQueries({ queryKey: ["sections", form.course_id] });
      setForm((f: any) => ({ ...f, section_id: data!.id }));
      setNewSectionTitle("");
      setShowNewSectionInput(false);
      toast({ title: "Section created" });
    } catch (e: any) {
      toast({ title: "Could not create section", description: e.message, variant: "destructive" });
    } finally {
      setCreatingSection(false);
    }
  }

  async function detectDurationFromUrl(url: string) {
    if (!url || url === lastDetectedUrlRef.current) return;
    lastDetectedUrlRef.current = url;
    setDetectingDuration(true);
    try {
      const ytId = parseYouTubeId(url);
      const seconds = ytId
        ? await getYouTubeDuration(ytId)
        : await getDurationFromVideoSrc(url);
      if (seconds > 0) {
        setForm((f: any) => ({ ...f, duration_seconds: seconds }));
        setDurationAutoFilled(true);
        toast({ title: "Duration detected", description: formatDuration(seconds) });
      }
    } catch (e: any) {
      console.warn("[LessonFormDialog] duration detection failed", e);
    } finally {
      setDetectingDuration(false);
    }
  }

  const save = useMutation({
    mutationFn: async () => {
      const selected = selectedCourse;
      const hasSections = (sections?.length ?? 0) > 0;
      if (hasSections && !form.section_id) {
        throw new Error("Please select a section for this lesson.");
      }
      const payload: any = {
        workspace_id: selected?.workspace_id ?? workspaceId,
        course_id: form.course_id,
        section_id: form.section_id || null,
        title: form.title,
        lesson_type: form.lesson_type,
        content: form.content || null,
        asset_url: form.asset_url || null,
        duration_seconds: Number(form.duration_seconds) || 0,
        position: Number(form.position) || 0,
        is_preview: !!form.is_preview,
      };
      if (initial?.id) {
        const { error } = await supabase.from("lessons").update(payload).eq("id", initial.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("lessons").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: initial ? "Lesson updated" : "Lesson created" });
      qc.invalidateQueries({ queryKey: ["lessons"] });
      qc.invalidateQueries({ queryKey: ["lessons-all"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const isUploadType = form.lesson_type === "pdf" || form.lesson_type === "video";
  const acceptAttr = form.lesson_type === "pdf" ? "application/pdf" : "video/*";
  const maxBytes = form.lesson_type === "pdf" ? 50 * 1024 * 1024 : 500 * 1024 * 1024;

  async function handleFileUpload(file: File) {
    if (form.lesson_type === "pdf" && file.type !== "application/pdf") {
      toast({ title: "Invalid file", description: "Please choose a PDF file.", variant: "destructive" });
      return;
    }
    if (form.lesson_type === "video" && !file.type.startsWith("video/")) {
      toast({ title: "Invalid file", description: "Please choose a video file.", variant: "destructive" });
      return;
    }
    if (file.size > maxBytes) {
      toast({ title: "File too large", description: `Max ${Math.round(maxBytes / 1024 / 1024)}MB.`, variant: "destructive" });
      return;
    }
    // Read duration locally before upload (video only)
    let detectedSeconds = 0;
    if (form.lesson_type === "video") {
      try {
        const objectUrl = URL.createObjectURL(file);
        detectedSeconds = await getDurationFromVideoSrc(objectUrl);
        URL.revokeObjectURL(objectUrl);
      } catch (e) {
        console.warn("[LessonFormDialog] could not read local video duration", e);
      }
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || (form.lesson_type === "pdf" ? "pdf" : "mp4");
      const path = `${workspaceId}/${courseId ?? "lesson"}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("lesson-files").upload(path, file, {
        cacheControl: "3600", upsert: false, contentType: file.type,
      });
      if (error) throw error;
      const { data: pub } = supabase.storage.from("lesson-files").getPublicUrl(path);
      lastDetectedUrlRef.current = pub.publicUrl;
      setForm((f: any) => ({
        ...f,
        asset_url: pub.publicUrl,
        duration_seconds: detectedSeconds > 0 ? detectedSeconds : f.duration_seconds,
      }));
      if (detectedSeconds > 0) setDurationAutoFilled(true);
      toast({
        title: "File uploaded",
        description: detectedSeconds > 0 ? `Duration: ${formatDuration(detectedSeconds)}` : undefined,
      });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const sectionsEmpty = !sectionsLoading && (sections?.length ?? 0) === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{initial ? "Edit lesson" : "New lesson"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5"><Label>Title</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            {!courseId && (
              <div className="space-y-1.5"><Label>Course</Label>
                <Select value={form.course_id} onValueChange={(v) => setForm({ ...form, course_id: v, section_id: "" })}>
                  <SelectTrigger><SelectValue placeholder="Choose course" /></SelectTrigger>
                  <SelectContent>
                    <CourseSelectItems courses={courses} isLoading={coursesLoading} error={coursesError} />
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Section {(sections?.length ?? 0) > 0 && <span className="text-destructive">*</span>}</Label>
              <Select
                value={form.section_id || (sectionsEmpty ? "none" : "")}
                onValueChange={(v) => setForm({ ...form, section_id: v === "none" ? "" : v })}
                disabled={!form.course_id || sectionsLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder={sectionsLoading ? "Loading sections…" : sectionsEmpty ? "No sections available" : "Choose section"} />
                </SelectTrigger>
                <SelectContent>
                  {sectionsLoading && <div className="px-3 py-2 text-xs text-muted-foreground">Loading…</div>}
                  {!sectionsLoading && (sections ?? []).map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>
                  ))}
                  {sectionsEmpty && (
                    <div className="px-3 py-2 text-xs text-muted-foreground">No sections available</div>
                  )}
                </SelectContent>
              </Select>
              {form.course_id && !showNewSectionInput && (
                <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setShowNewSectionInput(true)}>
                  <Plus className="h-3 w-3 mr-1" /> Create section
                </Button>
              )}
              {showNewSectionInput && (
                <div className="flex items-center gap-2">
                  <Input
                    autoFocus
                    placeholder="Section title"
                    value={newSectionTitle}
                    onChange={(e) => setNewSectionTitle(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); createSectionInline(); } }}
                  />
                  <Button type="button" size="sm" disabled={!newSectionTitle.trim() || creatingSection} onClick={createSectionInline}>
                    {creatingSection ? <Loader2 className="h-3 w-3 animate-spin" /> : "Add"}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => { setShowNewSectionInput(false); setNewSectionTitle(""); }}>
                    Cancel
                  </Button>
                </div>
              )}
            </div>
            <div className="space-y-1.5"><Label>Type</Label>
              <Select value={form.lesson_type} onValueChange={(v) => setForm({ ...form, lesson_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="pdf">PDF / resource</SelectItem>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="embed">Embed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>
                Duration {detectingDuration && <Loader2 className="inline h-3 w-3 animate-spin ml-1" />}
              </Label>
              <Input
                type="number"
                value={form.duration_seconds}
                readOnly={form.lesson_type === "video" && durationAutoFilled}
                onChange={(e) => setForm({ ...form, duration_seconds: e.target.value })}
              />
              <div className="text-[11px] text-muted-foreground">
                {form.duration_seconds > 0 ? formatDuration(Number(form.duration_seconds)) : form.lesson_type === "video" ? "Auto-detected from video / YouTube URL" : "Optional"}
              </div>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>{form.lesson_type === "pdf" ? "PDF file" : form.lesson_type === "video" ? "Video file or URL" : "Asset URL (embed)"}</Label>
              {isUploadType && (
                <div className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 p-3">
                  {form.asset_url ? (
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {form.lesson_type === "pdf" ? <FileText className="h-5 w-5 text-primary shrink-0" /> : <VideoIcon className="h-5 w-5 text-primary shrink-0" />}
                      <a href={form.asset_url} target="_blank" rel="noreferrer" className="text-sm text-primary truncate hover:underline">
                        {form.asset_url.split("/").pop()}
                      </a>
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7 ml-auto shrink-0" onClick={() => { setForm({ ...form, asset_url: "", duration_seconds: 0 }); setDurationAutoFilled(false); lastDetectedUrlRef.current = ""; }}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground flex-1">
                      {form.lesson_type === "pdf" ? "Upload a PDF up to 50MB." : "Upload a video up to 500MB, or paste a URL below."}
                    </div>
                  )}
                  <Button type="button" size="sm" variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>
                    {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    {uploading ? "Uploading…" : "Upload"}
                  </Button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept={acceptAttr}
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                  />
                </div>
              )}
              <Input
                value={form.asset_url}
                onChange={(e) => setForm({ ...form, asset_url: e.target.value })}
                onBlur={(e) => form.lesson_type === "video" && detectDurationFromUrl(e.target.value)}
                placeholder={form.lesson_type === "video" ? "https://youtube.com/watch?v=… or direct video URL" : form.lesson_type === "embed" ? "https://…" : "Or paste a URL"}
              />
            </div>
            <div className="col-span-2 space-y-1.5"><Label>Content / notes</Label>
              <Textarea rows={5} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
            </div>
            <div className="space-y-1.5"><Label>Position</Label>
              <Input type="number" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
            </div>
            <div className="flex items-center justify-between rounded-md border px-3">
              <Label>Preview (free)</Label>
              <Switch checked={form.is_preview} onCheckedChange={(v) => setForm({ ...form, is_preview: v })} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={
              !form.title ||
              !form.course_id ||
              save.isPending ||
              ((sections?.length ?? 0) > 0 && !form.section_id)
            }
            onClick={() => save.mutate()}
          >
            {save.isPending ? "Saving…" : "Save lesson"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
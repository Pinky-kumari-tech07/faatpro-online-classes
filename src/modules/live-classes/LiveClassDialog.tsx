import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { liveClassService } from "@/services/supabase";
import { useAuth } from "@/shared/hooks/useAuth";
import { toast } from "@/components/ui/use-toast";
import { CourseSelectItems } from "@/shared/components/CourseSelectItems";
import { useManageableCourses } from "@/shared/hooks/useManageableCourses";
import { Upload, Loader2, X } from "lucide-react";
import { normalizeMeetingUrl } from "@/lib/meetingUrl";
import { assertValid, validateDateOrder, validateMeetingUrl, validateName } from "@/lib/validators";
import { mapDbError } from "@/lib/errorMapper";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  workspaceId: string;
  initial: any | null;
}

function toLocal(dt?: string) {
  if (!dt) return "";
  const d = new Date(dt);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function LiveClassDialog({ open, onOpenChange, workspaceId, initial }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<any>({
    title: "", description: "", course_id: "", provider: "custom",
    meeting_url: "", starts_at: "", ends_at: "",
    status: "scheduled", recording_url: "",
    is_public: false, banner_url: "", thumbnail_url: "",
  });

  useEffect(() => {
    if (initial) {
      setForm({
        ...initial,
        starts_at: toLocal(initial.starts_at),
        ends_at: toLocal(initial.ends_at),
        course_id: initial.course_id ?? "",
      });
    } else {
      setForm({
        title: "", description: "", course_id: "", provider: "custom",
        meeting_url: "", starts_at: "", ends_at: "",
        status: "scheduled", recording_url: "", is_public: false,
        banner_url: "", thumbnail_url: "",
      });
    }
  }, [initial, open]);

  async function uploadBanner(file: File) {
    const okTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!okTypes.includes(file.type)) {
      toast({ title: "Invalid file", description: "Use JPG, PNG or WEBP.", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Too large", description: "Max 5MB.", variant: "destructive" });
      return;
    }
    setUploadingBanner(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${workspaceId}/live-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage
        .from("course-thumbnails")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("course-thumbnails").getPublicUrl(path);
      setForm((f: any) => ({ ...f, banner_url: data.publicUrl }));
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setUploadingBanner(false);
    }
  }

  const { courses, isLoading: coursesLoading, error: coursesError } = useManageableCourses({ enabled: open });

  const save = useMutation({
    mutationFn: async () => {
      const selected = courses.find((c: any) => c.id === form.course_id);
      const targetWs = selected?.workspace_id ?? workspaceId;
      assertValid([
        ["title", validateName(form.title, { label: "Title", required: true, min: 3 })],
        ["meeting_url", validateMeetingUrl(form.meeting_url, { required: true })],
        ["starts_at", form.starts_at ? { valid: true } as const : { valid: false, message: "Start time is required" } as const],
        ["ends_at", form.ends_at ? { valid: true } as const : { valid: false, message: "End time is required" } as const],
        ["order", validateDateOrder(form.starts_at, form.ends_at, {
          startLabel: "Start time",
          endLabel: "End time",
          allowEqual: false,
        })],
      ]);
      const url = normalizeMeetingUrl(form.meeting_url);
      const payload = {
        ...form,
        workspace_id: targetWs,
        course_id: form.course_id || null,
        instructor_id: form.instructor_id ?? user?.id ?? null,
        starts_at: new Date(form.starts_at).toISOString(),
        ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
        meeting_url: url,
        timezone: "Asia/Kolkata",
        max_participants: null,
        price: 0,
        waiting_room: false,
        recording_enabled: false,
        meeting_password: null,
      };
      delete payload.courses;
      delete payload.instructor;
      if (initial?.id) return liveClassService.update(initial.id, payload);
      return liveClassService.create(payload);
    },
    onSuccess: async () => {
      toast({ title: initial ? "Class updated" : "Class scheduled" });
      await qc.invalidateQueries({ queryKey: ["live-classes"] });
      await qc.refetchQueries({ queryKey: ["live-classes"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: "Could not save", description: mapDbError(e), variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{initial ? "Edit live class" : "Schedule live class"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 p-3 rounded-lg border">
            <div>
              <div className="text-sm font-medium">Public class</div>
              <div className="text-xs text-muted-foreground">Public classes are visible on the website. Private classes only reach assigned learners.</div>
            </div>
            <Switch checked={!!form.is_public} onCheckedChange={(v) => setForm({ ...form, is_public: v })} />
          </div>
          <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div><Label>Description</Label><Textarea value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} /></div>
          <div>
            <Label>Course (optional)</Label>
            <Select value={form.course_id || "__none__"} onValueChange={(v) => setForm({ ...form, course_id: v === "__none__" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— None —</SelectItem>
                <CourseSelectItems courses={courses} isLoading={coursesLoading} error={coursesError} />
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Starts at</Label><Input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} /></div>
            <div><Label>Ends at</Label><Input type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} /></div>
          </div>
          <div>
            <Label>Provider</Label>
            <Select value={form.provider} onValueChange={(v) => setForm({ ...form, provider: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="google_meet">Google Meet</SelectItem>
                <SelectItem value="zoom">Zoom</SelectItem>
                <SelectItem value="teams">Microsoft Teams</SelectItem>
                <SelectItem value="custom">Custom link</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Meeting URL</Label>
            <Input value={form.meeting_url ?? ""} onChange={(e) => setForm({ ...form, meeting_url: e.target.value })} placeholder="https://…" />
            <p className="mt-1 text-xs text-muted-foreground">Passwords, waiting room, and recording are managed by the meeting provider.</p>
          </div>
          <div className="space-y-2">
            <Label>Banner Image</Label>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files?.[0];
                if (f) uploadBanner(f);
              }}
              className={`rounded-lg border-2 border-dashed p-4 transition ${dragOver ? "border-primary bg-muted/40" : "border-border"}`}
            >
              {form.banner_url ? (
                <div className="space-y-3">
                  <div className="relative w-full overflow-hidden rounded-md bg-muted" style={{ aspectRatio: "16 / 9" }}>
                    <img src={form.banner_url} alt="Banner preview" className="h-full w-full object-cover" />
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploadingBanner}>
                      {uploadingBanner ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      <span className="ml-2">{uploadingBanner ? "Uploading…" : "Replace image"}</span>
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setForm({ ...form, banner_url: "" })}>
                      <X className="h-4 w-4" /><span className="ml-2">Remove</span>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
                  <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploadingBanner}>
                    {uploadingBanner ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    <span className="ml-2">{uploadingBanner ? "Uploading…" : "Upload Image"}</span>
                  </Button>
                  <p className="text-xs text-muted-foreground">Drag & drop or click to browse · JPG, PNG, WEBP · Max 5MB</p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadBanner(f);
                  e.target.value = "";
                }}
              />
            </div>
          </div>
          {initial && (
            <>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="live">Live</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Recording URL</Label><Input value={form.recording_url ?? ""} onChange={(e) => setForm({ ...form, recording_url: e.target.value })} /></div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={!form.title || !form.starts_at || save.isPending}>
            {initial ? "Save" : "Schedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
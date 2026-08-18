import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/shared/hooks/useAuth";
import { toast } from "@/components/ui/use-toast";
import { normalizeMeetingUrl } from "@/lib/meetingUrl";
import { assertValid, validateDateOrder, validateMeetingUrl, validateName } from "@/lib/validators";
import { mapDbError } from "@/lib/errorMapper";

function toLocal(dt?: string) {
  if (!dt) return "";
  const d = new Date(dt);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function LiveClassModal({
  open, onOpenChange, workspaceId, courseId, sectionId, initial,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  workspaceId: string;
  courseId: string;
  sectionId?: string | null;
  initial: any | null;
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [form, setForm] = useState<any>({
    title: "", provider: "google_meet", starts_at: "", ends_at: "",
    meeting_url: "", description: "",
  });

  useEffect(() => {
    if (initial) {
      setForm({
        title: initial.title ?? "",
        provider: initial.provider ?? "google_meet",
        starts_at: toLocal(initial.starts_at),
        ends_at: toLocal(initial.ends_at),
        meeting_url: initial.meeting_url ?? "",
        description: initial.description ?? "",
      });
    } else {
      setForm((f: any) => ({ ...f, title: "", starts_at: "", ends_at: "", meeting_url: "", description: "" }));
    }
  }, [initial, open]);

  const save = useMutation({
    mutationFn: async () => {
      const startsAt = form.starts_at ? new Date(form.starts_at) : null;
      const endsAt = form.ends_at ? new Date(form.ends_at) : null;
      assertValid([
        ["title", validateName(form.title, { label: "Title", required: true, min: 3 })],
        ["meeting_url", validateMeetingUrl(form.meeting_url, { required: true })],
        ["starts_at", startsAt ? { valid: true } as const : { valid: false, message: "Start time is required" } as const],
        ["ends_at", endsAt ? { valid: true } as const : { valid: false, message: "End time is required" } as const],
        ["order", validateDateOrder(form.starts_at, form.ends_at, {
          startLabel: "Start time",
          endLabel: "End time",
          allowEqual: false,
        })],
      ]);
      const url = normalizeMeetingUrl(form.meeting_url);
      const duration = Math.round((endsAt.getTime() - startsAt.getTime()) / 60000);
      const payload: any = {
        workspace_id: workspaceId,
        course_id: courseId,
        section_id: initial?.section_id ?? sectionId ?? null,
        instructor_id: user?.id ?? null,
        title: form.title,
        description: form.description || null,
        provider: form.provider,
        meeting_url: url,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        duration_minutes: duration,
        timezone: "Asia/Kolkata",
        status: "scheduled",
      };
      if (initial?.id) {
        const { error } = await (supabase.from("live_classes") as any).update(payload).eq("id", initial.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from("live_classes") as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: initial ? "Live class updated" : "Live class scheduled" });
      qc.invalidateQueries({ queryKey: ["builder-curriculum", courseId] });
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: "Could not save", description: mapDbError(e), variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{initial ? "Edit live class" : "New live class"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Provider</Label>
            <RadioGroup
              value={form.provider}
              onValueChange={(v) => setForm({ ...form, provider: v })}
              className="grid grid-cols-2 gap-2 sm:grid-cols-4"
            >
              {[
                { v: "google_meet", l: "Google Meet" },
                { v: "zoom", l: "Zoom" },
                { v: "teams", l: "Microsoft Teams" },
                { v: "custom", l: "Custom link" },
              ].map((o) => (
                <label key={o.v} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm cursor-pointer hover:bg-muted/40">
                  <RadioGroupItem value={o.v} /> {o.l}
                </label>
              ))}
            </RadioGroup>
          </div>
          <div className="space-y-1.5">
            <Label>Live class title</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Starts at</Label>
              <Input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Ends at</Label>
              <Input type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Meeting URL</Label>
            <Input value={form.meeting_url} onChange={(e) => setForm({ ...form, meeting_url: e.target.value })} placeholder="https://…" />
            <p className="text-xs text-muted-foreground">Passwords, waiting room, and recording are handled by the meeting provider.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={!form.title || !form.starts_at || save.isPending}>
            {save.isPending ? "Saving…" : "Save live class"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
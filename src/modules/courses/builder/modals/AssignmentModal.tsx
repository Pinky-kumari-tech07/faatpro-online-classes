import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";

const ALL_TYPES = ["pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "zip", "image"];

export default function AssignmentModal({
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
  const [form, setForm] = useState<any>({
    title: "", description: "", instructions: "", max_points: 100, due_at: "",
    allow_file_upload: true, allowed_file_types: ["pdf", "doc", "docx", "zip"],
    max_file_size_mb: 25, late_policy: "allow_with_penalty", status: "published",
  });

  useEffect(() => {
    if (initial) {
      setForm({
        title: initial.title ?? "",
        description: initial.description ?? "",
        instructions: initial.instructions ?? "",
        max_points: initial.max_points ?? 100,
        due_at: initial.due_at ? new Date(initial.due_at).toISOString().slice(0, 16) : "",
        allow_file_upload: initial.allow_file_upload ?? true,
        allowed_file_types: Array.isArray(initial.allowed_file_types)
          ? initial.allowed_file_types
          : ["pdf", "doc", "docx", "zip"],
        max_file_size_mb: initial.max_file_size_mb ?? 25,
        late_policy: initial.late_policy ?? "allow_with_penalty",
        status: initial.status ?? "published",
      });
    } else {
      setForm({
        title: "", description: "", instructions: "", max_points: 100, due_at: "",
        allow_file_upload: true, allowed_file_types: ["pdf", "doc", "docx", "zip"],
        max_file_size_mb: 25, late_policy: "allow_with_penalty", status: "published",
      });
    }
  }, [initial, open]);

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = {
        workspace_id: workspaceId,
        course_id: courseId,
        section_id: initial?.section_id ?? sectionId ?? null,
        title: form.title,
        description: form.description || null,
        instructions: form.instructions || null,
        max_points: Number(form.max_points) || 0,
        due_at: form.due_at ? new Date(form.due_at).toISOString() : null,
        allow_file_upload: !!form.allow_file_upload,
        allowed_file_types: form.allowed_file_types,
        max_file_size_mb: Number(form.max_file_size_mb) || 25,
        late_policy: form.late_policy,
        status: form.status,
      };
      if (initial?.id) {
        const { error } = await (supabase.from("assignments") as any).update(payload).eq("id", initial.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from("assignments") as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: initial ? "Assignment updated" : "Assignment created" });
      qc.invalidateQueries({ queryKey: ["builder-curriculum", courseId] });
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleType = (t: string) =>
    setForm((f: any) => ({
      ...f,
      allowed_file_types: f.allowed_file_types.includes(t)
        ? f.allowed_file_types.filter((x: string) => x !== t)
        : [...f.allowed_file_types, t],
    }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{initial ? "Edit assignment" : "New assignment"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Instructions</Label>
            <Textarea rows={4} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Maximum marks</Label>
              <Input type="number" value={form.max_points} onChange={(e) => setForm({ ...form, max_points: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Submission deadline</Label>
              <Input type="datetime-local" value={form.due_at} onChange={(e) => setForm({ ...form, due_at: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Allowed upload types</Label>
            <div className="flex flex-wrap gap-2">
              {ALL_TYPES.map((t) => {
                const on = form.allowed_file_types.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleType(t)}
                    className={`text-xs px-3 py-1 rounded-full border transition-colors ${on ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:bg-muted"}`}
                  >
                    {t.toUpperCase()}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Max file size (MB)</Label>
              <Input type="number" value={form.max_file_size_mb} onChange={(e) => setForm({ ...form, max_file_size_mb: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Late submission policy</Label>
              <Select value={form.late_policy} onValueChange={(v) => setForm({ ...form, late_policy: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_allowed">Not allowed</SelectItem>
                  <SelectItem value="allow_with_penalty">Allow with penalty</SelectItem>
                  <SelectItem value="allow_no_penalty">Allow without penalty</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={form.allow_file_upload} onCheckedChange={(v) => setForm({ ...form, allow_file_upload: v })} />
            Allow file upload
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={!form.title || save.isPending}>
            {save.isPending ? "Saving…" : "Save assignment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
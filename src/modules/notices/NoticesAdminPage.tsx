import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/shared/hooks/useWorkspace";
import { useAuth } from "@/shared/hooks/useAuth";
import { Megaphone, Plus, Pencil, Trash2, Link2 } from "lucide-react";

type Notice = {
  id: string;
  workspace_id: string;
  title: string;
  link_url: string | null;
  link_label: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
};

const EMPTY = { title: "", link_url: "", link_label: "", is_active: true, sort_order: 0 };

export default function NoticesAdminPage() {
  const { membership } = useWorkspace();
  const { user } = useAuth();
  const wsId = membership?.workspace.id;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Notice | null>(null);
  const [form, setForm] = useState(EMPTY);

  const { data: notices = [], isLoading } = useQuery({
    enabled: !!wsId,
    queryKey: ["admin-notices", wsId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("student_notices")
        .select("*")
        .eq("workspace_id", wsId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Notice[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        workspace_id: wsId,
        title: form.title.trim(),
        link_url: form.link_url.trim() || null,
        link_label: form.link_label.trim() || null,
        is_active: form.is_active,
        sort_order: Number(form.sort_order) || 0,
        created_by: user?.id,
      };
      if (!payload.title) throw new Error("Title is required");
      if (editing) {
        const { error } = await (supabase as any).from("student_notices").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("student_notices").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: editing ? "Notice updated" : "Notice created" });
      qc.invalidateQueries({ queryKey: ["admin-notices", wsId] });
      qc.invalidateQueries({ queryKey: ["student-notices", wsId] });
      setOpen(false);
      setEditing(null);
      setForm(EMPTY);
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const toggleActive = useMutation({
    mutationFn: async (n: Notice) => {
      const { error } = await (supabase as any).from("student_notices").update({ is_active: !n.is_active }).eq("id", n.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-notices", wsId] });
      qc.invalidateQueries({ queryKey: ["student-notices", wsId] });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("student_notices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Notice deleted" });
      qc.invalidateQueries({ queryKey: ["admin-notices", wsId] });
      qc.invalidateQueries({ queryKey: ["student-notices", wsId] });
    },
  });

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setOpen(true);
  }

  function openEdit(n: Notice) {
    setEditing(n);
    setForm({
      title: n.title,
      link_url: n.link_url ?? "",
      link_label: n.link_label ?? "",
      is_active: n.is_active,
      sort_order: n.sort_order,
    });
    setOpen(true);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-primary" /> Student Notices
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Scrolling announcements shown in the student dashboard header.
          </p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> New notice</Button>
      </div>

      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : notices.length === 0 ? (
          <div className="p-10 text-center">
            <Megaphone className="h-8 w-8 mx-auto text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">No notices yet. Create the first one.</p>
          </div>
        ) : (
          <ul className="divide-y">
            {notices.map((n) => (
              <li key={n.id} className="flex items-center gap-4 p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{n.title}</p>
                    {n.is_active ? (
                      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Paused</Badge>
                    )}
                  </div>
                  {n.link_url && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                      <Link2 className="h-3 w-3" /> {n.link_label || "Link"} → {n.link_url}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={n.is_active} onCheckedChange={() => toggleActive.mutate(n)} />
                  <Button variant="ghost" size="icon" onClick={() => openEdit(n)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => remove.mutate(n.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit notice" : "New notice"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Message</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Live class for React Hooks starts at 6 PM today" maxLength={250} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Button label</Label>
                <Input value={form.link_label} onChange={(e) => setForm({ ...form, link_label: e.target.value })} placeholder="Join now" />
              </div>
              <div className="space-y-1.5">
                <Label>Link URL</Label>
                <Input value={form.link_url} onChange={(e) => setForm({ ...form, link_url: e.target.value })} placeholder="/app/live-classes or https://…" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Sort order</Label>
                <Input type="number" value={form.sort_order}
                  onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} />
              </div>
              <div className="flex items-end gap-2 pb-2">
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                <span className="text-sm">Active</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Saving…" : editing ? "Save changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
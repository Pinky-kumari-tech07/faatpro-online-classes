import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Megaphone, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/shared/hooks/useWorkspace";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/components/ui/use-toast";
import { mapDbError } from "@/lib/errorMapper";
import PageHeader from "@/modules/shared/PageHeader";
import { CourseSelectItems } from "@/shared/components/CourseSelectItems";
import { useManageableCourses } from "@/shared/hooks/useManageableCourses";

export default function AnnouncementsPage() {
  const { membership, primaryRole } = useWorkspace();
  const wsId = membership!.workspace.id;
  const canManage = ["organization_admin", "staff", "super_admin"].includes(primaryRole ?? "");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleting, setDeleting] = useState<any>(null);
  const qc = useQueryClient();

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("announcements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Announcement deleted" });
      qc.invalidateQueries({ queryKey: ["announcements"] });
      setDeleting(null);
    },
    onError: (e: any) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["announcements", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      // No workspace filter: instructors may own courses in another workspace.
      // RLS already limits rows to what this user is allowed to see.
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = data ?? [];
      const courseIds = Array.from(new Set(rows.filter((r: any) => r.target_type === "course" && r.target_id).map((r: any) => r.target_id)));
      if (courseIds.length === 0) return rows.map((r: any) => ({ ...r, course: null }));
      const { data: courses } = await supabase.from("courses").select("id, title").is("deleted_at", null).in("id", courseIds);
      const cMap = new Map((courses ?? []).map((c: any) => [c.id, c]));
      return rows.map((r: any) => ({ ...r, course: cMap.get(r.target_id) ?? null }));
    },
  });

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader title="Announcements" description="Broadcast updates to your workspace."
        actions={canManage && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> New announcement</Button>} />

      <div className="space-y-3">
        {isLoading && (
          <Card className="p-8 text-center text-muted-foreground border-border shadow-none">Loading announcements…</Card>
        )}
        {error && !isLoading && (
          <Card className="p-8 text-center text-destructive border-border shadow-none">Failed to load announcements: {(error as any).message}</Card>
        )}
        {(data ?? []).map((a: any) => (
          <Card key={a.id} className="p-5 border-border shadow-none">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold">{a.title}</h3>
                  <Badge variant="secondary">{a.status}</Badge>
                  <Badge variant="outline" className="capitalize">{a.target_type}{a.target_role ? `: ${a.target_role}` : ""}</Badge>
                  {a.course?.title && <Badge variant="outline">{a.course.title}</Badge>}
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{a.body}</p>
                <div className="text-xs text-muted-foreground mt-2">{a.created_at ? new Date(a.created_at).toLocaleString() : "Recently"}</div>
              </div>
              {canManage && (
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => setEditing(a)} title="Edit">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setDeleting(a)} title="Delete">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              )}
            </div>
          </Card>
        ))}
        {!isLoading && !error && (data ?? []).length === 0 && (
          <Card className="p-12 text-center text-muted-foreground border-border shadow-none">
            <Megaphone className="h-8 w-8 mx-auto mb-2 opacity-50" /> No announcements yet.
          </Card>
        )}
      </div>

      {open && <AnnouncementDialog onClose={() => setOpen(false)} workspaceId={wsId} />}
      {editing && <AnnouncementDialog onClose={() => setEditing(null)} workspaceId={wsId} existing={editing} />}
      <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete announcement?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleting?.title}" will be permanently removed. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleting && del.mutate(deleting.id)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AnnouncementDialog({ onClose, workspaceId, existing }: any) {
  const qc = useQueryClient();
  const [form, setForm] = useState<any>(
    existing
      ? {
          title: existing.title ?? "",
          body: existing.body ?? "",
          target_type: existing.target_type ?? "workspace",
          target_role: existing.target_role ?? "",
          target_id: existing.target_id ?? "",
          status: existing.status ?? "published",
        }
      : { title: "", body: "", target_type: "workspace", target_role: "", target_id: "", status: "published" },
  );
  const { courses, isLoading: coursesLoading, error: coursesError } = useManageableCourses();

  const save = useMutation({
    mutationFn: async () => {
      if (!form.title?.trim()) throw new Error("Title is required");
      if (form.target_type === "course" && !form.target_id) throw new Error("Select a course");
      if (form.target_type === "role" && !form.target_role) throw new Error("Select a role");
      const { data: u } = await supabase.auth.getUser();
      const selected = courses.find((c: any) => c.id === form.target_id);
      const targetWs = selected?.workspace_id ?? workspaceId;
      const payload: any = {
        workspace_id: targetWs,
        title: form.title.trim(),
        body: form.body?.trim() || null,
        created_by: u.user?.id ?? null,
        target_type: form.target_type,
        target_id: form.target_type === "course" ? form.target_id : null,
        target_role: form.target_type === "role" ? form.target_role : null,
        status: form.status,
        publish_at: form.status === "published" ? new Date().toISOString() : null,
      };
      if (existing) {
        const { error } = await supabase.from("announcements").update(payload).eq("id", existing.id);
        if (error) throw new Error(mapDbError(error));
      } else {
        const { error } = await supabase.from("announcements").insert(payload);
        if (error) throw new Error(mapDbError(error));
      }
    },
    onSuccess: async () => {
      toast({ title: existing ? "Announcement updated" : "Announcement saved" });
      await qc.invalidateQueries({ queryKey: ["announcements"] });
      await qc.refetchQueries({ queryKey: ["announcements"] });
      onClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{existing ? "Edit announcement" : "New announcement"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Body</Label><Textarea rows={5} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Audience</Label>
              <Select value={form.target_type} onValueChange={(v) => setForm({ ...form, target_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="workspace">Entire workspace</SelectItem>
                  <SelectItem value="course">Specific course</SelectItem>
                  <SelectItem value="role">Specific role</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Publish now</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.target_type === "course" && (
              <div className="col-span-2 space-y-1.5"><Label>Course</Label>
                <Select value={form.target_id} onValueChange={(v) => setForm({ ...form, target_id: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><CourseSelectItems courses={courses} isLoading={coursesLoading} error={coursesError} /></SelectContent>
                </Select>
              </div>
            )}
            {form.target_type === "role" && (
              <div className="col-span-2 space-y-1.5"><Label>Role</Label>
                <Select value={form.target_role} onValueChange={(v) => setForm({ ...form, target_role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student">Students</SelectItem>
                    <SelectItem value="instructor">Instructors</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={!form.title}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
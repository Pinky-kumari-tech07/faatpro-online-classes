import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, ChevronRight, Save, CheckCheck, XCircle, Eraser, SendHorizonal, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/shared/hooks/useAuth";
import { useWorkspace } from "@/shared/hooks/useWorkspace";
import PageHeader from "@/modules/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "@/components/ui/use-toast";
import {
  listWorkspaceBatches, listBatchCourses, listBatchLessons, listBatchRoster,
  loadOrCreateSettings, isLockedClient, ATT_TYPE_LABELS, STATUS_STYLE,
  type AttStatus, type AttType, fmtDateTime,
} from "./attendanceService";

export default function AttendanceMarkPage() {
  const { membership } = useWorkspace();
  const wsId = membership!.workspace.id;
  const [showNew, setShowNew] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const { data: sessions, refetch } = useQuery({
    queryKey: ["att-open-sessions", wsId],
    queryFn: async () => (await supabase.from("attendance_sessions")
      .select("id,title,session_date,status,submitted_at,attendance_type,course_id,batch_id,batches:batch_id(name),courses:course_id(title)")
      .eq("workspace_id", wsId).in("status", ["draft","submitted"])
      .order("session_date", { ascending: false })).data ?? [],
  });
  const { data: settings } = useQuery({
    queryKey: ["att-settings", wsId],
    queryFn: () => loadOrCreateSettings(wsId),
  });

  const lockHours = settings?.attendance_lock_hours ?? 24;
  const open = (sessions ?? []).filter((s: any) => !isLockedClient(s, lockHours));

  return (
    <div className="space-y-6">
      <PageHeader title="Mark attendance"
        description="Create a session tied to a batch and course, then mark the roster."
        actions={<Button onClick={() => setShowNew(true)}><Plus className="h-4 w-4 mr-1.5" />New session</Button>} />

      <Card className="border-border shadow-none">
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold">Open sessions</h3>
          <p className="text-xs text-muted-foreground">Drafts and sessions still within the {lockHours}h edit window.</p>
        </div>
        <div className="divide-y divide-border">
          {open.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">No open sessions. Create one to start marking.</div>}
          {open.map((s: any) => (
            <button key={s.id} onClick={() => setActiveId(s.id)}
              className="w-full text-left p-4 flex items-center gap-4 hover:bg-muted/40 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{s.title}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {s.batches?.name ?? "—"} · {s.courses?.title ?? "—"} · {fmtDateTime(s.session_date)}
                </div>
              </div>
              <Badge variant="outline" className="text-[10px] uppercase">{ATT_TYPE_LABELS[s.attendance_type as AttType] ?? s.attendance_type}</Badge>
              <Badge className={s.status === "submitted" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}>{s.status}</Badge>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          ))}
        </div>
      </Card>

      {showNew && <NewSessionDialog wsId={wsId} onClose={() => setShowNew(false)} onCreated={(id) => { setShowNew(false); refetch(); setActiveId(id); }} />}
      {activeId && <RollCallSheet sessionId={activeId} lockHours={lockHours} onClose={() => { setActiveId(null); refetch(); }} />}
    </div>
  );
}

function NewSessionDialog({ wsId, onClose, onCreated }: { wsId: string; onClose: () => void; onCreated: (id: string) => void }) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    batch_id: "", course_id: "", lesson_id: "",
    title: "", attendance_type: "offline_classroom" as AttType,
    session_date: new Date().toISOString().slice(0, 10),
    start_time: "10:00", end_time: "11:00", notes: "",
  });

  const { data: batches } = useQuery({ queryKey: ["att-batches", wsId], queryFn: () => listWorkspaceBatches(wsId) });
  const { data: courses } = useQuery({
    queryKey: ["att-batch-courses", form.batch_id],
    queryFn: () => listBatchCourses(form.batch_id),
    enabled: !!form.batch_id,
  });
  const { data: lessons } = useQuery({
    queryKey: ["att-course-lessons", form.course_id],
    queryFn: () => listBatchLessons(form.course_id),
    enabled: !!form.course_id,
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.batch_id || !form.course_id) throw new Error("Batch and course are required");
      const dt = new Date(`${form.session_date}T${form.start_time || "00:00"}:00`);
      const { data, error } = await supabase.from("attendance_sessions").insert({
        workspace_id: wsId,
        batch_id: form.batch_id,
        course_id: form.course_id,
        lesson_id: form.lesson_id || null,
        instructor_id: user?.id ?? null,
        title: form.title || `Attendance · ${new Date(form.session_date).toLocaleDateString("en-IN")}`,
        attendance_type: form.attendance_type,
        session_date: dt.toISOString(),
        start_time: form.start_time || null,
        end_time: form.end_time || null,
        notes: form.notes || null,
        status: "draft",
        created_by: user?.id ?? null,
      }).select("id").single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => { toast({ title: "Session created" }); onCreated(id); },
    onError: (e: any) => toast({ title: "Could not create session", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>New attendance session</DialogTitle></DialogHeader>
        <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <Label>Batch <span className="text-rose-500">*</span></Label>
            <Select value={form.batch_id} onValueChange={(v) => setForm({ ...form, batch_id: v, course_id: "", lesson_id: "" })}>
              <SelectTrigger><SelectValue placeholder="Select batch" /></SelectTrigger>
              <SelectContent>
                {(batches ?? []).map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}{b.code ? ` (${b.code})` : ""}</SelectItem>)}
                {(!batches || batches.length === 0) && <div className="p-3 text-xs text-muted-foreground">No batches. Create one in Batches first.</div>}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Course <span className="text-rose-500">*</span></Label>
            <Select value={form.course_id} onValueChange={(v) => setForm({ ...form, course_id: v, lesson_id: "" })} disabled={!form.batch_id}>
              <SelectTrigger><SelectValue placeholder={form.batch_id ? "Select course" : "Choose batch first"} /></SelectTrigger>
              <SelectContent>
                {(courses ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                {form.batch_id && (!courses || courses.length === 0) && <div className="p-3 text-xs text-muted-foreground">No courses assigned to this batch.</div>}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Lesson (optional)</Label>
            <Select value={form.lesson_id || "none"} onValueChange={(v) => setForm({ ...form, lesson_id: v === "none" ? "" : v })} disabled={!form.course_id}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {(lessons ?? []).map((l: any) => <SelectItem key={l.id} value={l.id}>{l.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Attendance type</Label>
              <Select value={form.attendance_type} onValueChange={(v) => setForm({ ...form, attendance_type: v as AttType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ATT_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={form.session_date} onChange={(e) => setForm({ ...form, session_date: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Start time</Label>
              <Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
            </div>
            <div className="space-y-1.5"><Label>End time</Label>
              <Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Title (optional)</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Week 3 — Lab session" />
          </div>
          <div className="space-y-1.5">
            <Label>Remarks (optional)</Label>
            <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => create.mutate()} disabled={!form.batch_id || !form.course_id || create.isPending}>
            {create.isPending ? "Creating…" : "Create & open sheet"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RollCallSheet({ sessionId, lockHours, onClose }: { sessionId: string; lockHours: number; onClose: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: session } = useQuery({
    queryKey: ["att-session", sessionId],
    queryFn: async () => (await supabase.from("attendance_sessions")
      .select("*, batches:batch_id(id,name), courses:course_id(id,title)")
      .eq("id", sessionId).single()).data,
  });

  const { data: roster } = useQuery({
    queryKey: ["att-roster", session?.batch_id],
    enabled: !!session?.batch_id,
    queryFn: () => listBatchRoster(session!.batch_id),
  });

  const { data: records, refetch: refetchRecords } = useQuery({
    queryKey: ["att-records", sessionId],
    queryFn: async () => (await supabase.from("attendance_records")
      .select("student_id,status,notes").eq("session_id", sessionId)).data ?? [],
  });

  const [draft, setDraft] = useState<Record<string, { status: AttStatus; notes: string }>>({});

  const merged = useMemo(() => {
    const byStudent: Record<string, { status: AttStatus | null; notes: string }> = {};
    (records ?? []).forEach((r: any) => { byStudent[r.student_id] = { status: r.status, notes: r.notes ?? "" }; });
    (roster ?? []).forEach((r: any) => {
      const d = draft[r.student_id];
      byStudent[r.student_id] = {
        status: d?.status ?? byStudent[r.student_id]?.status ?? null,
        notes: d?.notes ?? byStudent[r.student_id]?.notes ?? "",
      };
    });
    return byStudent;
  }, [roster, records, draft]);

  const setAll = (status: AttStatus | null) => {
    const next: typeof draft = {};
    (roster ?? []).forEach((r: any) => { next[r.student_id] = { status: status as AttStatus, notes: draft[r.student_id]?.notes ?? "" }; });
    setDraft(next);
  };
  const setOne = (id: string, patch: Partial<{ status: AttStatus; notes: string }>) => {
    setDraft((d) => ({ ...d, [id]: { status: (patch.status ?? d[id]?.status ?? merged[id]?.status ?? "present") as AttStatus, notes: patch.notes ?? d[id]?.notes ?? merged[id]?.notes ?? "" } }));
  };

  const locked = session ? isLockedClient(session as any, lockHours) : false;

  const persist = async (submit: boolean) => {
    if (!session) return;
    const rows = (roster ?? [])
      .map((r: any) => {
        const cur = merged[r.student_id];
        if (!cur?.status) return null;
        return {
          workspace_id: session.workspace_id, session_id: sessionId,
          student_id: r.student_id, status: cur.status, notes: cur.notes || null,
          marked_by: user?.id ?? null,
        };
      })
      .filter(Boolean);
    if (rows.length) {
      const { error } = await supabase.from("attendance_records")
        .upsert(rows as any, { onConflict: "session_id,student_id" });
      if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    }
    if (submit) {
      const { error } = await supabase.from("attendance_sessions")
        .update({ status: "submitted", submitted_at: new Date().toISOString(), submitted_by: user?.id ?? null })
        .eq("id", sessionId);
      if (error) { toast({ title: "Submit failed", description: error.message, variant: "destructive" }); return; }
    }
    toast({ title: submit ? "Attendance submitted" : "Draft saved" });
    setDraft({});
    refetchRecords();
    qc.invalidateQueries({ queryKey: ["att-open-sessions"] });
    qc.invalidateQueries({ queryKey: ["att-dashboard"] });
    qc.invalidateQueries({ queryKey: ["att-history"] });
  };

  return (
    <Sheet open onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="sm:max-w-3xl w-full overflow-y-auto p-0">
        <SheetHeader className="p-5 border-b border-border sticky top-0 bg-background z-10">
          <SheetTitle className="flex items-center gap-2">
            {session?.title ?? "Session"}
            {locked && <Badge variant="outline" className="bg-muted text-muted-foreground"><Lock className="h-3 w-3 mr-1" />Locked</Badge>}
          </SheetTitle>
          <p className="text-xs text-muted-foreground">
            {session?.batches?.name} · {session?.courses?.title} · {fmtDateTime(session?.session_date)}
          </p>
        </SheetHeader>

        <div className="p-5 flex flex-wrap gap-2 border-b border-border">
          <Button size="sm" variant="outline" onClick={() => setAll("present")} disabled={locked}><CheckCheck className="h-4 w-4 mr-1"/>Mark all present</Button>
          <Button size="sm" variant="outline" onClick={() => setAll("absent")} disabled={locked}><XCircle className="h-4 w-4 mr-1"/>Mark all absent</Button>
          <Button size="sm" variant="ghost" onClick={() => setAll(null)} disabled={locked}><Eraser className="h-4 w-4 mr-1"/>Clear</Button>
        </div>

        <div className="p-5 space-y-2">
          {(roster ?? []).length === 0 && <div className="p-10 text-sm text-center text-muted-foreground">No students assigned to this batch.</div>}
          {(roster ?? []).map((r: any) => {
            const cur = merged[r.student_id]?.status;
            return (
              <div key={r.student_id} className="border border-border rounded-lg p-3">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate">{r.name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">Roll: {r.roll_number}{r.email ? ` · ${r.email}` : ""}</div>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {(["present","absent","late","excused"] as AttStatus[]).map((s) => (
                      <Button key={s} size="sm" disabled={locked}
                        variant={cur === s ? "default" : "outline"}
                        className={cur === s ? "" : "text-xs"}
                        onClick={() => setOne(r.student_id, { status: s })}>
                        <span className={`h-1.5 w-1.5 rounded-full mr-1.5 ${STATUS_STYLE[s].dot}`} />
                        {STATUS_STYLE[s].label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="sticky bottom-0 bg-background border-t border-border p-4 flex flex-wrap gap-2 justify-end">
          <Button variant="outline" onClick={() => persist(false)} disabled={locked}><Save className="h-4 w-4 mr-1"/>Save draft</Button>
          <Button onClick={() => persist(true)} disabled={locked}><SendHorizonal className="h-4 w-4 mr-1"/>Submit attendance</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
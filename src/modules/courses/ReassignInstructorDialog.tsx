import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { courseLifecycleService } from "@/services/supabase/courseLifecycleService";
import { toast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ArrowRight } from "lucide-react";

export default function ReassignInstructorDialog({
  open, onOpenChange, course,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  course: { id: string; title: string; instructor_id: string | null; instructor?: { full_name?: string | null; email?: string | null } | null } | null;
}) {
  const qc = useQueryClient();
  const [newId, setNewId] = useState("");
  const [reason, setReason] = useState("");
  const [effective, setEffective] = useState<string>(() => new Date().toISOString().slice(0, 16));
  const [notify, setNotify] = useState(true);
  const [transferLive, setTransferLive] = useState(true);

  const { data: instructors = [] } = useQuery({
    queryKey: ["active-instructors"],
    queryFn: () => courseLifecycleService.listActiveInstructors(),
    enabled: open,
  });

  const options = useMemo(
    () => instructors.filter((i: any) => i.id !== course?.instructor_id),
    [instructors, course?.instructor_id],
  );

  const isAssign = !course?.instructor_id;
  const actionLabel = isAssign ? "Assign" : "Transfer";

  const save = useMutation({
    mutationFn: () => courseLifecycleService.reassignInstructor({
      courseId: course!.id,
      newInstructorId: newId,
      reason: reason || undefined,
      effectiveDate: effective ? new Date(effective).toISOString() : null,
      notify,
      transferLiveClasses: transferLive,
    }),
    onSuccess: () => {
      toast({ title: isAssign
        ? "Instructor assigned. Course, videos, and student access are unchanged."
        : "Instructor reassigned. Course, videos, and student access are unchanged." });
      qc.invalidateQueries({ queryKey: ["courses"] });
      onOpenChange(false); setNewId(""); setReason("");
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{actionLabel} instructor</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="rounded-md border border-border p-3 text-sm">
            <div className="text-xs text-muted-foreground uppercase mb-1">Course</div>
            <div className="font-medium">{course?.title}</div>
          </div>
          {isAssign ? (
            <div className="rounded-md border border-border p-2 text-sm">
              <div className="text-[10px] uppercase text-muted-foreground">New instructor</div>
              <div className="font-medium truncate">
                {options.find((i: any) => i.id === newId)?.full_name
                  ?? options.find((i: any) => i.id === newId)?.email
                  ?? "—"}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm">
              <div className="flex-1 rounded-md border border-border p-2">
                <div className="text-[10px] uppercase text-muted-foreground">Current instructor</div>
                <div className="font-medium truncate">{course?.instructor?.full_name || course?.instructor?.email || "—"}</div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 rounded-md border border-border p-2">
                <div className="text-[10px] uppercase text-muted-foreground">New instructor</div>
                <div className="font-medium truncate">
                  {options.find((i: any) => i.id === newId)?.full_name
                    ?? options.find((i: any) => i.id === newId)?.email
                    ?? "—"}
                </div>
              </div>
            </div>
          )}
          <div>
            <Label>New instructor</Label>
            <Select value={newId} onValueChange={setNewId}>
              <SelectTrigger><SelectValue placeholder="Select an active instructor" /></SelectTrigger>
              <SelectContent>
                {options.map((i: any) => (
                  <SelectItem key={i.id} value={i.id}>{i.full_name || i.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Reason</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Reason for the transfer (recorded in audit log)…" />
          </div>
          <div>
            <Label>Effective date</Label>
            <Input type="datetime-local" value={effective} onChange={(e) => setEffective(e.target.value)} />
          </div>
          <div className="flex items-center justify-between rounded-md border border-border p-2">
            <div className="text-sm">
              <div className="font-medium">Notify instructors</div>
              <div className="text-xs text-muted-foreground">Send an in-app notification to both instructors.</div>
            </div>
            <Switch checked={notify} onCheckedChange={setNotify} />
          </div>
          <div className="flex items-center justify-between rounded-md border border-border p-2">
            <div className="text-sm">
              <div className="font-medium">Transfer future live classes</div>
              <div className="text-xs text-muted-foreground">Scheduled classes after the effective date move to the new instructor. Completed classes stay unchanged.</div>
            </div>
            <Switch checked={transferLive} onCheckedChange={setTransferLive} />
          </div>
          <p className="text-xs text-muted-foreground">Course content, videos, enrollments, certificates, and revenue-share records are workspace-owned and remain intact.</p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={!newId || save.isPending}>{actionLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
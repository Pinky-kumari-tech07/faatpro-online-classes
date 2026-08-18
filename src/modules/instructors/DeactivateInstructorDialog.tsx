import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/components/ui/use-toast";
import { courseLifecycleService } from "@/services/supabase/courseLifecycleService";
import { Loader2, AlertTriangle, Mail, Phone, BookOpen, Wallet, Users, GraduationCap, Video } from "lucide-react";

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border p-2">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">{icon}{label}</div>
      <div className="text-sm font-semibold mt-0.5">{value}</div>
    </div>
  );
}

export default function DeactivateInstructorDialog({
  open, onOpenChange, instructor,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  instructor: { id: string; full_name?: string | null; email?: string | null } | null;
}) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<"deactivate" | "transfer" | "archive">("deactivate");
  const [replacement, setReplacement] = useState("");
  const [reason, setReason] = useState("");
  const [force, setForce] = useState(false);

  useEffect(() => { if (!open) { setMode("deactivate"); setReplacement(""); setReason(""); setForce(false); } }, [open]);

  const { data: summary, isLoading: sumLoading } = useQuery({
    queryKey: ["instructor-deactivation-summary", instructor?.id],
    queryFn: () => courseLifecycleService.deactivationSummary(instructor!.id),
    enabled: open && !!instructor?.id,
  });

  const { data: instructors = [] } = useQuery({
    queryKey: ["active-instructors"],
    queryFn: () => courseLifecycleService.listActiveInstructors(),
    enabled: open && mode === "transfer",
  });

  const run = useMutation({
    mutationFn: () => courseLifecycleService.deactivateInstructor({
      instructorId: instructor!.id,
      mode,
      newInstructorId: mode === "transfer" ? replacement : undefined,
      reason: reason || undefined,
      force,
    }),
    onSuccess: (r: any) => {
      toast({
        title: "Instructor deactivated",
        description: mode === "transfer"
          ? `${r?.transferred ?? 0} course(s) transferred.`
          : mode === "archive"
            ? `${r?.archived ?? 0} course(s) archived. Enrolled students keep access.`
            : "Assignments unchanged. Login is blocked.",
      });
      qc.invalidateQueries();
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const blockers: string[] = summary?.blockers ?? [];
  const hasBlockers = blockers.length > 0;
  const fmtInr = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Deactivate instructor</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-md border border-border p-3 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold">{summary?.instructor?.name || instructor?.full_name || instructor?.email}</div>
                <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-3 mt-0.5">
                  <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{summary?.instructor?.email || instructor?.email || "—"}</span>
                  <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{summary?.instructor?.mobile || "—"}</span>
                </div>
              </div>
              {sumLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              <StatCard icon={<BookOpen className="h-3 w-3" />} label="Total courses" value={summary?.courses?.total ?? "—"} />
              <StatCard icon={<GraduationCap className="h-3 w-3" />} label="Published" value={summary?.courses?.published ?? "—"} />
              <StatCard icon={<BookOpen className="h-3 w-3" />} label="Draft" value={summary?.courses?.draft ?? "—"} />
              <StatCard icon={<Users className="h-3 w-3" />} label="Active students" value={summary?.students ?? "—"} />
              <StatCard icon={<Wallet className="h-3 w-3" />} label="Pending earnings" value={fmtInr(summary?.earnings?.pending ?? 0)} />
              <StatCard icon={<Wallet className="h-3 w-3" />} label="Approved earnings" value={fmtInr(summary?.earnings?.approved ?? 0)} />
              <StatCard icon={<Wallet className="h-3 w-3" />} label="Pending payouts" value={summary?.pending_payout_requests ?? "—"} />
              <StatCard icon={<Video className="h-3 w-3" />} label="Live in 24h" value={summary?.upcoming_live_classes_24h ?? "—"} />
            </div>
          </div>

          {hasBlockers && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
              <div className="flex items-center gap-2 font-medium text-destructive"><AlertTriangle className="h-4 w-4" /> Cannot deactivate</div>
              <ul className="mt-1 list-disc pl-6 text-xs text-destructive">
                {blockers.map((b, i) => <li key={i}>{b}</li>)}
              </ul>
              <label className="mt-2 flex items-center gap-2 text-xs cursor-pointer">
                <Checkbox checked={force} onCheckedChange={(v) => setForce(!!v)} />
                Override and deactivate anyway (recorded in the audit log)
              </label>
            </div>
          )}

          <RadioGroup value={mode} onValueChange={(v) => setMode(v as any)} className="space-y-2">
            <label className="flex items-start gap-3 rounded-md border border-border p-3 cursor-pointer">
              <RadioGroupItem value="deactivate" className="mt-1" />
              <div className="text-sm">
                <div className="font-medium">Deactivate only</div>
                <div className="text-xs text-muted-foreground">Blocks login. Course assignments stay the same.</div>
              </div>
            </label>
            <label className="flex items-start gap-3 rounded-md border border-border p-3 cursor-pointer">
              <RadioGroupItem value="transfer" className="mt-1" />
              <div className="text-sm w-full">
                <div className="font-medium">Deactivate and transfer courses</div>
                <div className="text-xs text-muted-foreground">All owned courses move to the replacement instructor immediately.</div>
                {mode === "transfer" && (
                  <div className="mt-2">
                    <Label className="text-xs">Replacement instructor</Label>
                    <Select value={replacement} onValueChange={setReplacement}>
                      <SelectTrigger><SelectValue placeholder="Choose replacement" /></SelectTrigger>
                      <SelectContent>
                        {(instructors as any[]).filter((i) => i.id !== instructor?.id).map((i: any) => (
                          <SelectItem key={i.id} value={i.id}>{i.full_name || i.email}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </label>
            <label className="flex items-start gap-3 rounded-md border border-border p-3 cursor-pointer">
              <RadioGroupItem value="archive" className="mt-1" />
              <div className="text-sm">
                <div className="font-medium">Deactivate and archive courses</div>
                <div className="text-xs text-muted-foreground">Every published course is archived. Existing students keep access. No new enrollments.</div>
              </div>
            </label>
          </RadioGroup>

          <div>
            <Label>Reason</Label>
            <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Recorded in the audit log…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="destructive"
            disabled={run.isPending || (mode === "transfer" && !replacement) || (hasBlockers && !force)}
            onClick={() => run.mutate()}
          >
            {run.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}Deactivate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
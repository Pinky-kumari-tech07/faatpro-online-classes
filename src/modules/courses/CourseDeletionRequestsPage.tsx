import { useState } from "react";
import { useQueries, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle, Archive, Trash2, X, Check, ShieldAlert } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import PageHeader from "@/modules/shared/PageHeader";
import { courseLifecycleService } from "@/services/supabase/courseLifecycleService";
import { useWorkspace } from "@/shared/hooks/useWorkspace";
import { Input } from "@/components/ui/input";

export default function CourseDeletionRequestsPage() {
  const { primaryRole } = useWorkspace();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isStaff = ["organization_admin", "super_admin"].includes(primaryRole ?? "");
  const [status, setStatus] = useState<"pending" | "approved" | "rejected" | "archived" | "deleted" | "all">("pending");
  const [reviewing, setReviewing] = useState<any>(null);
  const [notes, setNotes] = useState("");
  const [deleting, setDeleting] = useState<any>(null);
  const [confirmText, setConfirmText] = useState("");
  const [deleteRemarks, setDeleteRemarks] = useState("");

  const { data = [], isLoading } = useQuery({
    queryKey: ["course-deletion-requests", status],
    queryFn: () => courseLifecycleService.listRequests(status),
  });

  const review = useMutation({
    mutationFn: async ({ approve }: { approve: boolean }) => {
      await courseLifecycleService.review(reviewing.id, approve, notes);
    },
    onSuccess: (_, vars) => {
      toast({ title: vars.approve ? "Request approved" : "Request rejected" });
      qc.invalidateQueries({ queryKey: ["course-deletion-requests"] });
      setReviewing(null); setNotes("");
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const archive = useMutation({
    mutationFn: (r: any) => courseLifecycleService.archive(r.course_id, r.id),
    onSuccess: () => {
      toast({ title: "Course archived. Students still have access." });
      qc.invalidateQueries({ queryKey: ["course-deletion-requests"] });
      qc.invalidateQueries({ queryKey: ["courses"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const hardDelete = useMutation({
    mutationFn: (r: any) => courseLifecycleService.permanentDelete(r.course_id, r.id, deleteRemarks),
    onSuccess: (result: any) => {
      if (result?.archived) {
        toast({
          title: "Course archived instead",
          description: result.message ?? "Historical records exist; the course has been kept archived.",
        });
      } else {
        toast({ title: "Course permanently deleted" });
      }
      qc.invalidateQueries({ queryKey: ["course-deletion-requests"] });
      qc.invalidateQueries({ queryKey: ["courses"] });
      setDeleting(null); setConfirmText(""); setDeleteRemarks("");
    },
    onError: (e: any) => toast({
      title: "Cannot delete",
      description: e.message,
      variant: "destructive",
    }),
  });

  // Fetch stats for visible course rows in parallel
  const summaries = useQueries({
    queries: data.map((r) => ({
      queryKey: ["course-deletion-summary", r.course_id],
      queryFn: () => courseLifecycleService.getSummary(r.course_id),
      enabled: !!r.course_id,
      staleTime: 30_000,
    })),
  });
  const summaryByCourse: Record<string, any> = {};
  data.forEach((r, i) => { summaryByCourse[r.course_id] = summaries[i]?.data; });

  if (!isStaff) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Only admins can review deletion requests.
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl">
      <PageHeader
        title="Course deletion requests"
        description="Instructors request removal. Admins approve, archive, then permanently delete."
      />

      <Card className="p-4 border-border shadow-none">
        <div className="flex items-center gap-3">
          <Select value={status} onValueChange={(v) => setStatus(v as any)}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="deleted">Deleted</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="border-border shadow-none">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Course</TableHead>
              <TableHead>Instructor</TableHead>
              <TableHead className="text-right">Students</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
              <TableHead className="text-right">Certs</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Requested</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={9} className="text-center py-10 text-muted-foreground">Loading…</TableCell></TableRow>
            )}
            {!isLoading && data.length === 0 && (
              <TableRow><TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-40" />
                No {status === "all" ? "" : status} deletion requests.
              </TableCell></TableRow>
            )}
            {data.map((r) => {
              const s = summaryByCourse[r.course_id];
              return (
              <TableRow key={r.id}>
                <TableCell>
                  <button className="font-medium hover:underline text-left" onClick={() => navigate(`/app/courses/${r.course_id}`)}>
                    {r.course?.title ?? "Course removed"}
                  </button>
                  <div className="text-xs text-muted-foreground">Current status: {r.course?.status ?? "—"}</div>
                </TableCell>
                <TableCell className="text-sm">
                  <div>{r.requester?.full_name ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">{r.requester?.email}</div>
                </TableCell>
                <TableCell className="text-right text-sm">{s?.enrollments ?? "—"}</TableCell>
                <TableCell className="text-right text-sm">
                  {s?.revenue != null ? `₹${Number(s.revenue).toLocaleString("en-IN")}` : "—"}
                </TableCell>
                <TableCell className="text-right text-sm">{s?.certificates ?? "—"}</TableCell>
                <TableCell className="text-sm max-w-xs truncate" title={r.reason ?? ""}>{r.reason ?? "—"}</TableCell>
                <TableCell><Badge variant="secondary">{r.status}</Badge></TableCell>
                <TableCell className="text-sm">{new Date(r.created_at).toLocaleDateString()}</TableCell>
                <TableCell className="text-right space-x-1">
                  {r.status === "pending" && (
                    <Button size="sm" variant="outline" onClick={() => { setReviewing(r); setNotes(""); }}>
                      Review
                    </Button>
                  )}
                  {r.status === "approved" && r.course?.status !== "archived" && (
                    <Button size="sm" variant="outline" onClick={() => archive.mutate(r)}>
                      <Archive className="h-3.5 w-3.5 mr-1" /> Archive
                    </Button>
                  )}
                  {(r.status === "approved" || r.status === "archived") && r.course?.status === "archived" && (
                    <Button
                      size="sm"
                      variant={s?.can_hard_delete ? "destructive" : "outline"}
                      onClick={() => { setDeleting({ ...r, _summary: s }); setConfirmText(""); setDeleteRemarks(""); }}
                      title={s?.can_hard_delete ? "" : "Has historical records — will remain archived"}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      {s?.can_hard_delete ? "Delete permanently" : "Attempt delete"}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!reviewing} onOpenChange={(o) => !o && setReviewing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review deletion request</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm">
              <div><strong>Course:</strong> {reviewing?.course?.title}</div>
              <div><strong>Requested by:</strong> {reviewing?.requester?.full_name}</div>
              <div className="mt-2 p-3 rounded bg-muted text-sm">{reviewing?.reason || "No reason provided."}</div>
            </div>
            <div>
              <label className="text-sm font-medium">Review notes (optional)</label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Justification for this decision…" />
            </div>
            <p className="text-xs text-muted-foreground">Approving does not delete. After approval, choose Archive (students keep access) or Delete permanently (only when archived with no active enrollments).</p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => review.mutate({ approve: false })} disabled={review.isPending}>
              <X className="h-4 w-4 mr-1" /> Reject
            </Button>
            <Button onClick={() => review.mutate({ approve: true })} disabled={review.isPending}>
              <Check className="h-4 w-4 mr-1" /> Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Two-step permanent delete confirmation */}
      <Dialog open={!!deleting} onOpenChange={(o) => { if (!o) { setDeleting(null); setConfirmText(""); setDeleteRemarks(""); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" /> Permanently delete course
            </DialogTitle>
          </DialogHeader>
          {deleting && (
            <div className="space-y-4">
              <div className="rounded-md border border-border p-3 text-sm">
                <div className="font-medium">{deleting.course?.title}</div>
                <div className="text-xs text-muted-foreground">Course ID: {deleting.course_id}</div>
              </div>
              <div className="rounded-md border border-border p-3">
                <div className="text-xs font-medium text-muted-foreground uppercase mb-2">Dependencies</div>
                <div className="grid grid-cols-2 gap-y-1 text-sm">
                  <div>Students enrolled</div><div className="text-right font-medium">{deleting._summary?.enrollments ?? 0}</div>
                  <div>Certificates issued</div><div className="text-right font-medium">{deleting._summary?.certificates ?? 0}</div>
                  <div>Payments</div><div className="text-right font-medium">{deleting._summary?.payments ?? 0}</div>
                  <div>Invoices</div><div className="text-right font-medium">{deleting._summary?.invoices ?? 0}</div>
                  <div>Revenue</div><div className="text-right font-medium">₹{Number(deleting._summary?.revenue ?? 0).toLocaleString("en-IN")}</div>
                  <div>Live classes</div><div className="text-right font-medium">{deleting._summary?.live_classes ?? 0}</div>
                  <div>Quizzes</div><div className="text-right font-medium">{deleting._summary?.quizzes ?? 0}</div>
                  <div>Lessons</div><div className="text-right font-medium">{deleting._summary?.lessons ?? 0}</div>
                  <div>Videos</div><div className="text-right font-medium">{deleting._summary?.videos ?? 0}</div>
                  <div>Assets</div><div className="text-right font-medium">{deleting._summary?.assets ?? 0}</div>
                </div>
                <div className="mt-3 pt-3 border-t text-sm font-medium">
                  {deleting._summary?.can_hard_delete
                    ? <span className="text-green-600">✓ Safe to delete — no historical records.</span>
                    : <span className="text-amber-600">✗ Cannot delete — course will be archived instead.</span>}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Admin remarks</label>
                <Textarea value={deleteRemarks} onChange={(e) => setDeleteRemarks(e.target.value)} rows={2} placeholder="Reason for deletion (recorded in audit log)…" />
              </div>
              {deleting._summary?.can_hard_delete && (
                <div>
                  <label className="text-sm font-medium">Type <code className="px-1 rounded bg-muted">DELETE</code> to confirm</label>
                  <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="DELETE" />
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setDeleting(null); setConfirmText(""); setDeleteRemarks(""); }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={
                hardDelete.isPending
                || (deleting?._summary?.can_hard_delete && confirmText !== "DELETE")
              }
              onClick={() => hardDelete.mutate(deleting)}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              {deleting?._summary?.can_hard_delete ? "Permanently delete" : "Archive instead"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
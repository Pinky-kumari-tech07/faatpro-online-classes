import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, CheckCircle2, XCircle, AlertCircle, Clock, ExternalLink, FileText, Download, Eye, UserX, UserCheck } from "lucide-react";
import { useWorkspace } from "@/shared/hooks/useWorkspace";
import { instructorProfileService, maskAadhaar, type InstructorProfile, type VerificationStatus } from "@/services/supabase";
import { courseLifecycleService } from "@/services/supabase/courseLifecycleService";
import { toast } from "@/components/ui/use-toast";
import PageHeader from "@/modules/shared/PageHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import DeactivateInstructorDialog from "@/modules/instructors/DeactivateInstructorDialog";

type Row = InstructorProfile & { profile: { id: string; full_name: string | null; email: string | null; avatar_url: string | null } };

function StatusPill({ s }: { s: VerificationStatus }) {
  if (s === "approved") return <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600 text-white"><CheckCircle2 className="h-3 w-3" />Approved</Badge>;
  if (s === "rejected") return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Rejected</Badge>;
  if (s === "resubmission_required") return <Badge className="gap-1 bg-amber-500 hover:bg-amber-500 text-white"><AlertCircle className="h-3 w-3" />Resubmit</Badge>;
  return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />Pending</Badge>;
}

function DocLink({ label, path }: { label: string; path: string | null }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let on = true;
    (async () => {
      if (!path) { setUrl(null); return; }
      const u = await instructorProfileService.signedUrl(path);
      if (on) setUrl(u);
    })();
    return () => { on = false; };
  }, [path]);
  if (!path) {
    return (
      <li className="flex items-center justify-between rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
        <span className="flex items-center gap-2"><FileText className="h-4 w-4" />{label}</span>
        <span className="italic">Not uploaded</span>
      </li>
    );
  }
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const isImage = ["jpg", "jpeg", "png", "webp", "gif"].includes(ext);
  const isPdf = ext === "pdf";
  return (
    <li className="rounded-md border p-2 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-medium">
          <FileText className="h-4 w-4 text-primary" />{label}
          <Badge variant="outline" className="uppercase text-[10px]">{ext || "file"}</Badge>
        </span>
        {url && (
          <div className="flex items-center gap-1">
            <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
              <Eye className="h-3.5 w-3.5" />Open
            </a>
            <a href={url} download className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
              <Download className="h-3.5 w-3.5" />Download
            </a>
          </div>
        )}
      </div>
      {url && isImage && (
        <a href={url} target="_blank" rel="noreferrer" className="mt-2 block">
          <img src={url} alt={label} className="h-32 w-full rounded object-cover border" loading="lazy" />
        </a>
      )}
      {url && isPdf && (
        <a href={url} target="_blank" rel="noreferrer" className="mt-2 flex items-center justify-center gap-2 rounded border bg-muted/50 py-6 text-xs text-muted-foreground hover:bg-muted">
          <FileText className="h-4 w-4" /> Open PDF <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </li>
  );
}

function ActionsPanel({
  row, isAdmin, isPending, onApprove, onReject, onRequestChanges,
  onViewProfile, onDeactivate, onReactivate, reactivating,
}: {
  row: Row;
  isAdmin: boolean;
  isPending: boolean;
  onApprove: () => void;
  onReject: () => void;
  onRequestChanges: () => void;
  onViewProfile: () => void;
  onDeactivate: () => void;
  onReactivate: () => void;
  reactivating: boolean;
}) {
  const status = row.verification_status;
  const spin = isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null;
  const isActive = (row as any).profile?.is_active !== false;

  const viewProfileBtn = (
    <Button variant="outline" size="sm" className="w-full justify-start" onClick={onViewProfile}>
      <Eye className="h-4 w-4 mr-2" /> View profile
    </Button>
  );
  const deactivateBtn = (
    <Button variant="outline" size="sm" className="w-full justify-start text-destructive" onClick={onDeactivate}>
      <UserX className="h-4 w-4 mr-2" /> Deactivate instructor
    </Button>
  );
  const reactivateBtn = (
    <Button variant="outline" size="sm" className="w-full justify-start" onClick={onReactivate} disabled={reactivating}>
      <UserCheck className="h-4 w-4 mr-2" /> Reactivate instructor
    </Button>
  );

  return (
    <div className="space-y-2">
      {(status === "pending" || status === "resubmission_required") && isAdmin && (
        <>
          <Button size="sm" className="w-full justify-start" onClick={onApprove} disabled={isPending}>
            {spin}<CheckCircle2 className="h-4 w-4 mr-2" /> Approve verification
          </Button>
          <Button size="sm" variant="destructive" className="w-full justify-start" onClick={onReject} disabled={isPending}>
            <XCircle className="h-4 w-4 mr-2" /> Reject verification
          </Button>
          {status === "pending" && (
            <Button size="sm" variant="outline" className="w-full justify-start" onClick={onRequestChanges} disabled={isPending}>
              <AlertCircle className="h-4 w-4 mr-2" /> Request changes
            </Button>
          )}
          {status === "resubmission_required" && viewProfileBtn}
        </>
      )}

      {status === "approved" && (
        <>
          {viewProfileBtn}
          {isAdmin && (isActive ? deactivateBtn : reactivateBtn)}
        </>
      )}

      {status === "rejected" && (
        <>
          {viewProfileBtn}
          {isAdmin && (
            <Button size="sm" variant="outline" className="w-full justify-start" onClick={onRequestChanges} disabled={isPending}>
              <AlertCircle className="h-4 w-4 mr-2" /> Allow resubmission
            </Button>
          )}
          {isAdmin && !isActive && reactivateBtn}
        </>
      )}
    </div>
  );
}

export default function InstructorVerificationPage() {
  const { primaryRole } = useWorkspace();
  const isAdmin = ["organization_admin", "super_admin"].includes(primaryRole ?? "");
  const qc = useQueryClient();
  const nav = useNavigate();
  const [active, setActive] = useState<Row | null>(null);
  const [notes, setNotes] = useState("");
  const [tab, setTab] = useState<"pending" | "approved" | "rejected" | "resubmission_required">("pending");
  const [deactivateFor, setDeactivateFor] = useState<{ id: string; full_name: string | null; email: string | null } | null>(null);

  const reactivate = useMutation({
    mutationFn: (id: string) => courseLifecycleService.reactivateInstructor(id),
    onSuccess: () => {
      toast({ title: "Instructor reactivated" });
      qc.invalidateQueries();
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const listQ = useQuery({
    enabled: isAdmin,
    queryKey: ["instructor-verifications", "all", isAdmin],
    queryFn: () => instructorProfileService.listForReview(null, { allWorkspaces: true }),
  });

  const setStatus = useMutation({
    mutationFn: async (status: VerificationStatus) => {
      if (!active) throw new Error("No instructor selected");
      await instructorProfileService.setStatus(active.id, status, notes || null);
    },
    onSuccess: () => {
      toast({ title: "Updated" });
      setActive(null); setNotes("");
      qc.invalidateQueries({ queryKey: ["instructor-verifications"] });
    },
    onError: (e: any) => toast({ title: "Update failed", description: e?.message, variant: "destructive" }),
  });

  const allRows = (listQ.data ?? []) as Row[];
  const rows = allRows.filter((r) => r.verification_status === tab);
  const counts = {
    pending: allRows.filter((r) => r.verification_status === "pending").length,
    approved: allRows.filter((r) => r.verification_status === "approved").length,
    rejected: allRows.filter((r) => r.verification_status === "rejected").length,
    resubmission_required: allRows.filter((r) => r.verification_status === "resubmission_required").length,
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Instructor verification" description="Review submitted KYC, academic and banking documents." />

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="pending">Pending ({counts.pending})</TabsTrigger>
          <TabsTrigger value="approved">Approved ({counts.approved})</TabsTrigger>
          <TabsTrigger value="rejected">Rejected ({counts.rejected})</TabsTrigger>
          <TabsTrigger value="resubmission_required">Needs Changes ({counts.resubmission_required})</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4">
      {listQ.isLoading ? (
        <div className="grid place-items-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : rows.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">No instructors in this list.</Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((r) => {
            const docs = [r.aadhaar_front_url, r.pan_card_url, r.highest_qualification_certificate_url, r.bank_document_url].filter(Boolean).length;
            return (
              <Card key={r.id} className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={r.profile?.avatar_url ?? undefined} />
                    <AvatarFallback>{(r.profile?.full_name ?? "I").slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{r.profile?.full_name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground truncate">{r.profile?.email}</p>
                  </div>
                  <StatusPill s={r.verification_status} />
                </div>
                <p className="text-xs text-muted-foreground">{docs} of 4 core documents submitted</p>
                <p className="text-[11px] text-muted-foreground">
                  Updated {new Date(r.updated_at).toLocaleDateString()}
                </p>
                {r.id.startsWith("synthetic:") ? (
                  <Button size="sm" variant="outline" className="w-full" disabled>
                    Awaiting submission
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => { setActive(r); setNotes(r.verification_notes ?? ""); }}
                  >
                    Review
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
      )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <span>Review — {active?.profile?.full_name}</span>
              {active && <StatusPill s={active.verification_status} />}
            </DialogTitle>
          </DialogHeader>
          {active && (
            <div className="grid gap-5 md:grid-cols-[1fr_200px]">
              <div className="space-y-5">
              <section>
                <h4 className="text-sm font-semibold mb-2">Identity</h4>
                <div className="text-sm space-y-1">
                  <p><span className="text-muted-foreground">Aadhaar:</span> {maskAadhaar(active.aadhaar_number) || "—"}</p>
                  <p><span className="text-muted-foreground">PAN:</span> {active.pan_number || "—"}</p>
                </div>
                <ul className="mt-2 space-y-1">
                  <DocLink label="Aadhaar front" path={active.aadhaar_front_url} />
                  <DocLink label="Aadhaar back" path={active.aadhaar_back_url} />
                  <DocLink label="PAN card" path={active.pan_card_url} />
                </ul>
              </section>
              <section>
                <h4 className="text-sm font-semibold mb-2">Academic</h4>
                <div className="text-sm space-y-1">
                  <p><span className="text-muted-foreground">Board:</span> {active.board_type || "—"}</p>
                  <p><span className="text-muted-foreground">Highest qualification:</span> {active.highest_qualification || "—"}</p>
                </div>
                <ul className="mt-2 space-y-1">
                  <DocLink label="Board certificate" path={active.board_certificate_url} />
                  <DocLink label="Qualification certificate" path={active.highest_qualification_certificate_url} />
                </ul>
              </section>
              <section>
                <h4 className="text-sm font-semibold mb-2">Banking</h4>
                <div className="text-sm space-y-1">
                  <p><span className="text-muted-foreground">Holder:</span> {active.account_holder_name || "—"}</p>
                  <p><span className="text-muted-foreground">Bank:</span> {active.bank_name || "—"} ({active.branch_name || "—"})</p>
                  <p><span className="text-muted-foreground">Account:</span> {active.bank_account_number ? `••••${active.bank_account_number.slice(-4)}` : "—"}</p>
                  <p><span className="text-muted-foreground">IFSC:</span> {active.ifsc_code || "—"}</p>
                  <p><span className="text-muted-foreground">UPI:</span> {active.upi_id || "—"}</p>
                </div>
                <ul className="mt-2 space-y-1">
                  <DocLink label="Cancelled cheque / passbook" path={active.bank_document_url} />
                </ul>
                <div className="mt-3 flex items-center gap-2 text-sm">
                  <span className={(active as any).bank_verified ? "text-emerald-600" : "text-amber-600"}>
                    Bank status: {(active as any).bank_verified ? "Verified" : "Not verified"}
                  </span>
                  <Button
                    size="sm"
                    variant={(active as any).bank_verified ? "outline" : "default"}
                    onClick={async () => {
                      try {
                        const { settlementService } = await import("@/services/supabase/revenueService");
                        await settlementService.verifyInstructorBank(active.id, !(active as any).bank_verified);
                        window.location.reload();
                      } catch (e: any) {
                        alert(e?.message ?? "Failed to update bank verification");
                      }
                    }}
                  >
                    {(active as any).bank_verified ? "Un-verify bank" : "Mark bank verified"}
                  </Button>
                </div>
              </section>
              <section>
                <h4 className="text-sm font-semibold mb-2">Contact</h4>
                <div className="text-sm space-y-1">
                  <p>{active.registration_mobile} · WhatsApp {active.whatsapp_number || "—"}</p>
                  <p className="text-muted-foreground">{[active.address, active.city, active.state, active.country, active.pin_code].filter(Boolean).join(", ") || "—"}</p>
                </div>
              </section>
              <section>
                <h4 className="text-sm font-semibold mb-2">Admin notes</h4>
                <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes for the instructor" />
              </section>
              </div>
              <aside className="md:border-l md:pl-5">
                <h4 className="text-sm font-semibold mb-3">Actions</h4>
                <ActionsPanel
                  row={active}
                  isAdmin={isAdmin}
                  isPending={setStatus.isPending}
                  onApprove={() => setStatus.mutate("approved")}
                  onReject={() => setStatus.mutate("rejected")}
                  onRequestChanges={() => setStatus.mutate("resubmission_required")}
                  onViewProfile={() => active.profile?.id && nav(`/instructors/${active.profile.id}`)}
                  onDeactivate={() => active.profile?.id && setDeactivateFor({ id: active.profile.id, full_name: active.profile.full_name, email: active.profile.email })}
                  onReactivate={() => active.profile?.id && reactivate.mutate(active.profile.id)}
                  reactivating={reactivate.isPending}
                />
              </aside>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <DeactivateInstructorDialog
        open={!!deactivateFor}
        onOpenChange={(o) => !o && setDeactivateFor(null)}
        instructor={deactivateFor}
      />
    </div>
  );
}
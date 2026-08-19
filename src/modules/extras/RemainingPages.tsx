import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, MessageCircle, CreditCard, Receipt, LineChart, Plug, ShieldCheck, ScrollText, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/shared/hooks/useWorkspace";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/components/ui/use-toast";
import PageHeader from "@/modules/shared/PageHeader";
import { activityService } from "@/services/supabase";
import { paymentService } from "@/services/supabase/coursePricingService";
import { formatDistanceToNow } from "date-fns";
import { CourseSelectItems } from "@/shared/components/CourseSelectItems";
import { useManageableCourses } from "@/shared/hooks/useManageableCourses";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { validatePayment, SUPPORTED_CURRENCIES } from "@/lib/validators";
import { mapDbError } from "@/lib/errorMapper";
import { Search } from "lucide-react";

function formatActivityDate(value: unknown): string {
  if (!value) return "Recently";
  const d = new Date(value as string);
  if (isNaN(d.getTime())) return "Recently";
  return formatDistanceToNow(d, { addSuffix: true });
}

// ============ DISCUSSIONS ============
export function DiscussionsPage() {
  const { membership, primaryRole } = useWorkspace();
  const wsId = membership?.workspace.id;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ title: "", body: "", course_id: "" });
  const [editing, setEditing] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({ title: "", body: "" });
  const [deleting, setDeleting] = useState<any>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const canManageAll = ["organization_admin", "staff", "super_admin"].includes(primaryRole ?? "");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
  }, []);

  const { courses, isLoading: coursesLoading, error: coursesError } = useManageableCourses();
  const discussionsQuery = useQuery({
    queryKey: ["discussions", wsId],
    queryFn: async () => {
      if (!wsId) return [];
      // Do NOT filter by workspace here: instructors can own courses that live
      // in another workspace. RLS already scopes rows to what the user may see.
      const { data, error } = await supabase
        .from("discussions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = data ?? [];
      const authorIds = Array.from(new Set(rows.map((r: any) => r.author_id).filter(Boolean)));
      const courseIds = Array.from(new Set(rows.map((r: any) => r.course_id).filter(Boolean)));
      let profMap = new Map<string, any>();
      let courseMap = new Map<string, any>();
      if (authorIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", authorIds);
        profMap = new Map((profs ?? []).map((p: any) => [p.id, p]));
      }
      if (courseIds.length) {
        const { data: courseRows } = await supabase
          .from("courses")
          .select("id, title")
          .is("deleted_at", null)
          .in("id", courseIds);
        courseMap = new Map((courseRows ?? []).map((c: any) => [c.id, c]));
      }
      const hydrated = rows.map((r: any) => ({ ...r, author: profMap.get(r.author_id) ?? null, course: courseMap.get(r.course_id) ?? null }));
      return hydrated;
    },
    enabled: !!wsId,
  });

  const update = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const { error } = await supabase.from("discussions")
        .update({ title: editForm.title, body: editForm.body })
        .eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast({ title: "Discussion updated" });
      await qc.invalidateQueries({ queryKey: ["discussions"] });
      setEditing(null);
    },
    onError: (e: any) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("discussions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast({ title: "Discussion deleted" });
      await qc.invalidateQueries({ queryKey: ["discussions"] });
      setDeleting(null);
    },
    onError: (e: any) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });
  const discussions = discussionsQuery.data ?? [];

  const create = useMutation({
    mutationFn: async () => {
      if (!wsId) throw new Error("Workspace is not ready");
      if (!form.title?.trim()) throw new Error("Title is required");
      if (!form.course_id) throw new Error("Select a course for this topic");
      const { data: u } = await supabase.auth.getUser();
      const selected = courses.find((c: any) => c.id === form.course_id);
      const { data, error } = await supabase.from("discussions").insert({
        workspace_id: selected?.workspace_id ?? wsId,
        course_id: form.course_id || null,
        author_id: u.user!.id,
        title: form.title.trim(),
        body: form.body?.trim() || null,
      }).select("id, workspace_id, course_id, author_id, title, body, reply_count, created_at").single();
      if (error) throw new Error(mapDbError(error));
      return data;
    },
    onSuccess: async () => {
      toast({ title: "Discussion posted" });
      await qc.invalidateQueries({ queryKey: ["discussions"] });
      await qc.refetchQueries({ queryKey: ["discussions"] });
      setOpen(false);
      setForm({ title: "", body: "", course_id: "" });
    },
    onError: (e: any) =>
      toast({ title: "Could not post discussion", description: e?.message ?? "Unknown error", variant: "destructive" }),
  });

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader title="Discussions" description="Course discussion boards for Q&A and peer learning."
        actions={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> New topic</Button>} />
      <div className="text-sm text-muted-foreground">Total Discussions: {discussions.length || 0}</div>
      {discussionsQuery.error && (
        <Card className="p-4 border-destructive/40 text-sm text-destructive shadow-none">
          Unable to load discussions right now.
        </Card>
      )}
      <div className="space-y-3">
        {discussions.map((d: any) => (
          <Card key={d.id} className="p-5 border-border shadow-none">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="font-semibold">{d.title}</div>
                <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{d.body}</p>
                <div className="text-xs text-muted-foreground mt-2">
                  {d.author?.full_name ?? "User"} · {d.course?.title ?? "Course"} · {d.reply_count ?? 0} replies · {formatActivityDate(d.created_at)}
                </div>
              </div>
              {(canManageAll || d.author_id === currentUserId) && (
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" title="Edit"
                    onClick={() => { setEditing(d); setEditForm({ title: d.title ?? "", body: d.body ?? "" }); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" title="Delete" onClick={() => setDeleting(d)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              )}
            </div>
          </Card>
        ))}
        {!discussionsQuery.isLoading && discussions.length === 0 && !discussionsQuery.error && (
          <Card className="p-12 text-center text-muted-foreground border-border shadow-none">
            <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" /> No discussions yet.
          </Card>
        )}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New discussion</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Course</Label>
              <Select value={form.course_id} onValueChange={(v) => setForm({ ...form, course_id: v })}>
                <SelectTrigger><SelectValue placeholder="Course" /></SelectTrigger>
                <SelectContent><CourseSelectItems courses={courses} isLoading={coursesLoading} error={coursesError} /></SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Body</Label><Textarea rows={5} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => create.mutate()} disabled={!wsId || !form.title || !form.course_id || create.isPending}>Post</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit discussion</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Title</Label>
              <Input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
            </div>
            <div className="space-y-1.5"><Label>Body</Label>
              <Textarea rows={5} value={editForm.body} onChange={(e) => setEditForm({ ...editForm, body: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={() => update.mutate()} disabled={!editForm.title || update.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete discussion?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleting?.title}" and its replies will be permanently removed.
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

// ============ PAYMENTS ============
export function PaymentsPage() {
  const { membership, primaryRole } = useWorkspace();
  const wsId = membership!.workspace.id;
  const isAdmin = ["organization_admin", "staff", "super_admin"].includes(String(primaryRole));
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleting, setDeleting] = useState<any>(null);
  const [form, setForm] = useState<any>({ student_id: "", course_id: "", amount: 0, provider: "offline", status: "succeeded", currency: "INR", transaction_id: "" });
  const [autofilled, setAutofilled] = useState(false);
  const [payErrors, setPayErrors] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");

  const { data: payments } = useQuery({
    queryKey: ["payments", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("workspace_id", wsId)
        .order("created_at", { ascending: false });
      if (error) { console.error("[payments] fetch error", error); throw error; }
      const rows = data ?? [];
      console.log("[payments] fetched", rows.length, "wsId=", wsId);
      const studentIds = Array.from(new Set(rows.map((r: any) => r.student_id).filter(Boolean)));
      const courseIds = Array.from(new Set(rows.map((r: any) => r.course_id).filter(Boolean)));
      const [profilesRes, coursesRes] = await Promise.all([
        studentIds.length ? supabase.from("profiles").select("id, full_name, email").in("id", studentIds) : Promise.resolve({ data: [] as any[] }),
        courseIds.length ? supabase.from("courses").select("id, title").is("deleted_at", null).in("id", courseIds) : Promise.resolve({ data: [] as any[] }),
      ]);
      const pMap = new Map((profilesRes.data ?? []).map((p: any) => [p.id, p]));
      const cMap = new Map((coursesRes.data ?? []).map((c: any) => [c.id, c]));
      return rows.map((r: any) => ({ ...r, profile: pMap.get(r.student_id), course: cMap.get(r.course_id) }));
    },
  });
  // Only active students in this workspace — never instructors, admins, staff, etc.
  const { data: students = [] } = useQuery({
    queryKey: ["wm-pay-students", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspace_members")
        .select("profile_id, profiles:profile_id(id, full_name, email, is_active)")
        .eq("workspace_id", wsId)
        .eq("role", "student")
        .eq("status", "active");
      if (error) { console.error("[payments] students fetch", error); return []; }
      const rows = (data ?? []).filter((m: any) => m.profiles && m.profiles.is_active !== false);
      const ids = rows.map((r: any) => r.profile_id);
      let codeMap = new Map<string, string>();
      if (ids.length) {
        const { data: sp } = await supabase
          .from("student_profiles")
          .select("user_id, registration_number, roll_number")
          .in("user_id", ids);
        codeMap = new Map(
          (sp ?? []).map((s: any) => [s.user_id, s.registration_number || s.roll_number || ""]),
        );
      }
      return rows
        .map((m: any) => ({
          id: m.profile_id,
          name: m.profiles?.full_name ?? "Student",
          email: m.profiles?.email ?? "",
          student_code: codeMap.get(m.profile_id) || "",
        }))
        .sort((a: any, b: any) => a.name.localeCompare(b.name));
    },
  });
  const [studentPickerOpen, setStudentPickerOpen] = useState(false);
  const { courses, isLoading: coursesLoading, error: coursesError } = useManageableCourses();

  const create = useMutation({
    mutationFn: async () => {
      const found = validatePayment(form);
      setPayErrors(found);
      const first = Object.values(found)[0];
      if (first) throw new Error(first);
      const amt = Number(form.amount);
      const txn = (form.transaction_id || "").trim() || null;
      const selected = courses.find((c: any) => c.id === form.course_id);
      const payload: any = {
        student_id: form.student_id, course_id: form.course_id || null,
        amount: amt, total_amount: amt,
        provider: form.provider, status: form.status, currency: form.currency || "INR",
        external_payment_id: txn,
      };
      if (form.provider === "razorpay") payload.razorpay_payment_id = txn;
      if (editing) {
        const { data, error } = await supabase.from("payments").update(payload).eq("id", editing.id).select("*").single();
        if (error) throw error;
        return data;
      }
      const insertPayload = { ...payload, workspace_id: selected?.workspace_id ?? wsId, base_price: amt };
      const { data, error } = await supabase.from("payments").insert(insertPayload).select("*").single();
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      toast({ title: editing ? "Payment updated" : "Payment recorded" });
      setPayErrors({});
      await qc.invalidateQueries({ queryKey: ["payments"] });
      await qc.refetchQueries({ queryKey: ["payments", wsId] });
      setOpen(false);
      setEditing(null);
      setForm({ student_id: "", course_id: "", amount: 0, provider: "offline", status: "succeeded", currency: "INR", transaction_id: "" });
      setAutofilled(false);
    },
    onError: (e: any) => toast({ title: "Could not save payment", description: mapDbError(e), variant: "destructive" }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("payments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast({ title: "Payment deleted" });
      setDeleting(null);
      await qc.invalidateQueries({ queryKey: ["payments"] });
    },
    onError: (e: any) => toast({ title: "Delete failed", description: mapDbError(e), variant: "destructive" }),
  });

  const approveOffline = useMutation({
    mutationFn: async (paymentId: string) => paymentService.markPaymentPaid(paymentId),
    onSuccess: async () => {
      toast({ title: "Offline payment approved", description: "Enrollment and invoice have been updated." });
      await qc.invalidateQueries({ queryKey: ["payments"] });
      await qc.invalidateQueries({ queryKey: ["orders"] });
      await qc.invalidateQueries({ queryKey: ["admin-dash-stats"] });
    },
    onError: (e: any) => toast({ title: "Approval failed", description: mapDbError(e), variant: "destructive" }),
  });

  // Auto-fetch online payment details when student + course selected
  useEffect(() => {
    if (!open || !form.student_id || !form.course_id) { setAutofilled(false); return; }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("workspace_id", wsId)
        .eq("student_id", form.student_id)
        .eq("course_id", form.course_id)
        .neq("provider", "manual")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (error) { console.warn("[payments] autofetch error", error); return; }
      if (!data) { setAutofilled(false); return; }
      const txn = (data as any).razorpay_payment_id ?? (data as any).external_payment_id ?? "";
      setForm((f: any) => ({
        ...f,
        amount: data.total_amount ?? data.amount ?? f.amount,
        currency: data.currency ?? f.currency,
        provider: data.provider ?? f.provider,
        status: data.status ?? f.status,
        transaction_id: txn,
      }));
      setAutofilled(true);
    })();
    return () => { cancelled = true; };
  }, [open, form.student_id, form.course_id, wsId]);

  const fmtINR = (amount: any, currency?: string) => {
    const cur = currency || "INR";
    const sym = cur === "INR" ? "₹" : cur === "USD" ? "$" : cur === "EUR" ? "€" : cur === "GBP" ? "£" : `${cur} `;
    return `${sym}${Number(amount ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
  };

  const q = search.trim().toLowerCase();
  const visiblePayments = (payments ?? []).filter((p: any) => {
    if (!q) return true;
    return [
      p.profile?.full_name, p.profile?.email, p.course?.title, p.provider, p.status,
      p.razorpay_payment_id, p.external_payment_id, String(p.total_amount ?? p.amount ?? ""),
    ].some((v: any) => String(v ?? "").toLowerCase().includes(q));
  });

  return (
    <div className="space-y-6 max-w-7xl">
      <PageHeader title="Payments" description="Track payments and revenue across your workspace."
        actions={<Button onClick={() => { setEditing(null); setForm({ student_id: "", course_id: "", amount: 0, provider: "offline", status: "succeeded", currency: "INR", transaction_id: "" }); setOpen(true); }}><Plus className="h-4 w-4 mr-1" /> Record payment</Button>} />

      <Card className="border-border shadow-none">
        <div className="p-4 border-b border-border">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by student, email, course, txn ID…"
              className="pl-9"
            />
          </div>
        </div>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Student</TableHead><TableHead>Email</TableHead><TableHead>Course</TableHead>
            <TableHead>Amount</TableHead><TableHead>Provider</TableHead><TableHead>Status</TableHead>
            <TableHead>Transaction ID</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Action</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {visiblePayments.map((p: any) => (
              <TableRow key={p.id}>
                <TableCell>{p.profile?.full_name ?? "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{p.profile?.email ?? "—"}</TableCell>
                <TableCell className="text-sm">{p.course?.title ?? "—"}</TableCell>
                <TableCell className="font-medium">{fmtINR(p.total_amount ?? p.amount, p.currency)}</TableCell>
                <TableCell className="capitalize text-sm">{p.provider === "offline" ? "Offline" : p.provider === "manual" ? "Manual" : p.provider}</TableCell>
                <TableCell>
                  <Badge variant={p.status === "succeeded" ? "default" : p.status === "pending" ? "secondary" : "destructive"} className="capitalize">
                    {p.provider === "offline" && p.status === "pending" ? "Offline pending" : p.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs font-mono">{p.razorpay_payment_id ?? p.external_payment_id ?? "—"}</TableCell>
                <TableCell className="text-sm">{p.created_at ? new Date(p.created_at).toLocaleDateString() : "—"}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {p.provider === "offline" && p.status === "pending" && (
                      <Button size="sm" onClick={() => approveOffline.mutate(p.id)} disabled={approveOffline.isPending}>Approve</Button>
                    )}
                    {isAdmin && (
                      <>
                        <Button variant="ghost" size="icon" title="Edit" onClick={() => {
                          setEditing(p);
                          setForm({
                            student_id: p.student_id ?? "",
                            course_id: p.course_id ?? "",
                            amount: p.total_amount ?? p.amount ?? 0,
                            provider: p.provider ?? "offline",
                            status: p.status ?? "pending",
                            currency: p.currency ?? "INR",
                            transaction_id: p.razorpay_payment_id ?? p.external_payment_id ?? "",
                          });
                          setOpen(true);
                        }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Delete" onClick={() => setDeleting(p)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {visiblePayments.length === 0 && (
              <TableRow><TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-50" />
                {q ? `No payments match “${search}”.` : "No payments recorded yet."}
              </TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit payment" : "Record payment"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>
                Student{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  ({students.length} active)
                </span>
              </Label>
              <Popover open={studentPickerOpen} onOpenChange={setStudentPickerOpen} modal>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={studentPickerOpen}
                    className="w-full justify-between font-normal"
                  >
                    {form.student_id ? (
                      (() => {
                        const s = students.find((x: any) => x.id === form.student_id);
                        return s ? (
                          <span className="truncate text-left">
                            <span className="font-medium">{s.name}</span>
                            {s.email && (
                              <span className="text-muted-foreground"> · {s.email}</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Select student…</span>
                        );
                      })()
                    ) : (
                      <span className="text-muted-foreground">Select student…</span>
                    )}
                    <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  sideOffset={4}
                  collisionPadding={16}
                  className="p-0 w-[--radix-popover-trigger-width] min-w-[340px] z-[60]"
                >
                  <Command
                    filter={(value, search) =>
                      value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
                    }
                  >
                    <CommandInput placeholder="Search by name, email, or ID…" />
                    <CommandList className="max-h-[360px] overflow-y-auto">
                      <CommandEmpty>No active students found.</CommandEmpty>
                      <CommandGroup>
                        {students.map((s: any) => (
                          <CommandItem
                            key={s.id}
                            value={`${s.name} ${s.email} ${s.student_code}`}
                            onSelect={() => {
                              setForm({ ...form, student_id: s.id });
                              setStudentPickerOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "h-4 w-4 mr-2 shrink-0",
                                form.student_id === s.id ? "opacity-100" : "opacity-0",
                              )}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="font-medium truncate">{s.name}</div>
                              <div className="text-xs text-muted-foreground truncate">
                                {s.email || "—"}
                                {s.student_code && (
                                  <>
                                    {" "}
                                    · <span className="font-mono">{s.student_code}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5"><Label>Course</Label>
              <Select value={form.course_id} onValueChange={(v) => setForm({ ...form, course_id: v })}>
                <SelectTrigger><SelectValue placeholder="Course (optional)" /></SelectTrigger>
                <SelectContent><CourseSelectItems courses={courses} isLoading={coursesLoading} error={coursesError} /></SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Amount</Label>
                <Input type="number" min="0.01" step="0.01" value={form.amount} aria-invalid={!!payErrors.amount}
                  onChange={(e) => { setPayErrors((p) => ({ ...p, amount: "" })); setForm({ ...form, amount: e.target.value }); }} />
                {payErrors.amount && <p className="text-xs text-destructive">{payErrors.amount}</p>}
              </div>
              <div className="space-y-1.5"><Label>Currency</Label>
                <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                {payErrors.currency && <p className="text-xs text-destructive">{payErrors.currency}</p>}
              </div>
              <div className="space-y-1.5"><Label>Provider</Label>
                <Select value={form.provider} onValueChange={(v) => setForm({ ...form, provider: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="offline">Offline payment</SelectItem>
                    <SelectItem value="manual">Manual legacy</SelectItem>
                    <SelectItem value="razorpay">Razorpay</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="succeeded">Succeeded</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="refunded">Refunded</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Transaction ID</Label>
              <Input
                placeholder="e.g. pay_XXXXXXXXXXXX (leave blank for manual cash)"
                value={form.transaction_id}
                aria-invalid={!!payErrors.transaction_id}
                onChange={(e) => { setPayErrors((p) => ({ ...p, transaction_id: "" })); setForm({ ...form, transaction_id: e.target.value }); }}
              />
              {payErrors.transaction_id && <p className="text-xs text-destructive">{payErrors.transaction_id}</p>}
              {payErrors.student_id && <p className="text-xs text-destructive">{payErrors.student_id}</p>}
              {autofilled && (
                <p className="text-xs text-muted-foreground">Auto-filled from online payment on this website.</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending}>{editing ? "Update" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete payment?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the payment record. Related invoices and enrollments are not automatically reversed.
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

// ============ INVOICES ============
export function InvoicesPage() {
  const { membership } = useWorkspace();
  const wsId = membership!.workspace.id;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ student_id: "", course_id: "", amount: 0, tax: 0, currency: "USD", gst_number: "", invoice_number: "" });

  const { data: invoices } = useQuery({
    queryKey: ["invoices", wsId],
    queryFn: async () => (await supabase.from("invoices").select("*, courses:course_id(title), profiles:student_id(full_name)")
      .eq("workspace_id", wsId).order("issued_at", { ascending: false })).data ?? [],
  });
  const { data: members } = useQuery({
    queryKey: ["wm-inv", wsId],
    queryFn: async () => (await supabase.from("workspace_members").select("profile_id, profiles:profile_id(full_name)").eq("workspace_id", wsId)).data ?? [],
  });
  const { courses, isLoading: coursesLoading, error: coursesError } = useManageableCourses();

  const create = useMutation({
    mutationFn: async () => {
      const num = form.invoice_number || `INV-${Date.now()}`;
      const selected = courses.find((c: any) => c.id === form.course_id);
      const { error } = await supabase.from("invoices").insert({
        workspace_id: selected?.workspace_id ?? wsId, student_id: form.student_id, course_id: form.course_id || null,
        invoice_number: num, amount: Number(form.amount), tax: Number(form.tax),
        currency: form.currency, gst_number: form.gst_number || null, status: "issued",
      });
      if (error) throw error;
    },
    onSuccess: () => { toast({ title: "Invoice generated" }); qc.invalidateQueries({ queryKey: ["invoices"] }); setOpen(false); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6 max-w-7xl">
      <PageHeader title="Invoices" description="Issued invoices and receipts for your workspace."
        actions={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Generate invoice</Button>} />
      <Card className="border-border shadow-none">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Number</TableHead><TableHead>Student</TableHead><TableHead>Course</TableHead>
            <TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead>Issued</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {(invoices ?? []).map((i: any) => (
              <TableRow key={i.id}>
                <TableCell className="font-mono text-sm">{i.invoice_number}</TableCell>
                <TableCell>{i.profiles?.full_name ?? "—"}</TableCell>
                <TableCell className="text-sm">{i.courses?.title ?? "—"}</TableCell>
                <TableCell className="font-medium">{new Intl.NumberFormat("en-IN", { style: "currency", currency: i.currency || "INR", minimumFractionDigits: 2 }).format(Number(i.amount ?? 0))}</TableCell>
                <TableCell><Badge variant="secondary">{i.status}</Badge></TableCell>
                <TableCell className="text-sm">{new Date(i.issued_at).toLocaleDateString()}</TableCell>
                <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => window.print()}>Download</Button></TableCell>
              </TableRow>
            ))}
            {(invoices ?? []).length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                <Receipt className="h-8 w-8 mx-auto mb-2 opacity-50" /> No invoices yet.
              </TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Generate invoice</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Student</Label>
              <Select value={form.student_id} onValueChange={(v) => setForm({ ...form, student_id: v })}>
                <SelectTrigger><SelectValue placeholder="Student" /></SelectTrigger>
                <SelectContent>{(members ?? []).map((m: any) => <SelectItem key={m.profile_id} value={m.profile_id}>{m.profiles?.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Course</Label>
              <Select value={form.course_id} onValueChange={(v) => setForm({ ...form, course_id: v })}>
                <SelectTrigger><SelectValue placeholder="Course (optional)" /></SelectTrigger>
                <SelectContent><CourseSelectItems courses={courses} isLoading={coursesLoading} error={coursesError} /></SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Amount</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Tax</Label><Input type="number" value={form.tax} onChange={(e) => setForm({ ...form, tax: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Currency</Label><Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>GST / Tax #</Label><Input value={form.gst_number} onChange={(e) => setForm({ ...form, gst_number: e.target.value })} /></div>
              <div className="col-span-2 space-y-1.5"><Label>Invoice number (auto if blank)</Label><Input value={form.invoice_number} onChange={(e) => setForm({ ...form, invoice_number: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => create.mutate()} disabled={!form.student_id || !form.amount}>Generate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============ ANALYTICS ============
export function AnalyticsPage() {
  const { membership } = useWorkspace();
  const wsId = membership!.workspace.id;

  const { data } = useQuery({
    queryKey: ["analytics", wsId],
    queryFn: async () => {
      const [c, e, p, a, q] = await Promise.all([
        supabase.from("courses").select("id, status", { count: "exact" }).eq("workspace_id", wsId).is("deleted_at", null),
        supabase.from("enrollments").select("id, status", { count: "exact" }).eq("workspace_id", wsId),
        supabase.from("payments").select("amount, currency, status").eq("workspace_id", wsId).eq("status", "succeeded"),
        supabase.from("assignment_submissions").select("id", { count: "exact" }).eq("workspace_id", wsId),
        supabase.from("quiz_attempts").select("score, max_score").eq("workspace_id", wsId),
      ]);
      const revenue = (p.data ?? []).reduce((s, r: any) => s + Number(r.amount), 0);
      const avg = q.data?.length ? Math.round((q.data.reduce((s: number, r: any) => s + (r.score / Math.max(r.max_score, 1)) * 100, 0) / q.data.length)) : 0;
      return { courses: c.count ?? 0, enrollments: e.count ?? 0, revenue, submissions: a.count ?? 0, quizAvg: avg };
    },
  });

  const cards = [
    { label: "Total courses", value: data?.courses ?? 0 },
    { label: "Active enrollments", value: data?.enrollments ?? 0 },
    { label: "Revenue (paid)", value: new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 }).format(data?.revenue ?? 0) },
    { label: "Submissions", value: data?.submissions ?? 0 },
    { label: "Avg quiz score", value: `${data?.quizAvg ?? 0}%` },
  ];

  return (
    <div className="space-y-6 max-w-7xl">
      <PageHeader title="Analytics" description="Engagement, completion and revenue across your workspace." />
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {cards.map((c) => (
          <Card key={c.label} className="p-5 border-border shadow-none">
            <div className="text-xs text-muted-foreground">{c.label}</div>
            <div className="text-2xl font-bold mt-1">{c.value}</div>
          </Card>
        ))}
      </div>
      <Card className="p-12 text-center text-muted-foreground border-border shadow-none">
        <LineChart className="h-8 w-8 mx-auto mb-2 opacity-50" />
        Detailed engagement and retention charts appear once you have more activity.
      </Card>
    </div>
  );
}

// ============ INTEGRATIONS ============
export function IntegrationsPage() {
  const integrations = [
    { name: "Zoom", desc: "Run live classes with auto-generated meeting links.", status: "Available" },
    { name: "Google Meet", desc: "Schedule classes via Google Calendar.", status: "Available" },
    { name: "Jitsi", desc: "Self-hosted video conferencing.", status: "Available" },
    { name: "Razorpay", desc: "Accept INR payments and UPI.", status: "Configurable" },
    { name: "Resend", desc: "Transactional email delivery.", status: "Configurable" },
    { name: "Webhooks", desc: "Send events to your custom endpoints.", status: "Configurable" },
  ];
  return (
    <div className="space-y-6 max-w-6xl">
      <PageHeader title="Integrations" description="Connect your LMS to the tools your team uses." />
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {integrations.map((i) => (
          <Card key={i.name} className="p-5 border-border shadow-none">
            <div className="flex items-start justify-between mb-2">
              <div className="font-semibold flex items-center gap-2"><Plug className="h-4 w-4 text-primary" /> {i.name}</div>
              <Badge variant="secondary">{i.status}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mb-3">{i.desc}</p>
            <Button size="sm" variant="outline">Configure</Button>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ============ ROLES & PERMISSIONS ============
export function RolesPage() {
  const { membership } = useWorkspace();
  const wsId = membership!.workspace.id;
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "student" | "instructor" | "staff">("all");
  const [search, setSearch] = useState("");

  const { data: rows } = useQuery({
    queryKey: ["roles-people", wsId],
    queryFn: async () => {
      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("id, full_name, email, signup_role, created_at")
        .order("created_at", { ascending: false });
      if (pErr) console.error("profiles query error:", pErr);

      const { data: mems, error: mErr } = await supabase
        .from("workspace_members")
        .select("id, role, status, profile_id")
        .eq("workspace_id", wsId);
      if (mErr) console.error("workspace_members query error:", mErr);

      const memByProfile = new Map<string, any>();
      (mems ?? []).forEach((m: any) => memByProfile.set(m.profile_id, m));

      return (profiles ?? []).map((p: any) => {
        const m = memByProfile.get(p.id);
        const role = m?.role ?? p.signup_role ?? "student";
        return {
          profile_id: p.id,
          full_name: p.full_name,
          email: p.email,
          created_at: p.created_at,
          member_id: m?.id ?? null,
          status: m?.status ?? "—",
          role,
        };
      });
    },
    enabled: !!wsId,
  });

  const update = useMutation({
    mutationFn: async ({ profileId, memberId, role }: { profileId: string; memberId: string | null; role: any }) => {
      if (memberId) {
        const { error } = await supabase.from("workspace_members").update({ role }).eq("id", memberId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("workspace_members").insert({
          workspace_id: wsId, profile_id: profileId, role, status: "active",
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "Role updated" });
      qc.invalidateQueries({ queryKey: ["roles-people"] });
      qc.invalidateQueries({ queryKey: ["workspace-members"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const builtin = [
    { role: "organization_admin", desc: "Full access to workspace, billing, members, and content." },
    { role: "instructor", desc: "Manage assigned courses, lessons, quizzes, assignments, grades." },
    { role: "staff", desc: "Operations support: enroll students, manage attendance and invoices." },
    { role: "student", desc: "Enroll in courses, take quizzes, submit assignments." },
    { role: "parent", desc: "Read-only access to a linked student's progress." },
  ];

  const staffRoles = new Set(["organization_admin", "staff", "super_admin"]);
  const filtered = (rows ?? []).filter((r) => {
    if (filter === "staff" && !staffRoles.has(r.role)) return false;
    if (filter === "student" && r.role !== "student") return false;
    if (filter === "instructor" && r.role !== "instructor") return false;
    if (search) {
      const q = search.toLowerCase();
      if (!(r.full_name ?? "").toLowerCase().includes(q) && !(r.email ?? "").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const counts = {
    all: (rows ?? []).length,
    student: (rows ?? []).filter((r) => r.role === "student").length,
    instructor: (rows ?? []).filter((r) => r.role === "instructor").length,
    staff: (rows ?? []).filter((r) => staffRoles.has(r.role)).length,
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <PageHeader title="Roles & permissions" description="Manage built-in roles and member assignments." />
      <div className="grid md:grid-cols-2 gap-3">
        {builtin.map((b) => (
          <Card key={b.role} className="p-4 border-border shadow-none">
            <div className="flex items-center gap-2 font-medium capitalize"><ShieldCheck className="h-4 w-4 text-primary" /> {b.role.replace("_", " ")}</div>
            <p className="text-sm text-muted-foreground mt-1">{b.desc}</p>
          </Card>
        ))}
      </div>
      <Card className="border-border shadow-none">
        <div className="p-4 border-b border-border flex flex-wrap items-center justify-between gap-3">
          <div className="font-semibold">People</div>
          <div className="flex flex-wrap items-center gap-2">
            {(["all", "student", "instructor", "staff"] as const).map((k) => (
              <Button
                key={k}
                size="sm"
                variant={filter === k ? "default" : "outline"}
                onClick={() => setFilter(k)}
                className="capitalize"
              >
                {k} <Badge variant="secondary" className="ml-2">{counts[k]}</Badge>
              </Button>
            ))}
            <Input
              placeholder="Search name or email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-56 h-9"
            />
          </div>
        </div>
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Joined</TableHead><TableHead>Status</TableHead><TableHead>Role</TableHead></TableRow></TableHeader>
          <TableBody>
            {filtered.map((r) => (
              <TableRow key={r.profile_id}>
                <TableCell>{r.full_name ?? "User"}</TableCell>
                <TableCell className="text-muted-foreground">{r.email ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{formatActivityDate(r.created_at)}</TableCell>
                <TableCell><Badge variant="secondary">{r.status}</Badge></TableCell>
                <TableCell>
                  <Select value={r.role} onValueChange={(v) => update.mutate({ profileId: r.profile_id, memberId: r.member_id, role: v })}>
                    <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {builtin.map((b) => <SelectItem key={b.role} value={b.role}>{b.role.replace("_", " ")}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">No members yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// ============ ACTIVITY LOGS ============
export function ActivityLogsPage() {
  const { membership } = useWorkspace();
  const wsId = membership!.workspace.id;
  const { data } = useQuery({
    queryKey: ["activity-feed", wsId],
    queryFn: () => activityService.recent(wsId, 100),
  });
  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader title="Activity logs" description="A timeline of meaningful actions across your workspace." />
      <Card className="border-border shadow-none divide-y divide-border">
        {(data ?? []).map((a: any, i: number) => (
          <div key={i} className="p-4 flex items-start gap-3">
            <div className="h-8 w-8 rounded-md bg-primary-soft text-primary grid place-items-center text-xs font-semibold">
              <ScrollText className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <div className="text-sm">{a.title}</div>
              {a.subtitle && <div className="text-xs text-muted-foreground">{a.subtitle}</div>}
            </div>
            <div className="text-xs text-muted-foreground">{formatActivityDate(a.at ?? a.created_at ?? a.timestamp)}</div>
          </div>
        ))}
        {(data ?? []).length === 0 && (
          <div className="p-12 text-center text-muted-foreground">No activity yet.</div>
        )}
      </Card>
    </div>
  );
}
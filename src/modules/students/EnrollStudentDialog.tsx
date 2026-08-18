import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, addDays, addMonths, addYears } from "date-fns";
import { CalendarIcon, AlertTriangle, Loader2, Check, ChevronsUpDown, GraduationCap, Mail, IdCard, Building2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  workspaceId: string;
  defaultStudentId?: string;
  /** Optional: when true, dialog focuses on batch assignment first. */
  batchFirst?: boolean;
};

type ValidityKey = "lifetime" | "30d" | "90d" | "6m" | "1y" | "2y" | "3y" | "custom";
const VALIDITY_OPTIONS: { value: ValidityKey; label: string }[] = [
  { value: "lifetime", label: "Lifetime" },
  { value: "30d", label: "30 Days" },
  { value: "90d", label: "90 Days" },
  { value: "6m", label: "6 Months" },
  { value: "1y", label: "1 Year" },
  { value: "2y", label: "2 Years" },
  { value: "3y", label: "3 Years" },
  { value: "custom", label: "Custom Expiry Date" },
];

function computeExpiry(v: ValidityKey, from: Date, custom?: Date): Date | null {
  switch (v) {
    case "lifetime": return null;
    case "30d": return addDays(from, 30);
    case "90d": return addDays(from, 90);
    case "6m": return addMonths(from, 6);
    case "1y": return addYears(from, 1);
    case "2y": return addYears(from, 2);
    case "3y": return addYears(from, 3);
    case "custom": return custom ?? null;
  }
}

type ProductRow = {
  key: string;          // course:<id> | bundle:<id>
  kind: "course" | "bundle";
  id: string;
  name: string;
  alreadyAssigned: boolean;
};

export default function EnrollStudentDialog({ open, onOpenChange, workspaceId, defaultStudentId, batchFirst }: Props) {
  const qc = useQueryClient();
  const studentId = defaultStudentId ?? "";

  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [validity, setValidity] = useState<ValidityKey>("1y");
  const [enrollDate] = useState<Date>(new Date());
  const [customExpiry, setCustomExpiry] = useState<Date | undefined>();
  const [batchId, setBatchId] = useState<string>("");
  const [batchPickerOpen, setBatchPickerOpen] = useState(false);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [confirmStep, setConfirmStep] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setSelectedKeys(new Set());
      setValidity("1y");
      setCustomExpiry(undefined);
      setBatchId("");
      setConfirmStep(false);
      setSaving(false);
    }
  }, [open]);

  /* ---------- Read-only student summary ---------- */
  const { data: student, isLoading: loadingStudent, isError: studentError, error: studentErrObj } = useQuery({
    queryKey: ["enroll-dialog-student-summary", studentId, workspaceId],
    enabled: open && !!studentId,
    retry: 1,
    queryFn: async () => {
      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone, avatar_url")
        .eq("id", studentId).maybeSingle();
      if (profileErr) throw profileErr;
      const { data: sp } = await supabase
        .from("student_profiles")
        .select("registration_number, institution_id, institutions:institution_id(id, name)")
        .eq("user_id", studentId).maybeSingle();
      const { data: bs } = await supabase
        .from("batch_students" as any)
        .select("batches:batch_id(id, name, code)")
        .eq("student_id", studentId);
      return {
        profile,
        registration_no: (sp as any)?.registration_number ?? null,
        institution: (sp as any)?.institutions ?? null,
        batches: ((bs ?? []) as any[]).map((b) => b.batches).filter(Boolean),
      };
    },
  });

  /* ---------- Existing enrollments (to mark already-assigned) ---------- */
  const { data: assigned } = useQuery({
    queryKey: ["enroll-dialog-assigned", studentId],
    enabled: open && !!studentId,
    queryFn: async () => {
      const [c, b] = await Promise.all([
        supabase.from("enrollments").select("course_id").eq("student_id", studentId),
        supabase.from("student_bundles" as any).select("bundle_id, status").eq("student_id", studentId).eq("status", "active"),
      ]);
      return {
        courseIds: new Set((c.data ?? []).map((r: any) => r.course_id)),
        bundleIds: new Set(((b.data ?? []) as any[]).map((r: any) => r.bundle_id)),
      };
    },
  });

  /* ---------- Published products ---------- */
  const { data: products } = useQuery({
    queryKey: ["enroll-dialog-products", workspaceId],
    enabled: open,
    queryFn: async () => {
      const [c, b] = await Promise.all([
        supabase.from("courses").select("id, title").eq("workspace_id", workspaceId).eq("status", "published").is("deleted_at", null).order("title"),
        supabase.from("course_bundles").select("id, name").eq("workspace_id", workspaceId).eq("status", "published").order("name"),
      ]);
      return {
        courses: (c.data ?? []) as { id: string; title: string }[],
        bundles: (b.data ?? []) as { id: string; name: string }[],
      };
    },
  });

  /* ---------- Batches ---------- */
  const { data: batches } = useQuery({
    queryKey: ["enroll-dialog-batches", workspaceId],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from("batches" as any)
        .select("id, name, code, status")
        .eq("workspace_id", workspaceId)
        .eq("status", "active")
        .order("name");
      return (data ?? []) as any[];
    },
  });

  const productRows = useMemo<ProductRow[]>(() => {
    if (!products) return [];
    const rows: ProductRow[] = [];
    products.courses.forEach((c) =>
      rows.push({
        key: `course:${c.id}`,
        kind: "course",
        id: c.id,
        name: c.title,
        alreadyAssigned: assigned?.courseIds.has(c.id) ?? false,
      })
    );
    products.bundles.forEach((b) =>
      rows.push({
        key: `bundle:${b.id}`,
        kind: "bundle",
        id: b.id,
        name: b.name,
        alreadyAssigned: assigned?.bundleIds.has(b.id) ?? false,
      })
    );
    return rows;
  }, [products, assigned]);

  const selectedRows = useMemo(
    () => productRows.filter((r) => selectedKeys.has(r.key)),
    [productRows, selectedKeys]
  );

  const expiry = useMemo(
    () => computeExpiry(validity, enrollDate, customExpiry),
    [validity, enrollDate, customExpiry]
  );

  const selectedBatch = useMemo(
    () => (batches ?? []).find((b: any) => b.id === batchId) ?? null,
    [batches, batchId]
  );

  const toggleKey = (k: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });
  };

  const canContinue =
    !!studentId &&
    (selectedRows.length > 0 || !!batchId) &&
    (validity !== "custom" || !!customExpiry);

  /* ---------- Smart save ---------- */
  const handleAssign = async () => {
    setSaving(true);
    const expIso = expiry ? expiry.toISOString() : null;
    let success = 0;
    let skipped = 0;
    const errors: string[] = [];
    try {

    // 1) Explicit product selections
    for (const row of selectedRows) {
      try {
        if (row.kind === "course") {
          const { error } = await supabase.rpc("admin_enroll_student_in_course", {
            _student_id: studentId,
            _course_id: row.id,
            _validity_type: validity,
            _expires_at: expIso,
            _source: "admin_assigned",
            _notes: null,
          });
          if (error) {
            if (/already enrolled/i.test(error.message)) skipped++;
            else errors.push(`${row.name}: ${error.message}`);
          } else success++;
        } else {
          const { error } = await supabase.rpc("admin_enroll_student_in_bundle", {
            _student_id: studentId,
            _bundle_id: row.id,
            _validity_type: validity,
            _expires_at: expIso,
            _source: "admin_assigned",
            _notes: null,
          });
          if (error) {
            if (/already enrolled/i.test(error.message)) skipped++;
            else errors.push(`${row.name}: ${error.message}`);
          } else success++;
        }
      } catch (e: any) {
        errors.push(`${row.name}: ${e.message ?? e}`);
      }
    }

    // 2) Optional batch assignment + auto enroll into batch's courses
    if (batchId) {
      try {
        const { error: batchErr } = await supabase
          .from("batch_students" as any)
          .insert({ batch_id: batchId, student_id: studentId } as any);
        if (batchErr && !/duplicate|unique/i.test(batchErr.message)) {
          errors.push(`Batch: ${batchErr.message}`);
        }
        const { data: bc } = await supabase
          .from("batch_courses" as any)
          .select("course_id")
          .eq("batch_id", batchId);
        for (const row of ((bc ?? []) as any[])) {
          const { error } = await supabase.rpc("admin_enroll_student_in_course", {
            _student_id: studentId,
            _course_id: row.course_id,
            _validity_type: validity,
            _expires_at: expIso,
            _source: "batch",
            _notes: `Auto-enrolled via batch ${selectedBatch?.name ?? ""}`.trim(),
          });
          if (error) {
            if (/already enrolled/i.test(error.message)) skipped++;
            else errors.push(`Batch course: ${error.message}`);
          } else success++;
        }
      } catch (e: any) {
        errors.push(`Batch: ${e.message ?? e}`);
      }
    }

    } catch (e: any) {
      errors.push(e?.message ?? "Unexpected error while enrolling");
    } finally {
      // The spinner must always stop, whatever happened above.
      setSaving(false);
    }

    qc.invalidateQueries({ queryKey: ["students"] });
    qc.invalidateQueries({ queryKey: ["student-detail"] });
    qc.invalidateQueries({ queryKey: ["enrollments"] });
    qc.invalidateQueries({ queryKey: ["enroll-dialog-assigned", studentId] });

    if (errors.length === 0 && success + skipped > 0) {
      toast({
        title: success > 0
          ? `Enrolled in ${success} item${success === 1 ? "" : "s"}`
          : "Nothing to enroll",
        description: skipped > 0
          ? `${skipped} item${skipped === 1 ? " was" : "s were"} skipped because the student is already enrolled.`
          : undefined,
      });
      onOpenChange(false);
    } else if (errors.length === 0) {
      toast({ title: "Nothing was selected to enroll", variant: "destructive" });
    } else {
      toast({
        title: `Enrollment finished with errors (${success} enrolled, ${skipped} skipped, ${errors.length} failed)`,
        description: errors.slice(0, 3).join(" • "),
        variant: "destructive",
      });
    }
  };

  /* ---------- Render ---------- */
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{confirmStep ? "Confirm enrollment" : "Enroll Student"}</DialogTitle>
          <DialogDescription>
            {confirmStep
              ? "Review the details below before saving."
              : "Enrol this student into one or more published courses, bundles, and an optional batch."}
          </DialogDescription>
        </DialogHeader>

        {/* Student summary (read-only) */}
        <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
          {loadingStudent ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading student…
            </div>
          ) : studentError || !student?.profile ? (
            <div className="flex items-start gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                {studentError
                  ? `Could not load this student: ${(studentErrObj as any)?.message ?? "permission denied"}`
                  : "This student profile is not visible to your account. Ask an administrator to check access."}
              </span>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex items-center gap-2 font-semibold">
                <GraduationCap className="h-4 w-4 text-primary" />
                {student.profile.full_name ?? "Unnamed student"}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {student.profile.email && (
                  <span className="flex items-center gap-1.5"><Mail className="h-3 w-3" />{student.profile.email}</span>
                )}
                {student.registration_no && (
                  <span className="flex items-center gap-1.5"><IdCard className="h-3 w-3" />Reg: {student.registration_no}</span>
                )}
                {student.institution?.name && (
                  <span className="flex items-center gap-1.5"><Building2 className="h-3 w-3" />{student.institution.name}</span>
                )}
                {student.batches.length > 0 && (
                  <span className="flex items-center gap-1.5"><Users className="h-3 w-3" />Batch: {student.batches.map((b: any) => b.name).join(", ")}</span>
                )}
              </div>
            </div>
          )}
        </div>

        {!confirmStep ? (
          <div className="space-y-4">
            {/* Product multi-select */}
            <div className="space-y-1.5">
              <Label>Courses & bundles <span className="text-destructive">*</span></Label>
              <Popover open={productPickerOpen} onOpenChange={setProductPickerOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between font-normal h-auto min-h-10 py-2">
                    {selectedRows.length === 0 ? (
                      <span className="text-muted-foreground">Search and select courses, bundles…</span>
                    ) : (
                      <div className="flex flex-wrap gap-1 items-center">
                        {selectedRows.slice(0, 4).map((r) => (
                          <Badge key={r.key} variant="secondary" className="font-normal">
                            <span className="text-[10px] mr-1 opacity-70">{r.kind === "course" ? "C" : "B"}</span>
                            {r.name}
                          </Badge>
                        ))}
                        {selectedRows.length > 4 && (
                          <Badge variant="outline" className="font-normal">+{selectedRows.length - 4} more</Badge>
                        )}
                      </div>
                    )}
                    <ChevronsUpDown className="h-4 w-4 opacity-50 ml-2 shrink-0" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0 bg-popover" align="start">
                  <Command>
                    <CommandInput placeholder="Search courses or bundles…" />
                    <CommandList className="max-h-72">
                      <CommandEmpty>No published items found.</CommandEmpty>
                      <CommandGroup heading="Courses">
                        {productRows.filter((r) => r.kind === "course").map((r) => (
                          <CommandItem
                            key={r.key}
                            value={`course ${r.name}`}
                            disabled={r.alreadyAssigned}
                            onSelect={() => !r.alreadyAssigned && toggleKey(r.key)}
                            className={cn(r.alreadyAssigned && "opacity-60 cursor-not-allowed")}
                          >
                            <Check className={cn("mr-2 h-4 w-4", selectedKeys.has(r.key) ? "opacity-100" : "opacity-0")} />
                            <span className="flex-1 truncate">{r.name}</span>
                            {r.alreadyAssigned && <Badge variant="outline" className="text-[10px] ml-2">Already Assigned</Badge>}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                      <CommandGroup heading="Bundles">
                        {productRows.filter((r) => r.kind === "bundle").map((r) => (
                          <CommandItem
                            key={r.key}
                            value={`bundle ${r.name}`}
                            disabled={r.alreadyAssigned}
                            onSelect={() => !r.alreadyAssigned && toggleKey(r.key)}
                            className={cn(r.alreadyAssigned && "opacity-60 cursor-not-allowed")}
                          >
                            <Check className={cn("mr-2 h-4 w-4", selectedKeys.has(r.key) ? "opacity-100" : "opacity-0")} />
                            <span className="flex-1 truncate">{r.name}</span>
                            {r.alreadyAssigned && <Badge variant="outline" className="text-[10px] ml-2">Already Assigned</Badge>}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground">Items the student is already enrolled in are disabled to prevent duplicates.</p>
            </div>

            {/* Validity */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Validity</Label>
                <Select value={validity} onValueChange={(v) => setValidity(v as ValidityKey)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {VALIDITY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Expiry Date</Label>
                {validity === "custom" ? (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start font-normal", !customExpiry && "text-muted-foreground")}>
                        <CalendarIcon className="h-4 w-4 mr-2" />
                        {customExpiry ? format(customExpiry, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-popover" align="start">
                      <Calendar mode="single" selected={customExpiry} onSelect={setCustomExpiry} initialFocus className="pointer-events-auto" disabled={(d) => d <= new Date()} />
                    </PopoverContent>
                  </Popover>
                ) : (
                  <Input value={expiry ? format(expiry, "PPP") : "Lifetime access"} disabled />
                )}
              </div>
            </div>

            {/* Batch (optional) */}
            <div className="space-y-1.5">
              <Label>Batch <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Popover open={batchPickerOpen} onOpenChange={setBatchPickerOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                    {selectedBatch ? (
                      <span className="flex items-center gap-2 truncate">
                        <Badge variant="secondary" className="text-[10px]">Batch</Badge>
                        {selectedBatch.name}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Optionally assign student to a batch…</span>
                    )}
                    <ChevronsUpDown className="h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0 bg-popover" align="start">
                  <Command>
                    <CommandInput placeholder="Search active batches…" />
                    <CommandList>
                      <CommandEmpty>No active batches found.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem value="__none__" onSelect={() => { setBatchId(""); setBatchPickerOpen(false); }}>
                          <Check className={cn("mr-2 h-4 w-4", !batchId ? "opacity-100" : "opacity-0")} />
                          <span className="text-muted-foreground">No batch</span>
                        </CommandItem>
                        {(batches ?? []).map((b: any) => (
                          <CommandItem
                            key={b.id}
                            value={`${b.name} ${b.code ?? ""}`}
                            onSelect={() => { setBatchId(b.id); setBatchPickerOpen(false); }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", batchId === b.id ? "opacity-100" : "opacity-0")} />
                            <div className="flex flex-col">
                              <span className="font-medium">{b.name}</span>
                              {b.code && <span className="text-xs text-muted-foreground">{b.code}</span>}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {selectedBatch && (
                <p className="text-xs text-muted-foreground">Student will be added to the batch and auto-enrolled in all of its courses (duplicates skipped).</p>
              )}
            </div>

            <div className="text-xs text-muted-foreground">
              <AlertTriangle className="h-3 w-3 inline mr-1" />
              Enrollment Source: <span className="font-medium text-foreground">Manual Assignment (Admin)</span>
            </div>
          </div>
        ) : (
          /* ---------- Confirmation panel ---------- */
          <div className="space-y-3 rounded-md border border-border p-3 text-sm">
            <Row label="Student" value={student?.profile?.full_name ?? "—"} />
            <div>
              <div className="text-muted-foreground text-xs mb-1">Products ({selectedRows.length})</div>
              {selectedRows.length === 0 ? (
                <div className="text-xs text-muted-foreground italic">No direct products — batch courses only</div>
              ) : (
                <ScrollArea className="max-h-32">
                  <ul className="list-disc pl-4 space-y-0.5">
                    {selectedRows.map((r) => (
                      <li key={r.key}>
                        <span className="text-[10px] uppercase text-muted-foreground mr-1">{r.kind}</span>
                        {r.name}
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              )}
            </div>
            <Row label="Validity" value={VALIDITY_OPTIONS.find((v) => v.value === validity)?.label ?? "—"} />
            <Row label="Expiry" value={expiry ? format(expiry, "PPP") : "Lifetime"} />
            <Row label="Batch" value={selectedBatch ? `${selectedBatch.name} (auto-enrolls batch courses)` : "—"} />
            <Row label="Source" value="Manual Assignment (Admin)" />
          </div>
        )}

        <DialogFooter>
          {!confirmStep ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={() => setConfirmStep(true)} disabled={!canContinue}>
                Review & Continue
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setConfirmStep(false)} disabled={saving}>Back</Button>
              <Button onClick={handleAssign} disabled={saving}>
                {saving ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enrolling…</>) : "Enroll Student"}
              </Button>
            </>
          )}
        </DialogFooter>

        {/* hidden field — kept for future use */}
        {batchFirst && <input type="hidden" data-batch-first="1" />}
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right truncate max-w-[60%]">{value}</span>
    </div>
  );
}
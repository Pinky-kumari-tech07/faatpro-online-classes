import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { Loader2, Pencil, Plus, Search, Trash2, ExternalLink, AlertTriangle } from "lucide-react";
import PageHeader from "@/modules/shared/PageHeader";
import { useWorkspace } from "@/shared/hooks/useWorkspace";
import { batchService, VALIDITY_OPTIONS, computeBatchEndDate, type Batch, type BatchInput } from "@/services/supabase";
import { validateBatch } from "@/lib/validators";
import { mapDbError } from "@/lib/errorMapper";
import { Link } from "react-router-dom";

const EMPTY: BatchInput = {
  name: "",
  description: "",
  duration_type: "year_1",
  validity_type: "year_1",
  status: "active",
  start_date: null,
  end_date: null,
  coordinator_id: null,
  coordinator_name: "",
  coordinator_email: "",
  coordinator_phone: "",
};

export default function BatchManagementPage() {
  const { membership } = useWorkspace();
  const wsId = membership?.workspace.id ?? null;
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<BatchInput>(EMPTY);
  const [editing, setEditing] = useState<Batch | null>(null);
  const [confirmDel, setConfirmDel] = useState<Batch | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data = [], isLoading } = useQuery({
    enabled: !!wsId,
    queryKey: ["batches", wsId],
    queryFn: () => batchService.list(wsId!),
  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return data;
    return data.filter((b: Batch) =>
      b.name.toLowerCase().includes(s) || b.code?.toLowerCase().includes(s),
    );
  }, [data, search]);

  const createMut = useMutation({
    mutationFn: (i: BatchInput) => batchService.create(wsId!, i),
    onSuccess: () => {
      toast({ title: "Batch created" });
      setOpen(false); setForm(EMPTY); setEditing(null);
      qc.invalidateQueries({ queryKey: ["batches", wsId] });
    },
    onError: (e: any) => toast({ title: "Failed", description: mapDbError(e), variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: (i: BatchInput) => batchService.update(editing!.id, i),
    onSuccess: () => {
      toast({ title: "Batch updated" });
      setOpen(false); setForm(EMPTY); setEditing(null);
      qc.invalidateQueries({ queryKey: ["batches", wsId] });
    },
    onError: (e: any) => toast({ title: "Failed", description: mapDbError(e), variant: "destructive" }),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => batchService.remove(id),
    onSuccess: () => {
      toast({ title: "Batch deleted" });
      setConfirmDel(null);
      qc.invalidateQueries({ queryKey: ["batches", wsId] });
    },
    onError: (e: any) => toast({ title: "Failed", description: mapDbError(e), variant: "destructive" }),
  });

  const startEdit = (b: Batch) => {
    setEditing(b);
    setForm({
      name: b.name,
      code: b.code,
      description: b.description ?? "",
      coordinator_id: b.coordinator_id,
      coordinator_name: b.coordinator_name ?? "",
      coordinator_email: b.coordinator_email ?? "",
      coordinator_phone: b.coordinator_phone ?? "",
      start_date: b.start_date,
      end_date: b.end_date,
      duration_type: (b.duration_type ?? b.validity_type ?? "year_1") as any,
      validity_type: (b.duration_type ?? b.validity_type ?? "year_1") as any,
      status: b.status,
    });
    setOpen(true);
  };

  const submit = () => {
    const found = validateBatch(form as any);
    setErrors(found);
    const first = Object.values(found)[0];
    if (first) {
      toast({ title: "Please fix the highlighted fields", description: first, variant: "destructive" });
      return;
    }
    const payload: BatchInput = { ...form };
    if (form.duration_type !== "custom") {
      payload.end_date = computeBatchEndDate(form.start_date!, form.duration_type);
    }
    // Mirror duration_type into legacy validity_type column for backwards compatibility.
    payload.validity_type = form.duration_type;
    payload.coordinator_id = null; // free-text coordinator only
    editing ? updateMut.mutate(payload) : createMut.mutate(payload);
  };

  const previewEnd = useMemo(() => {
    if (!form.start_date || !form.duration_type) return null;
    if (form.duration_type === "custom") return form.end_date ?? null;
    return computeBatchEndDate(form.start_date, form.duration_type);
  }, [form.start_date, form.duration_type, form.end_date]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Batch Management"
        description="Group students into batches with assigned courses, coordinators, and validity periods."
        actions={
          <Button onClick={() => { setEditing(null); setForm(EMPTY); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" /> New Batch
          </Button>
        }
      />

      <Card className="p-4 space-y-4">
        <div className="relative max-w-sm">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search batches…" className="pl-9" />
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Coordinator</TableHead>
                <TableHead>Validity</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="py-10 text-center">
                  <Loader2 className="h-5 w-5 animate-spin inline" />
                </TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                  No batches yet. Create one to get started.
                </TableCell></TableRow>
              ) : (
                filtered.map((b: Batch) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-mono text-xs">{b.code}</TableCell>
                    <TableCell className="font-medium">{b.name}</TableCell>
                    <TableCell>
                      {b.coordinator_name ? (
                        <div className="text-sm">
                          <div className="font-medium">{b.coordinator_name}</div>
                          {b.coordinator_email && <div className="text-[11px] text-muted-foreground">{b.coordinator_email}</div>}
                        </div>
                      ) : (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" /> Coordinator Missing
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {VALIDITY_OPTIONS.find((v) => v.value === (b.duration_type ?? b.validity_type))?.label ?? (b.duration_type ?? b.validity_type)}
                    </TableCell>
                    <TableCell>{b.start_date ?? "—"}</TableCell>
                    <TableCell>{b.end_date ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={b.status === "active" ? "default" : "secondary"}>{b.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex gap-1">
                        <Button asChild size="sm" variant="ghost">
                          <Link to={`/app/batches/${b.id}`}><ExternalLink className="h-4 w-4" /></Link>
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => startEdit(b)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirmDel(b)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Batch" : "New Batch"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto pr-1">
            <div className="space-y-2 md:col-span-2">
              <Label>Batch Name *</Label>
              <Input value={form.name} aria-invalid={!!errors.name}
                onChange={(e) => { setErrors((p) => ({ ...p, name: "" })); setForm({ ...form, name: e.target.value }); }} />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>
            <div className="space-y-2">
              <Label>Batch Code</Label>
              <Input value={form.code ?? ""} onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="Auto-generated if blank" />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Description</Label>
              <Textarea value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Batch Coordinator *</Label>
              <Input
                value={form.coordinator_name ?? ""}
                aria-invalid={!!errors.coordinator_name}
                onChange={(e) => { setErrors((p) => ({ ...p, coordinator_name: "" })); setForm({ ...form, coordinator_name: e.target.value }); }}
                placeholder="e.g. Prakash Mohanty"
              />
              {errors.coordinator_name && <p className="text-xs text-destructive">{errors.coordinator_name}</p>}
              <p className="text-xs text-muted-foreground">
                Free-text name of the broker, consultant, university rep, corporate SPOC, or relationship manager.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Coordinator Mobile</Label>
              <Input
                value={form.coordinator_phone ?? ""}
                aria-invalid={!!errors.coordinator_phone}
                onChange={(e) => { setErrors((p) => ({ ...p, coordinator_phone: "" })); setForm({ ...form, coordinator_phone: e.target.value }); }}
                placeholder="Optional"
              />
              {errors.coordinator_phone && <p className="text-xs text-destructive">{errors.coordinator_phone}</p>}
            </div>
            <div className="space-y-2">
              <Label>Coordinator Email</Label>
              <Input
                type="email"
                value={form.coordinator_email ?? ""}
                aria-invalid={!!errors.coordinator_email}
                onChange={(e) => { setErrors((p) => ({ ...p, coordinator_email: "" })); setForm({ ...form, coordinator_email: e.target.value }); }}
                placeholder="Optional"
              />
              {errors.coordinator_email && <p className="text-xs text-destructive">{errors.coordinator_email}</p>}
            </div>
            <div className="space-y-2">
              <Label>Start Date *</Label>
              <Input
                type="date"
                value={form.start_date ?? ""}
                aria-invalid={!!errors.start_date}
                onChange={(e) => { setErrors((p) => ({ ...p, start_date: "", end_date: "" })); setForm({ ...form, start_date: e.target.value || null }); }}
              />
              {errors.start_date && <p className="text-xs text-destructive">{errors.start_date}</p>}
            </div>
            <div className="space-y-2">
              <Label>Batch Duration *</Label>
              <Select
                value={form.duration_type}
                onValueChange={(v: any) => setForm({ ...form, duration_type: v, validity_type: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VALIDITY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>End Date {form.duration_type === "custom" ? "*" : "(auto-calculated)"}</Label>
              <Input
                type="date"
                value={form.duration_type === "custom" ? (form.end_date ?? "") : (previewEnd ?? "")}
                aria-invalid={!!errors.end_date}
                onChange={(e) => { setErrors((p) => ({ ...p, end_date: "" })); setForm({ ...form, end_date: e.target.value || null }); }}
                disabled={form.duration_type !== "custom"}
              />
              {errors.end_date && <p className="text-xs text-destructive">{errors.end_date}</p>}
              {form.duration_type !== "custom" && previewEnd && (
                <p className="text-xs text-muted-foreground">
                  Calculated from Start Date + {VALIDITY_OPTIONS.find((o) => o.value === form.duration_type)?.label}.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={createMut.isPending || updateMut.isPending}>
              {editing ? "Save Changes" : "Create Batch"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete batch?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the batch and all its student/course associations. Existing enrollments stay intact.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDel && delMut.mutate(confirmDel.id)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
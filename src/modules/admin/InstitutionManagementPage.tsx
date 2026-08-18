import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import PageHeader from "@/modules/shared/PageHeader";
import { useWorkspace } from "@/shared/hooks/useWorkspace";
import {
  institutionService,
  INSTITUTION_TYPES,
  type Institution,
  type InstitutionInput,
} from "@/services/supabase";

const EMPTY: InstitutionInput = {
  name: "",
  code: "",
  type: "College",
  city: "",
  state: "Odisha",
  country: "India",
  is_active: true,
};

export default function InstitutionManagementPage() {
  const { membership } = useWorkspace();
  const wsId = membership?.workspace.id ?? null;
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<InstitutionInput>(EMPTY);
  const [editing, setEditing] = useState<Institution | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Institution | null>(null);

  const { data = [], isLoading } = useQuery({
    enabled: !!wsId,
    queryKey: ["institutions", wsId],
    queryFn: () => institutionService.list(wsId!),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter((r) =>
      [r.name, r.code, r.type, r.city, r.state, r.country]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [data, search]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["institutions", wsId] });
    qc.invalidateQueries({ queryKey: ["active-institutions"] });
  };

  const create = useMutation({
    mutationFn: () => institutionService.create(wsId!, form),
    onSuccess: () => {
      toast({ title: "Institution added" });
      setOpen(false);
      invalidate();
    },
    onError: (e: any) =>
      toast({ title: "Could not add", description: e?.message, variant: "destructive" }),
  });

  const update = useMutation({
    mutationFn: () => institutionService.update(editing!.id, wsId!, form),
    onSuccess: () => {
      toast({ title: "Institution updated" });
      setOpen(false);
      invalidate();
    },
    onError: (e: any) =>
      toast({ title: "Could not save", description: e?.message, variant: "destructive" }),
  });

  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      institutionService.setActive(id, active),
    onSuccess: () => invalidate(),
    onError: (e: any) =>
      toast({ title: "Update failed", description: e?.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => institutionService.remove(id),
    onSuccess: () => {
      toast({ title: "Institution deleted" });
      setConfirmDelete(null);
      invalidate();
    },
    onError: (e: any) =>
      toast({ title: "Delete failed", description: e?.message, variant: "destructive" }),
  });

  function openAdd() {
    setEditing(null);
    setForm(EMPTY);
    setOpen(true);
  }

  function openEdit(row: Institution) {
    setEditing(row);
    setForm({
      name: row.name,
      code: row.code || "",
      type: row.type || "College",
      city: row.city || "",
      state: row.state || "",
      country: row.country || "India",
      is_active: row.is_active,
    });
    setOpen(true);
  }

  function submit() {
    if (!form.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    if (editing) update.mutate();
    else create.mutate();
  }

  if (!wsId) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Institution Management"
        description="Manage colleges, universities and other institutions used across the platform."
        actions={
          <Button onClick={openAdd} className="rounded-full gap-2">
            <Plus className="h-4 w-4" /> Add Institution
          </Button>
        }
      />

      <Card className="p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, code, city, state..."
              className="pl-9"
            />
          </div>
          <div className="text-xs text-muted-foreground">
            {filtered.length} of {data.length} institutions
          </div>
        </div>

        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>City</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10">
                    <Loader2 className="h-5 w-5 animate-spin inline" />
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                    No institutions yet. Click "Add Institution" to create one.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-xs">{row.code || "—"}</TableCell>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>{row.type || "—"}</TableCell>
                    <TableCell>{row.city || "—"}</TableCell>
                    <TableCell>{row.state || "—"}</TableCell>
                    <TableCell>{row.country || "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={row.is_active}
                          onCheckedChange={(v) =>
                            toggle.mutate({ id: row.id, active: v })
                          }
                        />
                        <Badge
                          variant={row.is_active ? "default" : "secondary"}
                          className={row.is_active ? "bg-emerald-600 hover:bg-emerald-600" : ""}
                        >
                          {row.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(row)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setConfirmDelete(row)}
                        >
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
            <DialogTitle>{editing ? "Edit Institution" : "Add Institution"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2 sm:col-span-2">
              <Label>Institution Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. KIIT University"
              />
            </div>
            <div className="space-y-2">
              <Label>Institution Code</Label>
              <Input
                value={form.code || ""}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="Auto-generated if blank"
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={form.type || "College"}
                onValueChange={(v) => setForm({ ...form, type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INSTITUTION_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>City</Label>
              <Input
                value={form.city || ""}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>State</Label>
              <Input
                value={form.state || ""}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Country</Label>
              <Input
                value={form.country || ""}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-3 sm:col-span-2 pt-2">
              <Switch
                checked={form.is_active ?? true}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
              />
              <Label className="!m-0">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={submit}
              disabled={create.isPending || update.isPending}
            >
              {(create.isPending || update.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editing ? "Save changes" : "Add institution"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete institution?</AlertDialogTitle>
            <AlertDialogDescription>
              "{confirmDelete?.name}" will be removed. Students currently
              referencing it will keep their saved name but lose the link.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && remove.mutate(confirmDelete.id)}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
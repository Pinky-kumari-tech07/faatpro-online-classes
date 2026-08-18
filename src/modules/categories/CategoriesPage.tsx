import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Search, Upload, X, ChevronRight, ChevronDown, FolderTree, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useWorkspace } from "@/shared/hooks/useWorkspace";
import { categoryService, type CourseCategory } from "@/services/supabase/categoryService";
import { toast } from "@/components/ui/use-toast";
import { collectErrors, validateCategoryName, validateSlug } from "@/lib/validators";
import { mapDbError } from "@/lib/errorMapper";

const EMPTY: Partial<CourseCategory> = {
  name: "", slug: "", icon: "", description: "",
  status: "active", is_trending: false, sort_order: 0, course_count: null, parent_id: null,
};

const TRENDING_MAX = 8;

export default function CategoriesPage() {
  const { membership } = useWorkspace();
  const workspaceId = membership?.workspace.id;
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [trendingFilter, setTrendingFilter] = useState<"all" | "trending" | "not_trending">("all");
  const [editing, setEditing] = useState<Partial<CourseCategory> | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<CourseCategory | null>(null);
  const [uploading, setUploading] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleIconUpload(file: File) {
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${workspaceId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("category-icons").upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("category-icons").getPublicUrl(path);
      setEditing((prev) => (prev ? { ...prev, icon: data.publicUrl } : prev));
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["course-categories", workspaceId, search, statusFilter, trendingFilter],
    queryFn: () => categoryService.listCategories(workspaceId!, { search, status: statusFilter, trending: trendingFilter }),
    enabled: !!workspaceId,
  });

  const saveMut = useMutation({
    mutationFn: async (payload: Partial<CourseCategory>) => {
      const errors = collectErrors([
        ["name", validateCategoryName(payload.name)],
        ["slug", validateSlug(payload.slug)],
      ]);
      setFormErrors(errors);
      const first = Object.values(errors)[0];
      if (first) throw new Error(first);
      if (payload.id) return categoryService.updateCategory(payload.id, payload);
      return categoryService.createCategory(workspaceId!, payload);
    },
    onSuccess: () => {
      setFormErrors({});
      qc.invalidateQueries({ queryKey: ["course-categories"] });
      qc.invalidateQueries({ queryKey: ["public-trending-categories"] });
      toast({ title: "Saved", description: "Category saved successfully." });
      setEditing(null);
    },
    onError: (e: any) => toast({ title: "Could not save", description: mapDbError(e), variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => categoryService.deleteCategory(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["course-categories"] });
      qc.invalidateQueries({ queryKey: ["public-trending-categories"] });
      toast({ title: "Deleted" });
      setConfirmDelete(null);
    },
  });

  const updateSort = useMutation({
    mutationFn: ({ id, sort_order }: { id: string; sort_order: number }) =>
      categoryService.updateCategory(id, { sort_order }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["course-categories"] }),
  });

  const toggleTrending = useMutation({
    mutationFn: ({ id, is_trending }: { id: string; is_trending: boolean }) => {
      if (is_trending) {
        const currentTrending = categories.filter((c) => c.is_trending && c.id !== id).length;
        if (currentTrending >= TRENDING_MAX) {
          throw new Error(`You can feature at most ${TRENDING_MAX} trending categories.`);
        }
      }
      return categoryService.updateCategory(id, { is_trending });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["course-categories"] });
      qc.invalidateQueries({ queryKey: ["public-trending-categories"] });
    },
    onError: (e: any) => toast({ title: "Cannot update trending", description: e.message, variant: "destructive" }),
  });

  const filtered = useMemo(() => categories, [categories]);

  // Build hierarchical tree (parents with their children)
  const parents = useMemo(
    () => filtered.filter((c) => !c.parent_id),
    [filtered],
  );
  const childrenByParent = useMemo(() => {
    const map = new Map<string, CourseCategory[]>();
    filtered.forEach((c) => {
      if (c.parent_id) {
        const arr = map.get(c.parent_id) ?? [];
        arr.push(c);
        map.set(c.parent_id, arr);
      }
    });
    return map;
  }, [filtered]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggleExpand = (id: string) => setExpanded((e) => ({ ...e, [id]: !e[id] }));

  const renderRow = (c: CourseCategory, depth = 0) => {
    const kids = childrenByParent.get(c.id) ?? [];
    const isOpen = expanded[c.id] ?? true;
    return (
      <>
        <TableRow key={c.id}>
          <TableCell>
            <div className="flex items-center gap-2" style={{ paddingLeft: depth * 20 }}>
              {kids.length > 0 ? (
                <button onClick={() => toggleExpand(c.id)} className="text-muted-foreground hover:text-foreground">
                  {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
              ) : (
                <span className="inline-block w-4" />
              )}
              <div className="h-9 w-9 rounded-lg bg-primary-soft text-primary grid place-items-center text-sm font-semibold overflow-hidden">
                {c.icon && /^https?:\/\//.test(c.icon) ? (
                  <img src={c.icon} alt={c.name} className="h-full w-full object-cover" />
                ) : c.icon ? (
                  <span className="text-base">{c.icon}</span>
                ) : depth === 0 ? (
                  <FolderTree className="h-4 w-4" />
                ) : (
                  c.name[0]?.toUpperCase()
                )}
              </div>
            </div>
          </TableCell>
          <TableCell className="font-medium">
            <span className={depth > 0 ? "text-muted-foreground" : ""}>{c.name}</span>
            {depth === 0 && kids.length > 0 && (
              <Badge variant="outline" className="ml-2 text-xs">{kids.length}</Badge>
            )}
          </TableCell>
          <TableCell className="text-muted-foreground text-xs">{c.slug}</TableCell>
          <TableCell>{c.course_count ?? "—"}</TableCell>
          <TableCell>
            <Switch checked={c.is_trending} onCheckedChange={(v) => toggleTrending.mutate({ id: c.id, is_trending: v })} />
          </TableCell>
          <TableCell>
            <Badge variant={c.status === "active" ? "default" : "secondary"}>{c.status}</Badge>
          </TableCell>
          <TableCell>
            <Input
              type="number"
              defaultValue={c.sort_order}
              onBlur={(e) => {
                const v = Number(e.target.value);
                if (v !== c.sort_order) updateSort.mutate({ id: c.id, sort_order: v });
              }}
              className="h-8 w-20"
            />
          </TableCell>
          <TableCell className="text-right">
            <Button variant="ghost" size="icon" title="Add subcategory"
              onClick={() => setEditing({ ...EMPTY, parent_id: c.id })}>
              <Plus className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setEditing(c)}><Pencil className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" onClick={() => setConfirmDelete(c)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </TableCell>
        </TableRow>
        {isOpen && kids.map((child) => renderRow(child, depth + 1))}
      </>
    );
  };

  // Allow ANY category to be a parent — supports unlimited nesting.
  // Exclude the category itself and its descendants to prevent cycles.
  const descendantIds = useMemo(() => {
    const out = new Set<string>();
    if (!editing?.id) return out;
    const walk = (id: string) => {
      const kids = childrenByParent.get(id) ?? [];
      kids.forEach((k) => {
        if (!out.has(k.id)) {
          out.add(k.id);
          walk(k.id);
        }
      });
    };
    walk(editing.id);
    return out;
  }, [editing?.id, childrenByParent]);

  const parentOptions = useMemo(() => {
    // Build a depth-ordered, hierarchical list (DFS) for tree-style display.
    const byParent = new Map<string | null, CourseCategory[]>();
    categories.forEach((c) => {
      const key = c.parent_id ?? null;
      const arr = byParent.get(key) ?? [];
      arr.push(c);
      byParent.set(key, arr);
    });
    byParent.forEach((arr) =>
      arr.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name)),
    );
    const out: Array<CourseCategory & { depth: number; path: string }> = [];
    const walk = (parentId: string | null, depth: number, prefix: string) => {
      const kids = byParent.get(parentId) ?? [];
      kids.forEach((c) => {
        if (c.id === editing?.id || descendantIds.has(c.id)) return;
        const path = prefix ? `${prefix} › ${c.name}` : c.name;
        out.push({ ...(c as any), depth, path });
        walk(c.id, depth + 1, path);
      });
    };
    walk(null, 0, "");
    return out;
  }, [categories, editing?.id, descendantIds]);

  const [parentPickerOpen, setParentPickerOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Course categories</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage the categories shown across courses and the public website.
          </p>
        </div>
        <Button onClick={() => setEditing({ ...EMPTY })}>
          <Plus className="h-4 w-4" /> New category
        </Button>
      </div>

      <Card className="p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search categories…" className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <Select value={trendingFilter} onValueChange={(v: any) => setTrendingFilter(v)}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="trending">Trending</SelectItem>
            <SelectItem value="not_trending">Not trending</SelectItem>
          </SelectContent>
        </Select>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Icon</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Courses</TableHead>
              <TableHead>Trending</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Order</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-10">Loading…</TableCell></TableRow>
            )}
            {!isLoading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-10">
                No categories yet. Click <span className="font-medium">New category</span> to create one.
              </TableCell></TableRow>
            )}
             {parents.map((p) => renderRow(p, 0))}
            {/* Orphans: children whose parent isn't present anywhere in the filtered list */}
            {filtered
              .filter((c) => c.parent_id && !filtered.some((p) => p.id === c.parent_id))
              .map((c) => renderRow(c, 0))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit category" : "New category"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="grid gap-4">
              <div className="grid gap-1.5">
                <Label>Name</Label>
                <Input
                  value={editing.name ?? ""}
                  aria-invalid={!!formErrors.name}
                  onChange={(e) => { setFormErrors((p) => ({ ...p, name: "" })); setEditing({ ...editing, name: e.target.value }); }}
                />
                {formErrors.name && <p className="text-xs text-destructive">{formErrors.name}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <Label>Slug (optional)</Label>
                  <Input value={editing.slug ?? ""} placeholder="auto-from-name" aria-invalid={!!formErrors.slug}
                    onChange={(e) => { setFormErrors((p) => ({ ...p, slug: "" })); setEditing({ ...editing, slug: e.target.value }); }} />
                  {formErrors.slug && <p className="text-xs text-destructive">{formErrors.slug}</p>}
                </div>
                <div className="grid gap-1.5">
                  <Label>Icon image</Label>
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-lg border border-border bg-muted grid place-items-center overflow-hidden shrink-0">
                      {editing.icon && /^https?:\/\//.test(editing.icon) ? (
                        <img src={editing.icon} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-xs text-muted-foreground">No image</span>
                      )}
                    </div>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleIconUpload(e.target.files[0])}
                    />
                    <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
                      <Upload className="h-4 w-4" /> {uploading ? "Uploading…" : "Upload"}
                    </Button>
                    {editing.icon && (
                      <Button type="button" variant="ghost" size="icon" onClick={() => setEditing({ ...editing, icon: "" })}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <Label>Status</Label>
                  <Select value={editing.status as any} onValueChange={(v) => setEditing({ ...editing, status: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Sort order</Label>
                  <Input type="number" value={editing.sort_order ?? 0} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label>
                  Parent category{" "}
                  <span className="text-muted-foreground font-normal">
                    ({parentOptions.length} available)
                  </span>
                </Label>
                <Popover open={parentPickerOpen} onOpenChange={setParentPickerOpen} modal>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={parentPickerOpen}
                      className="w-full justify-between font-normal"
                    >
                      <span className="truncate">
                        {editing.parent_id
                          ? parentOptions.find((p) => p.id === editing.parent_id)?.path ??
                            "Selected category"
                          : "None — top-level category"}
                      </span>
                      <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    sideOffset={4}
                    collisionPadding={16}
                    className="p-0 w-[--radix-popover-trigger-width] min-w-[320px] z-[60]"
                  >
                    <Command
                      filter={(value, search) => {
                        if (!search) return 1;
                        return value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
                      }}
                    >
                      <CommandInput placeholder="Search by name or slug…" />
                      <CommandList className="max-h-[min(500px,60vh)] overflow-y-auto overscroll-contain">
                        <CommandEmpty>No categories found.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="none top-level"
                            onSelect={() => {
                              setEditing({ ...editing, parent_id: null });
                              setParentPickerOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "h-4 w-4 mr-2",
                                !editing.parent_id ? "opacity-100" : "opacity-0",
                              )}
                            />
                            <span className="italic text-muted-foreground">
                              None — top-level category
                            </span>
                          </CommandItem>
                          {parentOptions.map((p) => (
                            <CommandItem
                              key={p.id}
                              value={`${p.path} ${p.slug ?? ""}`}
                              onSelect={() => {
                                setEditing({ ...editing, parent_id: p.id });
                                setParentPickerOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "h-4 w-4 mr-2 shrink-0",
                                  editing.parent_id === p.id ? "opacity-100" : "opacity-0",
                                )}
                              />
                              <span
                                className="flex items-center gap-1 truncate"
                                style={{ paddingLeft: p.depth * 16 }}
                              >
                                {p.depth > 0 && (
                                  <span className="text-muted-foreground/70 font-mono text-xs">
                                    └─
                                  </span>
                                )}
                                <span className={p.depth === 0 ? "font-medium" : ""}>{p.name}</span>
                                {p.slug && (
                                  <span className="text-xs text-muted-foreground ml-1">
                                    /{p.slug}
                                  </span>
                                )}
                              </span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <p className="text-xs text-muted-foreground">
                  Pick a parent to make this a subcategory. Search and scroll to find any
                  category.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <Label>Course count (optional)</Label>
                  <Input type="number" value={editing.course_count ?? ""} onChange={(e) => setEditing({ ...editing, course_count: e.target.value === "" ? null : Number(e.target.value) })} />
                </div>
                <div className="flex items-end gap-3">
                  <div className="flex items-center gap-2">
                    <Switch checked={!!editing.is_trending} onCheckedChange={(v) => setEditing({ ...editing, is_trending: v })} />
                    <Label>Featured / Trending</Label>
                  </div>
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label>Description (admin only, optional)</Label>
                <Textarea rows={3} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
                <p className="text-xs text-muted-foreground">Not shown on the public website.</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button
              disabled={!editing?.name || saveMut.isPending}
              onClick={() => editing && saveMut.mutate(editing)}
            >
              {saveMut.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this category?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete?.name} will be permanently removed. Courses tagged with it won't be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDelete && deleteMut.mutate(confirmDelete.id)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
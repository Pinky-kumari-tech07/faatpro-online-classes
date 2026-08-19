import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Plus, Trash2, Pencil, Tag, TicketPercent, Check, ChevronsUpDown, BookOpen, PackageOpen, FolderOpen, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/shared/hooks/useWorkspace";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

type Coupon = any;
type ScopePayload = string[] | { courses?: string[]; bundles?: string[]; categories?: string[]; category_ids?: string[] } | null | undefined;
type PickerOption = { id: string; label: string; description?: string; icon?: "course" | "bundle" | "category"; categoryId?: string };

const EMPTY: any = {
  code: "",
  discount_type: "percent",
  discount_value: 10,
  status: "active",
  starts_at: "",
  ends_at: "",
  max_redemptions: null,
  applies_to: "all_courses",
  product_ids: [],
  course_ids: [],
  bundle_ids: [],
  category_names: [],
  category_ids: [],
  product_scope: "courses",
};

function parseScope(scope: ScopePayload) {
  if (Array.isArray(scope)) {
    return { course_ids: scope, bundle_ids: [], category_names: [], category_ids: [] };
  }
  return {
    course_ids: Array.isArray(scope?.courses) ? scope.courses : [],
    bundle_ids: Array.isArray(scope?.bundles) ? scope.bundles : [],
    category_names: Array.isArray(scope?.categories) ? scope.categories : [],
    category_ids: Array.isArray(scope?.category_ids) ? scope.category_ids : [],
  };
}

function formatScope(coupon: Coupon) {
  if (coupon.applies_to !== "specific_courses") return "All products";
  const scope = parseScope(coupon.course_ids);
  const total = scope.course_ids.length + scope.bundle_ids.length + scope.category_names.length;
  if (!total) return "Specific products";
  const parts = [
    scope.course_ids.length ? `${scope.course_ids.length} course${scope.course_ids.length === 1 ? "" : "s"}` : null,
    scope.bundle_ids.length ? `${scope.bundle_ids.length} bundle${scope.bundle_ids.length === 1 ? "" : "s"}` : null,
    scope.category_names.length ? `${scope.category_names.length} categor${scope.category_names.length === 1 ? "y" : "ies"}` : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

function inferProductScope(scope: ReturnType<typeof parseScope>) {
  const hasCourses = scope.course_ids.length > 0;
  const hasBundles = scope.bundle_ids.length > 0;
  const hasCategories = scope.category_names.length > 0;
  const selectedTypes = [hasCourses, hasBundles, hasCategories].filter(Boolean).length;
  if (selectedTypes > 1) return "mixed";
  if (hasBundles) return "bundles";
  if (hasCategories) return "categories";
  return "courses";
}

function MultiSelect({
  label,
  placeholder,
  searchPlaceholder,
  options,
  selected,
  onChange,
}: {
  label: string;
  placeholder: string;
  searchPlaceholder: string;
  options: PickerOption[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const selectedOptions = options.filter((option) => selectedSet.has(option.id));

  const toggle = (id: string) => {
    const next = selectedSet.has(id) ? selected.filter((item) => item !== id) : [...selected, id];
    onChange(next);
  };

  const remove = (id: string) => onChange(selected.filter((item) => item !== id));

  const IconFor = ({ icon }: { icon?: PickerOption["icon"] }) => {
    if (icon === "bundle") return <PackageOpen className="h-4 w-4 text-muted-foreground" />;
    if (icon === "category") return <FolderOpen className="h-4 w-4 text-muted-foreground" />;
    return <BookOpen className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between h-auto min-h-10 text-left font-normal">
            <span className={cn("truncate", selectedOptions.length === 0 && "text-muted-foreground")}>
              {selectedOptions.length === 0
                ? placeholder
                : selectedOptions.length === 1
                  ? selectedOptions[0].label
                  : `${selectedOptions.length} selected`}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="z-[70] w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>No results found.</CommandEmpty>
              <CommandGroup>
                {options.map((option) => {
                  const active = selectedSet.has(option.id);
                  return (
                    <CommandItem key={option.id} value={`${option.id} ${option.label} ${option.description ?? ""}`} onSelect={() => toggle(option.id)} className="gap-2">
                      <IconFor icon={option.icon} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate">{option.label}</div>
                        {option.description && <div className="text-xs text-muted-foreground truncate">{option.description}</div>}
                      </div>
                      <Check className={cn("h-4 w-4", active ? "opacity-100" : "opacity-0")} />
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selectedOptions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedOptions.map((option) => (
            <Badge key={option.id} variant="secondary" className="gap-1 pr-1">
              <span className="max-w-[180px] truncate">{option.label}</span>
              <button type="button" onClick={() => remove(option.id)} className="rounded-sm hover:bg-background/60" aria-label={`Remove ${option.label}`}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminCouponsPage() {
  const { membership } = useWorkspace();
  const workspaceId = membership?.workspace.id;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [form, setForm] = useState<any>(EMPTY);

  const { data: coupons = [], isLoading } = useQuery({
    queryKey: ["admin-coupons", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase.from("coupons").select("*").eq("workspace_id", workspaceId!).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: scopeOptions, isLoading: loadingScopeOptions, error: scopeOptionsError } = useQuery({
    queryKey: ["coupon-scope-options", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const [courses, bundles, categories] = await Promise.all([
        supabase
          .from("courses")
          .select("id, title, status, category, subcategory, child_category")
          .eq("workspace_id", workspaceId!)
          .is("deleted_at", null)
          .order("title"),
        supabase
          .from("course_bundles")
          .select("id, name, status, category")
          .eq("workspace_id", workspaceId!)
          .order("name"),
        supabase
          .from("course_categories")
          .select("id, name, slug, parent_id, status")
          .eq("workspace_id", workspaceId!)
          .order("name"),
      ]);
      if (courses.error) throw courses.error;
      if (bundles.error) throw bundles.error;
      if (categories.error) throw categories.error;
      return {
        courses: ((courses.data ?? []) as any[]).map((course) => ({
            id: `course:${course.id}`,
            label: course.title,
            description: `Course${course.status ? ` · ${course.status}` : ""}`,
            icon: "course" as const,
          })),
        bundles: ((bundles.data ?? []) as any[]).map((bundle) => ({
            id: `bundle:${bundle.id}`,
            label: bundle.name,
            description: `Bundle${bundle.status ? ` · ${bundle.status}` : ""}`,
            icon: "bundle" as const,
          })),
        categories: ((categories.data ?? []) as any[]).map((category) => ({
          id: category.name,
          categoryId: category.id,
          label: category.name,
          description: category.status ? `Category · ${category.status}` : "Category",
          icon: "category" as const,
        })),
      };
    },
  });

  useEffect(() => {
    if (editing) {
      const scope = parseScope(editing.course_ids);
      setForm({
        ...EMPTY,
        ...editing,
        ...scope,
        product_ids: [
          ...scope.course_ids.map((id: string) => `course:${id}`),
          ...scope.bundle_ids.map((id: string) => `bundle:${id}`),
        ],
        product_scope: inferProductScope(scope),
        starts_at: editing.starts_at?.slice(0, 10) ?? "",
        ends_at: editing.ends_at?.slice(0, 10) ?? "",
      });
    }
    else setForm({ ...EMPTY });
  }, [editing]);

  const openNew = () => { setEditing(null); setForm({ ...EMPTY, product_ids: [], course_ids: [], bundle_ids: [], category_names: [], category_ids: [], product_scope: "courses" }); setOpen(true); };
  const openEdit = (c: Coupon) => { setEditing(c); setOpen(true); };

  const updateProductScope = (product_scope: string) => {
    setForm((prev: any) => ({
      ...prev,
      product_scope,
      ...(product_scope === "courses" ? { bundle_ids: [], category_names: [], category_ids: [] } : {}),
      ...(product_scope === "bundles" ? { course_ids: [], category_names: [], category_ids: [] } : {}),
      ...(product_scope === "categories" ? { course_ids: [], bundle_ids: [], product_ids: [] } : {}),
    }));
  };

  const save = async () => {
    if (!workspaceId) return;
    const code = String(form.code || "").trim().toUpperCase();
    if (!code) { toast({ title: "Code is required", variant: "destructive" }); return; }
    const dv = Number(form.discount_value);
    if (!Number.isFinite(dv) || dv < 0) { toast({ title: "Discount value must be ≥ 0", variant: "destructive" }); return; }
    if (form.discount_type === "percent" && dv > 100) { toast({ title: "Percentage cannot exceed 100", variant: "destructive" }); return; }

    const legacyProductIds: string[] = Array.isArray(form.product_ids) ? form.product_ids : [];
    const courseIds = Array.from(new Set([
      ...(Array.isArray(form.course_ids) ? form.course_ids : []),
      ...legacyProductIds.filter((id) => id.startsWith("course:")).map((id) => id.replace(/^course:/, "")),
    ]));
    const bundleIds = Array.from(new Set([
      ...(Array.isArray(form.bundle_ids) ? form.bundle_ids : []),
      ...legacyProductIds.filter((id) => id.startsWith("bundle:")).map((id) => id.replace(/^bundle:/, "")),
    ]));
    const categoryNames: string[] = Array.from(new Set(Array.isArray(form.category_names) ? form.category_names : []));
    const scopeMode = form.product_scope ?? "courses";
    const scopedCourseIds = scopeMode === "bundles" || scopeMode === "categories" ? [] : courseIds;
    const scopedBundleIds = scopeMode === "courses" || scopeMode === "categories" ? [] : bundleIds;
    const scopedCategoryNames = scopeMode === "courses" || scopeMode === "bundles" ? [] : categoryNames;
    if (form.applies_to === "specific_courses" && scopedCourseIds.length + scopedBundleIds.length + scopedCategoryNames.length === 0) {
      toast({ title: "Select at least one course, bundle, or category", variant: "destructive" });
      return;
    }

    const payload: any = {
      workspace_id: workspaceId,
      code,
      discount_type: form.discount_type,
      discount_value: dv,
      status: form.status,
      starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
      max_redemptions: form.max_redemptions ? Number(form.max_redemptions) : null,
      applies_to: form.applies_to,
      course_ids: form.applies_to === "specific_courses"
        ? {
          courses: scopedCourseIds,
          bundles: scopedBundleIds,
          categories: scopedCategoryNames,
          category_ids: (scopeOptions?.categories ?? []).filter((category) => scopedCategoryNames.includes(category.id)).map((category) => category.categoryId),
        }
        : null,
    };

    const { error } = editing
      ? await supabase.from("coupons").update(payload).eq("id", editing.id)
      : await supabase.from("coupons").insert(payload);
    if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: editing ? "Coupon updated" : "Coupon created" });
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["admin-coupons", workspaceId] });
  };

  const remove = async (c: Coupon) => {
    if (!confirm(`Delete coupon ${c.code}?`)) return;
    const { error } = await supabase.from("coupons").delete().eq("id", c.id);
    if (error) { toast({ title: "Delete failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Deleted" });
    qc.invalidateQueries({ queryKey: ["admin-coupons", workspaceId] });
  };

  const toggleStatus = async (c: Coupon) => {
    const next = c.status === "active" ? "disabled" : "active";
    const { error } = await supabase.from("coupons").update({ status: next }).eq("id", c.id);
    if (error) { toast({ title: "Update failed", description: error.message, variant: "destructive" }); return; }
    qc.invalidateQueries({ queryKey: ["admin-coupons", workspaceId] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><TicketPercent className="h-6 w-6" /> Coupons</h1>
          <p className="text-sm text-muted-foreground mt-1">Marketing coupons applied at checkout by students.</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> New coupon</Button>
      </div>

      <Card className="border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left p-3">Code</th>
                <th className="text-left p-3">Discount</th>
                <th className="text-left p-3">Validity</th>
                <th className="text-left p-3">Usage</th>
                <th className="text-left p-3">Scope</th>
                <th className="text-left p-3">Status</th>
                <th className="text-right p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Loading…</td></tr>
              ) : coupons.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No coupons yet. Create your first campaign.</td></tr>
              ) : coupons.map((c: any) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="p-3">
                    <div className="font-mono font-semibold inline-flex items-center gap-1.5"><Tag className="h-3 w-3" /> {c.code}</div>
                  </td>
                  <td className="p-3">
                    {c.discount_type === "percent" ? `${c.discount_value}% OFF` : `₹${c.discount_value} OFF`}
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {c.starts_at ? new Date(c.starts_at).toLocaleDateString() : "Anytime"} → {c.ends_at ? new Date(c.ends_at).toLocaleDateString() : "No expiry"}
                  </td>
                  <td className="p-3">{c.redeemed_count ?? 0}{c.max_redemptions ? ` / ${c.max_redemptions}` : ""}</td>
                  <td className="p-3 text-xs">{formatScope(c)}</td>
                  <td className="p-3">
                    <button onClick={() => toggleStatus(c)}>
                      <Badge variant={c.status === "active" ? "default" : "secondary"}>{c.status}</Badge>
                    </button>
                  </td>
                  <td className="p-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(c)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit coupon" : "New coupon"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Code</Label>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="SAVE20" className="uppercase font-mono" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select value={form.discount_type} onValueChange={(v) => setForm({ ...form, discount_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                  <SelectItem value="percent">Percentage</SelectItem>
                    <SelectItem value="fixed">Flat amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Value {form.discount_type === "percent" ? "(%)" : "(₹)"}</Label>
                <Input type="number" value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Starts</Label>
                <Input type="date" value={form.starts_at ?? ""} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
              </div>
              <div>
                <Label>Ends</Label>
                <Input type="date" value={form.ends_at ?? ""} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Max redemptions (optional)</Label>
              <Input type="number" value={form.max_redemptions ?? ""} onChange={(e) => setForm({ ...form, max_redemptions: e.target.value })} placeholder="Unlimited" />
            </div>
            <div>
              <Label>Applies to</Label>
              <Select value={form.applies_to} onValueChange={(v) => setForm({ ...form, applies_to: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_courses">All products</SelectItem>
                  <SelectItem value="specific_courses">Specific courses / bundles / categories</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.applies_to === "specific_courses" && (
              <div className="rounded-md border border-border p-3 space-y-4">
                <div>
                  <div className="text-sm font-medium">Specific product scope</div>
                  <p className="text-xs text-muted-foreground">
                    Pick one or more courses, bundles, or course categories. The coupon will work when checkout matches any selected item.
                  </p>
                </div>
                {loadingScopeOptions && <div className="text-xs text-muted-foreground">Loading courses, bundles, and categories…</div>}
                {scopeOptionsError && <div className="text-xs text-destructive">Could not load product lists. Please reopen the coupon form.</div>}
                <div>
                  <Label>Product type</Label>
                  <Select value={form.product_scope ?? "courses"} onValueChange={updateProductScope}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="courses">Courses</SelectItem>
                      <SelectItem value="bundles">Course bundles</SelectItem>
                      <SelectItem value="categories">Course categories</SelectItem>
                      <SelectItem value="mixed">Mixed selection</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {(form.product_scope ?? "courses") === "courses" && (
                  <MultiSelect
                    label="Select courses"
                    placeholder="Choose one or more courses"
                    searchPlaceholder="Search courses..."
                    options={scopeOptions?.courses ?? []}
                    selected={(form.course_ids ?? []).map((id: string) => `course:${id}`)}
                    onChange={(course_ids) => setForm({ ...form, course_ids: course_ids.map((id) => id.replace(/^course:/, "")) })}
                  />
                )}
                {(form.product_scope ?? "courses") === "bundles" && (
                  <MultiSelect
                    label="Select bundles"
                    placeholder="Choose one or more bundles"
                    searchPlaceholder="Search bundles..."
                    options={scopeOptions?.bundles ?? []}
                    selected={(form.bundle_ids ?? []).map((id: string) => `bundle:${id}`)}
                    onChange={(bundle_ids) => setForm({ ...form, bundle_ids: bundle_ids.map((id) => id.replace(/^bundle:/, "")) })}
                  />
                )}
                {(form.product_scope ?? "courses") === "categories" && (
                  <MultiSelect
                    label="Select course categories"
                    placeholder="Choose one or more categories"
                    searchPlaceholder="Search categories..."
                    options={scopeOptions?.categories ?? []}
                    selected={form.category_names ?? []}
                    onChange={(category_names) => setForm({ ...form, category_names })}
                  />
                )}
                {form.product_scope === "mixed" && (
                  <>
                    <MultiSelect
                      label="Select courses"
                      placeholder="Choose one or more courses"
                      searchPlaceholder="Search courses..."
                      options={scopeOptions?.courses ?? []}
                      selected={(form.course_ids ?? []).map((id: string) => `course:${id}`)}
                      onChange={(course_ids) => setForm({ ...form, course_ids: course_ids.map((id) => id.replace(/^course:/, "")) })}
                    />
                    <MultiSelect
                      label="Select bundles"
                      placeholder="Choose one or more bundles"
                      searchPlaceholder="Search bundles..."
                      options={scopeOptions?.bundles ?? []}
                      selected={(form.bundle_ids ?? []).map((id: string) => `bundle:${id}`)}
                      onChange={(bundle_ids) => setForm({ ...form, bundle_ids: bundle_ids.map((id) => id.replace(/^bundle:/, "")) })}
                    />
                    <MultiSelect
                      label="Select course categories"
                      placeholder="Choose one or more categories"
                      searchPlaceholder="Search categories..."
                      options={scopeOptions?.categories ?? []}
                      selected={form.category_names ?? []}
                      onChange={(category_names) => setForm({ ...form, category_names })}
                    />
                  </>
                )}
                <p className="text-xs text-muted-foreground">
                  A student can use this coupon when their selected course or bundle matches any selected item or category.
                </p>
              </div>
            )}
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div>
                <div className="text-sm font-medium">Active</div>
                <div className="text-xs text-muted-foreground">Students can apply this coupon at checkout.</div>
              </div>
              <Switch checked={form.status === "active"} onCheckedChange={(v) => setForm({ ...form, status: v ? "active" : "disabled" })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>{editing ? "Save changes" : "Create coupon"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
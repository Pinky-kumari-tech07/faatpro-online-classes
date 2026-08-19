import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/shared/hooks/useWorkspace";
import PageHeader from "@/modules/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "@/hooks/use-toast";
import {
  MoreHorizontal, Search, ShieldCheck, ChevronLeft, ChevronRight, Sliders,
} from "lucide-react";

// ------------ Role config (Parent removed) ------------
const ROLES = [
  { key: "organization_admin", label: "Admin", badge: "bg-blue-600 text-white hover:bg-blue-700" },
  { key: "instructor",         label: "Instructor", badge: "bg-purple-600 text-white hover:bg-purple-700" },
  { key: "staff",              label: "Staff", badge: "bg-orange-500 text-white hover:bg-orange-600" },
  { key: "student",            label: "Student", badge: "bg-emerald-600 text-white hover:bg-emerald-700" },
] as const;
type RoleKey = typeof ROLES[number]["key"];
const roleLabel = (r: string) => ROLES.find((x) => x.key === r)?.label ?? r;
const roleBadgeClass = (r: string) => ROLES.find((x) => x.key === r)?.badge ?? "bg-slate-500 text-white";

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800 border-emerald-200",
  inactive: "bg-slate-200 text-slate-700 border-slate-300",
  suspended: "bg-red-100 text-red-700 border-red-200",
  pending: "bg-amber-100 text-amber-800 border-amber-200",
};

function fmtDate(v: unknown): string {
  if (!v) return "—";
  try {
    return new Date(v as string).toLocaleDateString(undefined, {
      day: "2-digit", month: "short", year: "numeric",
    });
  } catch { return "—"; }
}

// ================================================================
// Users list (unified table replacing role cards)
// ================================================================
export function RolesPage() {
  const { membership } = useWorkspace();
  const wsId = membership!.workspace.id;
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [institutionFilter, setInstitutionFilter] = useState<string>("all");
  const [batchFilter, setBatchFilter] = useState<string>("all");
  const [joinedFilter, setJoinedFilter] = useState<string>("all"); // 7d,30d,90d,365d
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawerUser, setDrawerUser] = useState<any | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["rbac-users", wsId],
    queryFn: async () => {
      const [profilesRes, memsRes, batchRes, instRes, institutionsRes, batchesRes] = await Promise.all([
        supabase.from("profiles")
          .select("id, full_name, email, phone, avatar_url, signup_role, created_at, is_active, last_login_at")
          .order("created_at", { ascending: false }),
        supabase.from("workspace_members")
          .select("id, role, status, profile_id").eq("workspace_id", wsId),
        supabase.from("batch_students").select("student_id, batch_id"),
        supabase.from("institution_students").select("student_id, institution_id"),
        supabase.from("institutions").select("id, name").eq("workspace_id", wsId),
        supabase.from("batches").select("id, name").eq("workspace_id", wsId),
      ]);

      // A user can hold multiple workspace memberships (Admin + Instructor + …).
      // Collect every membership per profile so the UI can render and toggle
      // each role independently.
      const memsByProfile = new Map<string, any[]>();
      const platformOwnerIds = new Set<string>();
      (memsRes.data ?? []).forEach((m: any) => {
        // Track platform owner profile ids so we can hide them entirely from
        // the Roles & Permissions listing (owner never appears in their own
        // user table). Skip the super_admin membership row itself.
        if (m.role === "super_admin") {
          platformOwnerIds.add(m.profile_id);
          return;
        }
        if (m.role === "parent") return; // legacy, ignore
        const normalized = m.role;
        const list = memsByProfile.get(m.profile_id) ?? [];
        list.push({ ...m, role: normalized });
        memsByProfile.set(m.profile_id, list);
      });

      const batchByStudent = new Map<string, string>();
      (batchRes.data ?? []).forEach((b: any) => batchByStudent.set(b.student_id, b.batch_id));

      const instByStudent = new Map<string, string>();
      (instRes.data ?? []).forEach((i: any) => instByStudent.set(i.student_id, i.institution_id));

      const institutionMap = new Map<string, string>();
      (institutionsRes.data ?? []).forEach((i: any) => institutionMap.set(i.id, i.name));

      const batchMap = new Map<string, string>();
      (batchesRes.data ?? []).forEach((b: any) => batchMap.set(b.id, b.name));

      const rows = (profilesRes.data ?? [])
        .filter((p: any) => !platformOwnerIds.has(p.id))
        .map((p: any) => {
        const mems = memsByProfile.get(p.id) ?? [];
        const roles = Array.from(new Set(mems.map((m) => m.role)));
        if (roles.length === 0 && p.signup_role) {
          let fallback = p.signup_role;
          if (fallback === "super_admin") return null as any;
          if (fallback === "parent") fallback = "student";
          roles.push(fallback);
        }
        const memberIdByRole: Record<string, string> = {};
        mems.forEach((m) => { memberIdByRole[m.role] = m.id; });
        const status = mems[0]?.status ?? (p.is_active ? "active" : "inactive");
        const bId = batchByStudent.get(p.id);
        const iId = instByStudent.get(p.id);
        return {
          profile_id: p.id,
          full_name: p.full_name ?? "User",
          email: p.email ?? "",
          phone: p.phone ?? "",
          avatar_url: p.avatar_url,
          status,
          is_active: !!p.is_active,
          roles,
          memberIdByRole,
          created_at: p.created_at,
          last_login_at: p.last_login_at,
          batch_id: bId ?? null,
          batch_name: bId ? batchMap.get(bId) ?? "—" : "—",
          institution_id: iId ?? null,
          institution_name: iId ? institutionMap.get(iId) ?? "—" : "—",
        };
      });

      return {
        rows: rows.filter(Boolean),
        institutions: institutionsRes.data ?? [],
        batches: batchesRes.data ?? [],
      };
    },
    enabled: !!wsId,
  });

  const rows = data?.rows ?? [];
  const institutions = data?.institutions ?? [];
  const batches = data?.batches ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = Date.now();
    const joinedCutoff = (() => {
      if (joinedFilter === "7d") return now - 7 * 864e5;
      if (joinedFilter === "30d") return now - 30 * 864e5;
      if (joinedFilter === "90d") return now - 90 * 864e5;
      if (joinedFilter === "365d") return now - 365 * 864e5;
      return 0;
    })();
    return rows.filter((r: any) => {
      if (roleFilter !== "all" && !r.roles.includes(roleFilter)) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (institutionFilter !== "all" && r.institution_id !== institutionFilter) return false;
      if (batchFilter !== "all" && r.batch_id !== batchFilter) return false;
      if (joinedCutoff && new Date(r.created_at).getTime() < joinedCutoff) return false;
      if (q) {
        const hay = [r.full_name, r.email, r.phone, r.batch_name, r.institution_name]
          .join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, roleFilter, statusFilter, institutionFilter, batchFilter, joinedFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const summary = useMemo(() => ({
    total: rows.length,
    admin: rows.filter((r: any) => r.roles.includes("organization_admin")).length,
    instructor: rows.filter((r: any) => r.roles.includes("instructor")).length,
    staff: rows.filter((r: any) => r.roles.includes("staff")).length,
    student: rows.filter((r: any) => r.roles.includes("student")).length,
  }), [rows]);

  // -------- mutations --------
  const toggleRole = useMutation({
    mutationFn: async ({ profileId, role, enabled, memberId }: {
      profileId: string; role: RoleKey; enabled: boolean; memberId?: string | null;
    }) => {
      if (enabled) {
        const { error } = await supabase.from("workspace_members").insert({
          workspace_id: wsId, profile_id: profileId, role: role as any, status: "active" as any,
        });
        if (error && !`${error.message}`.toLowerCase().includes("duplicate")) throw error;
      } else {
        if (memberId) {
          const { error } = await supabase.from("workspace_members").delete().eq("id", memberId);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("workspace_members").delete()
            .eq("workspace_id", wsId).eq("profile_id", profileId).eq("role", role as any);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      toast({ title: "Roles updated" });
      qc.invalidateQueries({ queryKey: ["rbac-users", wsId] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const setActive = useMutation({
    mutationFn: async ({ ids, active }: { ids: string[]; active: boolean }) => {
      const { error } = await supabase.from("profiles").update({ is_active: active }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_r, v) => {
      toast({ title: v.active ? "Users activated" : "Users deactivated" });
      qc.invalidateQueries({ queryKey: ["rbac-users", wsId] });
      setSelected(new Set());
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const bulkChangeRole = useMutation({
    mutationFn: async ({ ids, role }: { ids: string[]; role: RoleKey }) => {
      const targets = rows.filter((r: any) => ids.includes(r.profile_id));
      for (const t of targets) {
        if (!t.roles.includes(role)) {
          await supabase.from("workspace_members").insert({
            workspace_id: wsId, profile_id: t.profile_id, role: role as any, status: "active" as any,
          });
        }
      }
    },
    onSuccess: () => {
      toast({ title: "Role added to selected users" });
      qc.invalidateQueries({ queryKey: ["rbac-users", wsId] });
      setSelected(new Set());
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const toggleAllVisible = (checked: boolean) => {
    const next = new Set(selected);
    pageRows.forEach((r) => (checked ? next.add(r.profile_id) : next.delete(r.profile_id)));
    setSelected(next);
  };

  const clearFilters = () => {
    setSearch(""); setRoleFilter("all"); setStatusFilter("all");
    setInstitutionFilter("all"); setBatchFilter("all"); setJoinedFilter("all");
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Roles & permissions"
        description="Roles are fixed by the platform. View users and their assigned roles."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/app/roles/permissions"><Sliders className="h-4 w-4 mr-1" /> Permission matrix</Link>
          </Button>
        }
      />

      {/* Compact summary row */}
      <Card className="p-4 border-border shadow-none">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <SummaryCell label="Total users" value={summary.total} />
          <SummaryCell label="Admins" value={summary.admin} tone="text-blue-700" />
          <SummaryCell label="Instructors" value={summary.instructor} tone="text-purple-700" />
          <SummaryCell label="Staff" value={summary.staff} tone="text-orange-600" />
          <SummaryCell label="Students" value={summary.student} tone="text-emerald-700" />
        </div>
      </Card>

      {/* Filter bar */}
      <Card className="p-3 border-border shadow-none">
        <div className="grid gap-2 md:grid-cols-6">
          <div className="relative md:col-span-2">
            <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
            <Input
              placeholder="Search name, email, phone, batch, institution…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-8 h-9"
            />
          </div>
          <FilterSelect value={roleFilter} onChange={setRoleFilter} label="Role" options={[
            { value: "all", label: "All roles" },
            ...ROLES.map((r) => ({ value: r.key, label: r.label })),
          ]} />
          <FilterSelect value={statusFilter} onChange={setStatusFilter} label="Status" options={[
            { value: "all", label: "All status" },
            { value: "active", label: "Active" },
            { value: "inactive", label: "Inactive" },
            { value: "suspended", label: "Suspended" },
            { value: "pending", label: "Pending" },
          ]} />
          <FilterSelect value={institutionFilter} onChange={setInstitutionFilter} label="Institution" options={[
            { value: "all", label: "All institutions" },
            ...institutions.map((i: any) => ({ value: i.id, label: i.name })),
          ]} />
          <FilterSelect value={batchFilter} onChange={setBatchFilter} label="Batch" options={[
            { value: "all", label: "All batches" },
            ...batches.map((b: any) => ({ value: b.id, label: b.name })),
          ]} />
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <FilterSelect value={joinedFilter} onChange={setJoinedFilter} label="Joined" options={[
            { value: "all", label: "Anytime" },
            { value: "7d", label: "Last 7 days" },
            { value: "30d", label: "Last 30 days" },
            { value: "90d", label: "Last 90 days" },
            { value: "365d", label: "Last year" },
          ]} />
          <Button variant="ghost" size="sm" onClick={clearFilters}>Clear filters</Button>
          <div className="text-xs text-muted-foreground ml-auto">{filtered.length} of {rows.length}</div>
        </div>
      </Card>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <Card className="p-3 border-primary/40 bg-primary-soft/40 shadow-none flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setActive.mutate({ ids: [...selected], active: true })}>Activate</Button>
            <Button size="sm" variant="outline" onClick={() => setActive.mutate({ ids: [...selected], active: false })}>Deactivate</Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
          </div>
        </Card>
      )}

      {/* Users table */}
      <Card className="border-border shadow-none overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={pageRows.length > 0 && pageRows.every((r) => selected.has(r.profile_id))}
                    onCheckedChange={(v) => toggleAllVisible(!!v)}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Mobile</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>Institution</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Last login</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={11} className="text-center text-sm text-muted-foreground py-8">Loading…</TableCell></TableRow>
              )}
              {!isLoading && pageRows.length === 0 && (
                <TableRow><TableCell colSpan={11} className="text-center text-sm text-muted-foreground py-10">No users match these filters.</TableCell></TableRow>
              )}
              {pageRows.map((r) => {
                const isSel = selected.has(r.profile_id);
                return (
                  <TableRow key={r.profile_id} className={isSel ? "bg-primary-soft/30" : ""}>
                    <TableCell>
                      <Checkbox
                        checked={isSel}
                        onCheckedChange={(v) => {
                          const next = new Set(selected);
                          v ? next.add(r.profile_id) : next.delete(r.profile_id);
                          setSelected(next);
                        }}
                        aria-label={`Select ${r.full_name}`}
                      />
                    </TableCell>
                    <TableCell>
                      <button className="flex items-center gap-2 text-left hover:underline" onClick={() => setDrawerUser(r)}>
                        <div className="h-8 w-8 rounded-full bg-primary-soft grid place-items-center text-xs font-semibold text-primary shrink-0 overflow-hidden">
                          {r.avatar_url
                            ? <img src={r.avatar_url} alt="" className="h-full w-full object-cover" />
                            : (r.full_name?.[0] ?? "U").toUpperCase()}
                        </div>
                        <span className="font-medium">{r.full_name}</span>
                      </button>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{r.email || "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{r.phone || "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-[220px]">
                        {r.roles.length === 0 ? (
                          <Badge variant="outline">No role</Badge>
                        ) : r.roles.map((rk: string) => (
                          <Badge key={rk} className={`${roleBadgeClass(rk)} border-0`}>{roleLabel(rk)}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs capitalize ${STATUS_STYLES[r.status] ?? STATUS_STYLES.inactive}`}>
                        {r.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">{r.batch_name}</TableCell>
                    <TableCell className="text-sm">{r.institution_name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmtDate(r.created_at)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmtDate(r.last_login_at)}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => setDrawerUser(r)}>View profile</DropdownMenuItem>
                          <DropdownMenuItem asChild><Link to="/app/students">Manage in Students</Link></DropdownMenuItem>
                          <DropdownMenuItem asChild><Link to="/app/batches">Assign batch</Link></DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {r.is_active ? (
                            <DropdownMenuItem onClick={() => setActive.mutate({ ids: [r.profile_id], active: false })}>Deactivate login</DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => setActive.mutate({ ids: [r.profile_id], active: true })}>Activate login</DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        {/* Pagination */}
        <div className="flex flex-wrap items-center gap-3 p-3 border-t border-border text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Rows</span>
            <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
              <SelectTrigger className="w-20 h-8"><SelectValue /></SelectTrigger>
              <SelectContent>{[25, 50, 100, 200].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-muted-foreground">Page {currentPage} of {totalPages}</span>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      </Card>

      {/* User detail drawer */}
      <Sheet open={!!drawerUser} onOpenChange={(o) => !o && setDrawerUser(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {drawerUser && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary-soft grid place-items-center text-sm font-semibold text-primary overflow-hidden">
                    {drawerUser.avatar_url
                      ? <img src={drawerUser.avatar_url} alt="" className="h-full w-full object-cover" />
                      : (drawerUser.full_name?.[0] ?? "U").toUpperCase()}
                  </div>
                  <div>
                    <div>{drawerUser.full_name}</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(drawerUser.roles ?? []).length === 0
                        ? <Badge variant="outline">No role</Badge>
                        : drawerUser.roles.map((rk: string) => (
                            <Badge key={rk} className={`${roleBadgeClass(rk)} border-0`}>{roleLabel(rk)}</Badge>
                          ))}
                    </div>
                  </div>
                </SheetTitle>
                <SheetDescription>{drawerUser.email}</SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-4 text-sm">
                <DrawerRow k="Phone" v={drawerUser.phone || "—"} />
                <DrawerRow k="Status" v={<span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs capitalize ${STATUS_STYLES[drawerUser.status] ?? STATUS_STYLES.inactive}`}>{drawerUser.status}</span>} />
                <DrawerRow k="Batch" v={drawerUser.batch_name} />
                <DrawerRow k="Institution" v={drawerUser.institution_name} />
                <DrawerRow k="Joined" v={fmtDate(drawerUser.created_at)} />
                <DrawerRow k="Last login" v={fmtDate(drawerUser.last_login_at)} />
                <div className="pt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" asChild><Link to="/app/students">Open in Students</Link></Button>
                  <Button size="sm" variant="outline" asChild><Link to="/app/certificates">Certificates</Link></Button>
                  <Button size="sm" variant="outline" asChild><Link to="/app/payments">Payments</Link></Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function SummaryCell({ label, value, tone = "text-foreground" }: { label: string; value: number; tone?: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-2xl font-semibold mt-1 ${tone}`}>{value}</div>
    </div>
  );
}

function FilterSelect({ value, onChange, label, options }: {
  value: string; onChange: (v: string) => void; label: string;
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9"><SelectValue placeholder={label} /></SelectTrigger>
      <SelectContent>{options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
    </Select>
  );
}

function DrawerRow({ k, v }: { k: string; v: any }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="text-muted-foreground text-xs uppercase tracking-wide w-32 shrink-0">{k}</div>
      <div className="text-right flex-1">{v}</div>
    </div>
  );
}

// ================================================================
// Permission Matrix (separate page)
// ================================================================
const PERMISSION_GROUPS: { group: string; items: string[] }[] = [
  { group: "Core", items: ["Dashboard", "Analytics", "Reports"] },
  { group: "Academic", items: ["Courses", "Bundles", "Categories", "Assignments", "Quizzes", "Live classes", "Certificates"] },
  { group: "People", items: ["Students", "Instructors", "Staff", "Institutions", "Batches"] },
  { group: "Finance", items: ["Payments", "Orders", "Invoices", "Coupons", "GST", "Payment requests"] },
  { group: "Communication", items: ["Announcements", "Messages", "Discussions", "Support"] },
  { group: "Admin", items: ["Settings", "Roles & permissions", "Integrations", "Content protection", "Activity logs"] },
];

const DEFAULT_MATRIX: Record<string, Record<RoleKey, boolean>> = (() => {
  const m: any = {};
  PERMISSION_GROUPS.flatMap((g) => g.items).forEach((p) => {
    m[p] = {
      organization_admin: true,
      instructor: ["Dashboard", "Courses", "Bundles", "Assignments", "Quizzes", "Live classes", "Certificates", "Students", "Announcements", "Messages", "Discussions", "Support", "Reports"].includes(p),
      staff: ["Dashboard", "Students", "Batches", "Institutions", "Payments", "Orders", "Invoices", "Announcements", "Messages", "Support", "Reports"].includes(p),
      student: ["Dashboard", "Courses", "Bundles", "Certificates", "Assignments", "Quizzes", "Live classes", "Announcements", "Messages", "Discussions", "Support", "Orders", "Invoices"].includes(p),
    };
  });
  return m;
})();

export function PermissionMatrixPage() {
  const matrix = DEFAULT_MATRIX;
  const [query, setQuery] = useState("");

  return (
    <div className="space-y-5">
      <PageHeader
        title="Permission matrix"
        description="Platform-defined permissions for each role. This matrix is read-only."
        actions={
          <Button variant="outline" size="sm" asChild><Link to="/app/roles"><ChevronLeft className="h-4 w-4 mr-1" /> Back to users</Link></Button>
        }
      />

      <Card className="p-3 border-border shadow-none">
        <div className="relative max-w-sm">
          <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search permission…" className="pl-8 h-9" />
        </div>
      </Card>

      <Card className="border-border shadow-none overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-1/3">Permission</TableHead>
              {ROLES.map((r) => (
                <TableHead key={r.key} className="text-center">
                  <Badge className={`${r.badge} border-0`}>{r.label}</Badge>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {PERMISSION_GROUPS.map((group) => {
              const items = group.items.filter((p) => p.toLowerCase().includes(query.toLowerCase()));
              if (items.length === 0) return null;
              return (
                <>
                  <TableRow key={`g-${group.group}`} className="bg-surface-muted">
                    <TableCell colSpan={5} className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <ShieldCheck className="h-3.5 w-3.5 inline mr-2" />{group.group}
                    </TableCell>
                  </TableRow>
                  {items.map((perm) => (
                    <TableRow key={perm}>
                      <TableCell className="font-medium">{perm}</TableCell>
                      {ROLES.map((r) => (
                        <TableCell key={r.key} className="text-center">
                          <Checkbox
                            checked={!!matrix[perm]?.[r.key]}
                            disabled
                            aria-label={`${perm} for ${r.label}`}
                          />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <p className="text-xs text-muted-foreground">Roles and permissions are managed by the platform and cannot be changed.</p>
    </div>
  );
}
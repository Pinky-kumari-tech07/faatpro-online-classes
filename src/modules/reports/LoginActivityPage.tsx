import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Download, Monitor, Smartphone, Tablet, Users, Activity, Clock, Wifi } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/shared/hooks/useWorkspace";
import { format, startOfDay, endOfDay, subDays, startOfMonth, startOfWeek } from "date-fns";
import { exportToCsv, exportToXlsx } from "@/modules/students/exportUtils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import StatCard from "@/modules/dashboard/components/StatCard";

type Preset = "today" | "yesterday" | "7d" | "this_month" | "30d";

function presetRange(p: Preset) {
  const now = new Date();
  switch (p) {
    case "today": return { from: startOfDay(now), to: endOfDay(now) };
    case "yesterday": return { from: startOfDay(subDays(now, 1)), to: endOfDay(subDays(now, 1)) };
    case "7d": return { from: startOfDay(startOfWeek(now, { weekStartsOn: 1 })), to: endOfDay(now) };
    case "this_month": return { from: startOfMonth(now), to: endOfDay(now) };
    default: return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) };
  }
}

function fmtDuration(seconds: number | null | undefined, fallbackFrom?: string) {
  let s = seconds ?? 0;
  if (!s && fallbackFrom) {
    s = Math.max(0, Math.floor((Date.now() - new Date(fallbackFrom).getTime()) / 1000));
  }
  if (!s) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function DeviceIcon({ t }: { t?: string | null }) {
  if (t === "mobile") return <Smartphone className="h-3.5 w-3.5" />;
  if (t === "tablet") return <Tablet className="h-3.5 w-3.5" />;
  return <Monitor className="h-3.5 w-3.5" />;
}

function statusOf(s: any): { label: string; tone: "online" | "idle" | "offline" | "closed" } {
  if (!s.is_active) {
    if (s.logout_reason === "inactivity_timeout") return { label: "Auto logged out", tone: "closed" };
    if (s.logout_reason === "replaced_by_new_login") return { label: "Replaced", tone: "closed" };
    return { label: "Logged out", tone: "closed" };
  }
  const lastActiveMs = Date.now() - new Date(s.last_active).getTime();
  if (lastActiveMs < 5 * 60 * 1000) return { label: "Online", tone: "online" };
  if (lastActiveMs < 30 * 60 * 1000) return { label: "Idle", tone: "idle" };
  return { label: "Offline", tone: "offline" };
}

export default function LoginActivityPage() {
  const { membership } = useWorkspace();
  const wsId = membership!.workspace.id;

  const [preset, setPreset] = useState<Preset>("30d");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [methodFilter, setMethodFilter] = useState<string>("all");

  const range = useMemo(() => presetRange(preset), [preset]);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["login-activity", wsId, range.from.toISOString(), range.to.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_sessions")
        .select("id, user_id, workspace_id, login_time, last_active, revoked_at, revoked_reason, logout_reason, duration_seconds, is_active, device_name, device_type, browser, operating_system, ip_address, location, login_method")
        .gte("login_time", range.from.toISOString())
        .lte("login_time", range.to.toISOString())
        .order("login_time", { ascending: false })
        .limit(1000);
      if (error) throw error;
      const list = data ?? [];
      const ids = Array.from(new Set(list.map((s) => s.user_id)));
      if (!ids.length) return [];
      const [{ data: profs }, { data: mems }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email").in("id", ids),
        supabase.from("workspace_members").select("profile_id, role").in("profile_id", ids).eq("workspace_id", wsId),
      ]);
      const pmap = new Map((profs ?? []).map((p: any) => [p.id, p]));
      const rmap = new Map((mems ?? []).map((m: any) => [m.profile_id, m.role]));
      return list.map((s: any) => ({
        ...s,
        _name: pmap.get(s.user_id)?.full_name ?? "—",
        _email: pmap.get(s.user_id)?.email ?? "—",
        _role: rmap.get(s.user_id) ?? "—",
      }));
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r: any) => {
      const st = statusOf(r);
      if (statusFilter !== "all" && st.tone !== statusFilter) return false;
      if (roleFilter !== "all" && r._role !== roleFilter) return false;
      if (methodFilter !== "all" && (r.login_method ?? "email") !== methodFilter) return false;
      if (!q) return true;
      return (
        (r._name ?? "").toLowerCase().includes(q) ||
        (r._email ?? "").toLowerCase().includes(q) ||
        (r.ip_address ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, statusFilter, roleFilter, methodFilter]);

  const kpi = useMemo(() => {
    const active = rows.filter((r: any) => statusOf(r).tone === "online").length;
    const today = rows.filter((r: any) => new Date(r.login_time).toDateString() === new Date().toDateString()).length;
    const closed = rows.filter((r: any) => !r.is_active && r.duration_seconds);
    const avg = closed.length
      ? Math.round(closed.reduce((s: number, r: any) => s + (r.duration_seconds ?? 0), 0) / closed.length)
      : 0;
    const longest = rows.reduce((mx: number, r: any) => {
      const dur = r.duration_seconds ?? Math.floor((Date.now() - new Date(r.login_time).getTime()) / 1000);
      return dur > mx ? dur : mx;
    }, 0);
    return { active, today, avg, longest };
  }, [rows]);

  const exportRows = () => filtered.map((r: any) => ({
    Date: format(new Date(r.login_time), "yyyy-MM-dd"),
    User: r._name,
    Email: r._email,
    Role: r._role,
    "Login Time": format(new Date(r.login_time), "HH:mm:ss"),
    "Logout Time": r.revoked_at ? format(new Date(r.revoked_at), "HH:mm:ss") : "",
    Duration: fmtDuration(r.duration_seconds, r.login_time),
    Device: r.device_name ?? "",
    Browser: r.browser ?? "",
    OS: r.operating_system ?? "",
    IP: r.ip_address ?? "",
    Location: r.location ?? "",
    Method: r.login_method ?? "email",
    "Logout Reason": r.logout_reason ?? r.revoked_reason ?? "",
    Status: statusOf(r).label,
  }));

  const doExport = (kind: "csv" | "xlsx" | "pdf") => {
    const rowsE = exportRows();
    const filename = `login-activity-${format(new Date(), "yyyyMMdd-HHmm")}`;
    if (kind === "csv") return exportToCsv(rowsE, filename);
    if (kind === "xlsx") return exportToXlsx(rowsE, filename, "Login Activity");
    const doc = new jsPDF({ orientation: "landscape" });
    doc.text("Login Activity Report", 14, 14);
    autoTable(doc, {
      startY: 20,
      styles: { fontSize: 7 },
      head: [Object.keys(rowsE[0] ?? { none: "" })],
      body: rowsE.map((r) => Object.values(r).map((v) => String(v ?? ""))),
    });
    doc.save(`${filename}.pdf`);
  };

  const roleOptions = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r: any) => r._role && s.add(r._role));
    return Array.from(s);
  }, [rows]);

  return (
    <div className="space-y-6 max-w-7xl">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Login Activity</h1>
          <p className="text-muted-foreground mt-1">Every login, session, and logout across your workspace.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={preset} onValueChange={(v) => setPreset(v as Preset)}>
            <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="yesterday">Yesterday</SelectItem>
              <SelectItem value="7d">This week</SelectItem>
              <SelectItem value="this_month">This month</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline"><Download className="h-4 w-4 mr-1" /> Export</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover">
              <DropdownMenuItem onClick={() => doExport("csv")}>CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={() => doExport("xlsx")}>Excel</DropdownMenuItem>
              <DropdownMenuItem onClick={() => doExport("pdf")}>PDF</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Currently online" value={kpi.active} icon={Wifi} />
        <StatCard label="Today's logins" value={kpi.today} icon={Users} />
        <StatCard label="Avg session" value={fmtDuration(kpi.avg)} icon={Clock} />
        <StatCard label="Longest session" value={fmtDuration(kpi.longest)} icon={Activity} />
      </div>

      <Card className="p-3 flex flex-wrap items-center gap-2 border-border shadow-none">
        <Input placeholder="Search user, email, IP" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs h-9" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="online">Online</SelectItem>
            <SelectItem value="idle">Idle</SelectItem>
            <SelectItem value="offline">Offline</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-40 h-9"><SelectValue placeholder="Role" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {roleOptions.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={methodFilter} onValueChange={setMethodFilter}>
          <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Method" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All methods</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="google">Google</SelectItem>
            <SelectItem value="otp">OTP</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} of {rows.length} sessions</span>
      </Card>

      <Card className="border-border shadow-none overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Login</TableHead>
              <TableHead>Logout</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Device</TableHead>
              <TableHead>Browser · OS</TableHead>
              <TableHead>IP · Location</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">No sessions found</TableCell></TableRow>
            ) : filtered.map((r: any) => {
              const st = statusOf(r);
              return (
                <TableRow key={r.id}>
                  <TableCell className="min-w-[180px]">
                    <div className="font-medium">{r._name}</div>
                    <div className="text-xs text-muted-foreground truncate">{r._email}</div>
                  </TableCell>
                  <TableCell className="text-xs capitalize">{String(r._role).replace(/_/g, " ")}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{format(new Date(r.login_time), "dd MMM, HH:mm")}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{r.revoked_at ? format(new Date(r.revoked_at), "dd MMM, HH:mm") : "—"}</TableCell>
                  <TableCell className="text-xs">{fmtDuration(r.duration_seconds, r.is_active ? r.login_time : undefined)}</TableCell>
                  <TableCell className="text-xs"><span className="inline-flex items-center gap-1"><DeviceIcon t={r.device_type} />{r.device_name ?? "—"}</span></TableCell>
                  <TableCell className="text-xs">{[r.browser, r.operating_system].filter(Boolean).join(" · ") || "—"}</TableCell>
                  <TableCell className="text-xs">{[r.ip_address, r.location].filter(Boolean).join(" · ") || "—"}</TableCell>
                  <TableCell className="text-xs capitalize">{r.login_method ?? "email"}</TableCell>
                  <TableCell>
                    <Badge
                      variant={st.tone === "online" ? "default" : "secondary"}
                      className={
                        st.tone === "online" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" :
                        st.tone === "idle" ? "bg-amber-500/15 text-amber-700 dark:text-amber-400" :
                        st.tone === "offline" ? "bg-muted text-muted-foreground" :
                        "bg-muted text-muted-foreground"
                      }
                    >
                      {st.label}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
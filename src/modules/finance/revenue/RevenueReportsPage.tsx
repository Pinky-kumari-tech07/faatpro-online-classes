import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWorkspace } from "@/shared/hooks/useWorkspace";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { settlementService, formatMoney, exportToCSV } from "@/services/supabase/revenueService";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { BarChart3, Download } from "lucide-react";

type Group = "instructor" | "course" | "month";

export default function RevenueReportsPage() {
  const { membership } = useWorkspace();
  const wsId = membership?.workspace.id ?? "";
  const [group, setGroup] = useState<Group>("instructor");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const q = useQuery({
    queryKey: ["ws-earnings-report", wsId, from, to],
    queryFn: () => settlementService.listWorkspaceEarnings(wsId, {
      from: from ? new Date(from).toISOString() : undefined,
      to: to ? new Date(new Date(to).setHours(23,59,59,999)).toISOString() : undefined,
    }),
    enabled: !!wsId,
  });

  const grouped = useMemo(() => {
    const map = new Map<string, { key: string; label: string; gross: number; net: number; instructor: number; platform: number; count: number }>();
    (q.data ?? []).forEach((e: any) => {
      let key = "";
      let label = "";
      if (group === "instructor") { key = e.instructor_id; label = e.instructor?.full_name ?? "Unknown"; }
      else if (group === "course") { key = e.course_id; label = e.course?.title ?? "Untitled"; }
      else {
        const d = new Date(e.earned_at);
        key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
        label = d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
      }
      const r = map.get(key) ?? { key, label, gross: 0, net: 0, instructor: 0, platform: 0, count: 0 };
      r.gross += Number(e.gross_amount) || 0;
      r.net += Number(e.net_revenue_base) || 0;
      r.instructor += Number(e.net_earning) || 0;
      r.platform += Number(e.commission_amount) || 0;
      r.count += 1;
      map.set(key, r);
    });
    return Array.from(map.values()).sort((a,b) => group === "month" ? a.key.localeCompare(b.key) : b.instructor - a.instructor);
  }, [q.data, group]);

  const trend = useMemo(() => {
    const map = new Map<string, { label: string; gross: number; instructor: number; platform: number }>();
    (q.data ?? []).forEach((e: any) => {
      const d = new Date(e.earned_at);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
      const label = d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
      const r = map.get(key) ?? { label, gross: 0, instructor: 0, platform: 0 };
      r.gross += Number(e.gross_amount) || 0;
      r.instructor += Number(e.net_earning) || 0;
      r.platform += Number(e.commission_amount) || 0;
      map.set(key, r);
    });
    return Array.from(map.entries()).sort(([a],[b]) => a.localeCompare(b)).map(([,v]) => v);
  }, [q.data]);

  const totals = useMemo(() => grouped.reduce((a, r) => ({
    gross: a.gross + r.gross, net: a.net + r.net, instructor: a.instructor + r.instructor, platform: a.platform + r.platform, count: a.count + r.count,
  }), { gross: 0, net: 0, instructor: 0, platform: 0, count: 0 }), [grouped]);

  const onExport = () => {
    exportToCSV(`revenue-report-${group}-${new Date().toISOString().slice(0,10)}.csv`,
      grouped.map((r) => ({ Group: r.label, Count: r.count, Gross: r.gross, NetRevenue: r.net, InstructorShare: r.instructor, PlatformShare: r.platform })));
  };

  return (
    <div className="space-y-6 max-w-[1400px]">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Revenue reports</h1>
          <p className="text-muted-foreground">Instructor vs platform breakdown across the workspace.</p>
        </div>
        <Button variant="outline" size="sm" onClick={onExport}><Download className="h-4 w-4 mr-1" /> Export CSV</Button>
      </header>

      <Card className="p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs text-muted-foreground">Group by</label>
          <Select value={group} onValueChange={(v) => setGroup(v as Group)}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="instructor">Instructor</SelectItem>
              <SelectItem value="course">Course</SelectItem>
              <SelectItem value="month">Month</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">From</label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-[160px]" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">To</label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-[160px]" />
        </div>
      </Card>

      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi label="Entries" value={totals.count.toString()} />
        <Kpi label="Gross" value={formatMoney(totals.gross)} />
        <Kpi label="Net revenue" value={formatMoney(totals.net)} />
        <Kpi label="Instructor share" value={formatMoney(totals.instructor)} tone="success" />
        <Kpi label="Platform share" value={formatMoney(totals.platform)} tone="primary" />
      </div>

      <Card className="p-5">
        <div className="font-semibold mb-3">Monthly trend</div>
        <div className="h-64">
          {trend.length === 0 ? (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
              <BarChart3 className="h-6 w-6 mr-2 opacity-50" /> No data in this range
            </div>
          ) : (
            <ResponsiveContainer>
              <AreaChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="label" fontSize={12} /><YAxis fontSize={12} />
                <Tooltip formatter={(v: any) => formatMoney(Number(v))} />
                <Area type="monotone" dataKey="gross" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.15} />
                <Area type="monotone" dataKey="instructor" stroke="#10b981" fill="#10b981" fillOpacity={0.15} />
                <Area type="monotone" dataKey="platform" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.15} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      <Card className="overflow-hidden">
        {q.isLoading ? <div className="p-4"><Skeleton className="h-32" /></div> : (
          <Table>
            <TableHeader><TableRow>
              <TableHead className="capitalize">{group}</TableHead>
              <TableHead>Entries</TableHead>
              <TableHead>Gross</TableHead>
              <TableHead>Net revenue</TableHead>
              <TableHead>Instructor</TableHead>
              <TableHead>Platform</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {grouped.map((r) => (
                <TableRow key={r.key}>
                  <TableCell className="font-medium">{r.label}</TableCell>
                  <TableCell>{r.count}</TableCell>
                  <TableCell>{formatMoney(r.gross)}</TableCell>
                  <TableCell>{formatMoney(r.net)}</TableCell>
                  <TableCell className="font-semibold text-emerald-600 dark:text-emerald-400">{formatMoney(r.instructor)}</TableCell>
                  <TableCell className="font-semibold text-primary">{formatMoney(r.platform)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "success"|"primary" }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold ${tone === "success" ? "text-emerald-600 dark:text-emerald-400" : tone === "primary" ? "text-primary" : ""}`}>{value}</div>
    </Card>
  );
}
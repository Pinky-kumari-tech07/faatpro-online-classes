import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Search, Download, Eye, Users, GraduationCap, Award, Hourglass, Calendar, TrendingUp, BookOpen, CheckCircle2, AlertTriangle } from "lucide-react";
import PageHeader from "@/modules/shared/PageHeader";
import StatCard from "@/modules/dashboard/components/StatCard";
import { useWorkspace } from "@/shared/hooks/useWorkspace";
import { fetchBatchPortfolio } from "./batchReportService";
import { exportToXlsx } from "@/modules/students/exportUtils";

export default function BatchReportsPage() {
  const { membership } = useWorkspace();
  const wsId = membership?.workspace.id ?? null;
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [completionFilter, setCompletionFilter] = useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["batch-reports", wsId],
    queryFn: () => fetchBatchPortfolio(wsId!),
    enabled: !!wsId,
  });

  const rows = data?.rows ?? [];
  const totals = data?.totals;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (completionFilter === "above_75" && r.average_completion < 75) return false;
      if (completionFilter === "25_75" && (r.average_completion < 25 || r.average_completion >= 75)) return false;
      if (completionFilter === "below_25" && r.average_completion >= 25) return false;
      if (!q) return true;
      return r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q) || (r.coordinator_name ?? "").toLowerCase().includes(q);
    });
  }, [rows, search, statusFilter, completionFilter]);

  const handleExport = () => {
    exportToXlsx(
      filtered.map((r) => ({
        Batch: r.name,
        Code: r.code,
        Status: r.status,
        Institutions: r.institutions_count,
        Students: r.total_students,
        Active: r.active_students,
        Completed: r.completed_students,
        InProgress: r.in_progress_students,
        NotStarted: r.not_started_students,
        Expired: r.expired_enrollments,
        AvgCompletion: r.average_completion,
        CertificatesIssued: r.certificates_issued,
        CertificatesPending: r.certificates_pending,
        StartDate: r.start_date ?? "",
        EndDate: r.end_date ?? "",
        Coordinator: r.coordinator_name ?? "Not Assigned",
        CoordinatorEmail: r.coordinator_email ?? "",
        CoordinatorPhone: r.coordinator_phone ?? "",
      })),
      "batch-report.xlsx",
      "Batches",
    );
  };

  if (!wsId) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Batch Reports"
        description="Enterprise, university, corporate and bulk-enrolled batch analytics."
        actions={
          <Button variant="outline" onClick={handleExport} disabled={!filtered.length}>
            <Download className="mr-2 h-4 w-4" /> Export XLSX
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
        <StatCard label="Total Batches" value={totals?.totalBatches ?? 0} icon={BookOpen} />
        <StatCard label="Active" value={totals?.activeBatches ?? 0} icon={TrendingUp} />
        <StatCard label="Completed" value={totals?.completedBatches ?? 0} icon={CheckCircle2} />
        <StatCard label="Upcoming" value={totals?.upcomingBatches ?? 0} icon={Calendar} />
        <StatCard label="Total Students" value={totals?.totalStudents ?? 0} icon={Users} />
        <StatCard label="Active Students" value={totals?.activeStudents ?? 0} icon={Users} />
        <StatCard label="Completed Students" value={totals?.completedStudents ?? 0} icon={GraduationCap} />
        <StatCard label="Expired Enrollments" value={totals?.expiredEnrollments ?? 0} icon={Hourglass} />
        <StatCard label="Avg Completion %" value={`${totals?.averageCompletion ?? 0}%`} icon={TrendingUp} />
        <StatCard label="Certificates Issued" value={totals?.certificatesIssued ?? 0} icon={Award} />
        <StatCard label="Certificates Pending" value={totals?.certificatesPending ?? 0} icon={Award} />
      </div>

      <Card className="p-4 space-y-4">
        <div className="flex flex-col md:flex-row gap-3 md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search batch, code or coordinator…"
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
          <Select value={completionFilter} onValueChange={setCompletionFilter}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Completion %" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any completion</SelectItem>
              <SelectItem value="above_75">≥ 75%</SelectItem>
              <SelectItem value="25_75">25% – 75%</SelectItem>
              <SelectItem value="below_25">&lt; 25%</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading batches…
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">No batches match your filters.</div>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead className="text-right">Inst.</TableHead>
                  <TableHead className="text-right">Students</TableHead>
                  <TableHead className="text-right">Active</TableHead>
                  <TableHead className="text-right">Completed</TableHead>
                  <TableHead className="text-right">In Progress</TableHead>
                  <TableHead className="text-right">Not Started</TableHead>
                  <TableHead className="text-right">Expired</TableHead>
                  <TableHead className="text-right">Avg %</TableHead>
                  <TableHead className="text-right">Certs</TableHead>
                  <TableHead>Validity</TableHead>
                  <TableHead>Coordinator</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.code}</TableCell>
                    <TableCell className="text-right">{r.institutions_count}</TableCell>
                    <TableCell className="text-right">{r.total_students}</TableCell>
                    <TableCell className="text-right">{r.active_students}</TableCell>
                    <TableCell className="text-right">{r.completed_students}</TableCell>
                    <TableCell className="text-right">{r.in_progress_students}</TableCell>
                    <TableCell className="text-right">{r.not_started_students}</TableCell>
                    <TableCell className="text-right">{r.expired_enrollments}</TableCell>
                    <TableCell className="text-right">{r.average_completion}%</TableCell>
                    <TableCell className="text-right">{r.certificates_issued}</TableCell>
                    <TableCell className="text-xs">{r.validity_type}</TableCell>
                    <TableCell className="text-xs">
                      {r.coordinator_name ? (
                        <div className="leading-tight">
                          <div className="font-medium text-foreground">{r.coordinator_name}</div>
                          {r.coordinator_email && <div className="text-[11px] text-muted-foreground">{r.coordinator_email}</div>}
                        </div>
                      ) : (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" /> Not Assigned
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.status === "active" ? "default" : "secondary"}>{r.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link to={`/app/reports/batches/${r.id}`}>
                          <Eye className="h-4 w-4 mr-1" /> View
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
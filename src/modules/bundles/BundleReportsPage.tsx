import { useQuery } from "@tanstack/react-query";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { useWorkspace } from "@/shared/hooks/useWorkspace";
import PageHeader from "@/modules/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { exportToCsv, exportToXlsx } from "@/modules/students/exportUtils";

interface BundleRow {
  id: string;
  name: string;
  status: string;
  students: number;
  revenue: number;
  currency: string;
  total_courses: number;
  completions: number;
  certificates: number;
}

async function loadBundleReport(workspaceId: string): Promise<BundleRow[]> {
  const { data: bundles } = await supabase
    .from("course_bundles").select("id, name, status, currency").eq("workspace_id", workspaceId);
  const ids = (bundles ?? []).map((b) => b.id);
  if (!ids.length) return [];

  const [bcRes, sbRes, payRes] = await Promise.all([
    supabase.from("bundle_courses").select("bundle_id, course_id").in("bundle_id", ids),
    supabase.from("student_bundles").select("bundle_id, student_id").in("bundle_id", ids),
    supabase.from("payments").select("bundle_id, total_amount, amount, status").in("bundle_id", ids).eq("status", "succeeded" as any),
  ]);

  const courseIdsByBundle: Record<string, string[]> = {};
  (bcRes.data ?? []).forEach((r: any) => {
    courseIdsByBundle[r.bundle_id] = courseIdsByBundle[r.bundle_id] ?? [];
    courseIdsByBundle[r.bundle_id].push(r.course_id);
  });

  const studentsByBundle: Record<string, string[]> = {};
  (sbRes.data ?? []).forEach((r: any) => {
    studentsByBundle[r.bundle_id] = studentsByBundle[r.bundle_id] ?? [];
    studentsByBundle[r.bundle_id].push(r.student_id);
  });

  const allCourseIds = Array.from(new Set(Object.values(courseIdsByBundle).flat()));
  const allStudentIds = Array.from(new Set(Object.values(studentsByBundle).flat()));

  let enrollmentRows: any[] = [];
  let certRows: any[] = [];
  if (allCourseIds.length && allStudentIds.length) {
    const [{ data: e }, { data: c }] = await Promise.all([
      supabase.from("enrollments").select("course_id, student_id, status").in("course_id", allCourseIds).in("student_id", allStudentIds),
      supabase.from("certificates").select("course_id, student_id").in("course_id", allCourseIds).in("student_id", allStudentIds),
    ]);
    enrollmentRows = e ?? [];
    certRows = c ?? [];
  }

  const revenueByBundle: Record<string, number> = {};
  (payRes.data ?? []).forEach((p: any) => {
    revenueByBundle[p.bundle_id] = (revenueByBundle[p.bundle_id] ?? 0) + Number(p.total_amount ?? p.amount ?? 0);
  });

  return (bundles ?? []).map((b: any): BundleRow => {
    const cIds = courseIdsByBundle[b.id] ?? [];
    const sIds = studentsByBundle[b.id] ?? [];
    const sIdSet = new Set(sIds); const cIdSet = new Set(cIds);
    const completions = enrollmentRows.filter((r) => sIdSet.has(r.student_id) && cIdSet.has(r.course_id) && r.status === "completed").length;
    const certs = certRows.filter((r) => sIdSet.has(r.student_id) && cIdSet.has(r.course_id)).length;
    return {
      id: b.id, name: b.name, status: b.status, currency: b.currency,
      students: sIds.length, revenue: revenueByBundle[b.id] ?? 0,
      total_courses: cIds.length, completions, certificates: certs,
    };
  });
}

export default function BundleReportsPage() {
  const { membership } = useWorkspace();
  const wsId = membership?.workspace.id;
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["bundle-report", wsId],
    queryFn: () => loadBundleReport(wsId!),
    enabled: !!wsId,
  });

  const buildExport = () => rows.map((r) => ({
    Bundle: r.name,
    Status: r.status,
    Students: r.students,
    Courses: r.total_courses,
    Completions: r.completions,
    "Completion %": r.students && r.total_courses ? Math.round((r.completions / (r.students * r.total_courses)) * 100) : 0,
    Certificates: r.certificates,
    Revenue: r.revenue,
    Currency: r.currency,
  }));

  return (
    <div className="container mx-auto py-6 space-y-6">
      <PageHeader
        title="Bundle reports"
        description="Performance across all bundles."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => exportToCsv(buildExport(), "bundle-report.csv")}><FileText className="h-4 w-4 mr-2" />CSV</Button>
            <Button variant="outline" onClick={() => exportToXlsx(buildExport(), "bundle-report.xlsx")}><FileSpreadsheet className="h-4 w-4 mr-2" />Excel</Button>
          </div>
        }
      />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bundle</TableHead>
              <TableHead>Students</TableHead>
              <TableHead>Courses</TableHead>
              <TableHead>Completion</TableHead>
              <TableHead>Certificates</TableHead>
              <TableHead>Revenue</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No bundles to report.</TableCell></TableRow>
            ) : rows.map((r) => {
              const completionPct = r.students && r.total_courses ? Math.round((r.completions / (r.students * r.total_courses)) * 100) : 0;
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{r.students}</TableCell>
                  <TableCell>{r.total_courses}</TableCell>
                  <TableCell>{completionPct}%</TableCell>
                  <TableCell>{r.certificates}</TableCell>
                  <TableCell>{r.currency} {r.revenue.toFixed(2)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

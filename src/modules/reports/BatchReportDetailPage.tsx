import { useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Loader2, Search, FileText, AlertTriangle } from "lucide-react";
import PageHeader from "@/modules/shared/PageHeader";
import { fetchBatchDetailReport } from "./batchReportService";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { VALIDITY_OPTIONS } from "@/services/supabase";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";

const PIE_COLORS = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

export default function BatchReportDetailPage() {
  const { id } = useParams();
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["batch-report-detail", id],
    queryFn: () => fetchBatchDetailReport(id!),
    enabled: !!id,
  });

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data?.students ?? [];
    return (data?.students ?? []).filter((s) =>
      [s.name, s.email, s.roll_number, s.registration_number, s.institution]
        .filter(Boolean).some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [data, search]);

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading report…
      </div>
    );
  }

  const { batch, coordinatorName, coordinatorEmail, coordinatorPhone, courses, students, courseAnalytics } = data;
  const validityLabel = VALIDITY_OPTIONS.find((v) => v.value === batch.validity_type)?.label ?? batch.validity_type;
  const institutionCount = new Set(students.map((s) => s.institution).filter(Boolean)).size;

  const completedStudents = students.filter((s) => s.status === "Completed").length;
  const inProgress = students.filter((s) => s.status === "In Progress").length;
  const notStarted = students.filter((s) => s.status === "Not Started").length;
  const expired = students.filter((s) => s.status === "Expired").length;
  const certsIssued = students.reduce((s, x) => s + (x.certificate_status === "Issued" ? 1 : 0), 0);
  const avgCompletion = students.length
    ? Math.round(students.reduce((s, x) => s + x.progress_pct, 0) / students.length)
    : 0;

  const distData = [
    { name: "Not Started", value: notStarted },
    { name: "In Progress", value: inProgress },
    { name: "Completed", value: completedStudents },
    { name: "Expired", value: expired },
  ];

  const handleExportPdf = () => {
    const doc = new jsPDF();
    const coordLine = coordinatorName
      ? `${coordinatorName}${coordinatorEmail ? ` • ${coordinatorEmail}` : ""}${coordinatorPhone ? ` • ${coordinatorPhone}` : ""}`
      : "Not Assigned";
    doc.setFontSize(16);
    doc.text("FAATPRO — Batch Report", 14, 16);
    doc.setFontSize(10);
    doc.text(`Batch: ${batch.name} (${batch.code})`, 14, 24);
    doc.text(`Coordinator: ${coordLine}`, 14, 30);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 36);

    autoTable(doc, {
      startY: 42,
      head: [["Batch Information", ""]],
      body: [
        ["Batch Name", batch.name],
        ["Batch Code", batch.code],
        ["Coordinator", coordinatorName ?? "Not Assigned"],
        ["Coordinator Email", coordinatorEmail ?? "—"],
        ["Coordinator Phone", coordinatorPhone ?? "—"],
        ["Institutions", String(institutionCount)],
        ["Students", String(students.length)],
        ["Assigned Courses", courses.map((c: any) => c.title).join(", ") || "—"],
        ["Course Validity", validityLabel],
        ["Start Date", batch.start_date ?? "—"],
        ["End Date", batch.end_date ?? "—"],
      ],
    });

    autoTable(doc, {
      head: [["Completion Summary", "Value"]],
      body: [
        ["Students", String(students.length)],
        ["Completed", String(completedStudents)],
        ["In Progress", String(inProgress)],
        ["Not Started", String(notStarted)],
        ["Expired", String(expired)],
        ["Avg Completion", `${avgCompletion}%`],
      ],
    });

    autoTable(doc, {
      head: [["Certificate Summary", "Value"]],
      body: [
        ["Issued", String(certsIssued)],
        ["Pending", String(Math.max(0, students.length * (courses.length || 0) - certsIssued))],
      ],
    });

    autoTable(doc, {
      head: [["Student", "Institution", "Progress %", "Certificate", "Status"]],
      body: students.map((s) => [s.name, s.institution ?? "—", `${s.progress_pct}%`, s.certificate_status, s.status]),
    });

    autoTable(doc, {
      head: [["Course", "Enrolled", "Completed", "Avg %", "Certs", "Dropout %"]],
      body: courseAnalytics.map((c) => [c.title, c.enrolled, c.completed, `${c.avg_completion}%`, c.certs, `${c.dropout_rate}%`]),
    });

    doc.save(`${batch.code}-batch-report.pdf`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={batch.name}
        description={`${batch.code} • ${courses.length} courses • ${students.length} students`}
        actions={
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" asChild size="sm">
              <Link to="/app/reports/batches"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Link>
            </Button>
            <Button size="sm" onClick={handleExportPdf}>
              <FileText className="h-4 w-4 mr-1" /> Full PDF
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
        <KpiBox label="Students" value={students.length} />
        <KpiBox label="Completed" value={completedStudents} />
        <KpiBox label="In Progress" value={inProgress} />
        <KpiBox label="Not Started" value={notStarted} />
        <KpiBox label="Expired" value={expired} />
        <KpiBox label="Avg %" value={`${avgCompletion}%`} />
        <KpiBox label="Certificates" value={certsIssued} />
        <KpiBox label="Courses" value={courses.length} />
      </div>

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Batch Info</TabsTrigger>
          <TabsTrigger value="students">Students</TabsTrigger>
          <TabsTrigger value="courses">Course Analytics</TabsTrigger>
          <TabsTrigger value="charts">Charts</TabsTrigger>
        </TabsList>

        <TabsContent value="info">
          <Card className="p-5 space-y-2 text-sm">
            <Field label="Batch Name" value={batch.name} />
            <Field label="Batch Code" value={batch.code} />
            <Field label="Description" value={batch.description ?? "—"} />
            <Field label="Coordinator" value={coordinatorName ?? "Not Assigned"} missing={!coordinatorName} />
            {coordinatorEmail && <Field label="Coordinator Email" value={coordinatorEmail} />}
            {coordinatorPhone && <Field label="Coordinator Phone" value={coordinatorPhone} />}
            <Field label="Institutions" value={String(institutionCount)} />
            <Field label="Students" value={String(students.length)} />
            <Field label="Validity" value={validityLabel} />
            <Field label="Start" value={batch.start_date ?? "—"} />
            <Field label="End" value={batch.end_date ?? "—"} />
            <Field label="Assigned Courses" value={courses.map((c: any) => c.title).join(", ") || "—"} />
          </Card>
        </TabsContent>

        <TabsContent value="students">
          <Card className="p-4 space-y-3">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search students…" className="pl-10" />
            </div>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Institution</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Roll No</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="text-right">Courses</TableHead>
                    <TableHead className="text-right">Done</TableHead>
                    <TableHead className="text-right">Progress %</TableHead>
                    <TableHead>Certificate</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map((s) => (
                    <TableRow key={s.student_id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="text-xs">{s.institution ?? "—"}</TableCell>
                      <TableCell className="text-xs">{s.department ?? "—"}</TableCell>
                      <TableCell className="text-xs">{s.roll_number ?? "—"}</TableCell>
                      <TableCell className="text-xs">{s.email}</TableCell>
                      <TableCell className="text-right">{s.enrolled_courses}</TableCell>
                      <TableCell className="text-right">{s.completed_courses}</TableCell>
                      <TableCell className="text-right">{s.progress_pct}%</TableCell>
                      <TableCell><Badge variant="secondary">{s.certificate_status}</Badge></TableCell>
                      <TableCell className="text-xs">{s.expires_at ? new Date(s.expires_at).toLocaleDateString() : "—"}</TableCell>
                      <TableCell>
                        <Badge variant={s.status === "Completed" ? "default" : s.status === "Expired" ? "destructive" : "secondary"}>
                          {s.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="courses">
          <Card className="p-4">
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Course</TableHead>
                    <TableHead className="text-right">Enrolled</TableHead>
                    <TableHead className="text-right">Started</TableHead>
                    <TableHead className="text-right">In Progress</TableHead>
                    <TableHead className="text-right">Completed</TableHead>
                    <TableHead className="text-right">Avg %</TableHead>
                    <TableHead className="text-right">Certificates</TableHead>
                    <TableHead className="text-right">Dropout %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {courseAnalytics.map((c) => (
                    <TableRow key={c.course_id}>
                      <TableCell className="font-medium">{c.title}</TableCell>
                      <TableCell className="text-right">{c.enrolled}</TableCell>
                      <TableCell className="text-right">{c.started}</TableCell>
                      <TableCell className="text-right">{c.in_progress}</TableCell>
                      <TableCell className="text-right">{c.completed}</TableCell>
                      <TableCell className="text-right">{c.avg_completion}%</TableCell>
                      <TableCell className="text-right">{c.certs}</TableCell>
                      <TableCell className="text-right">{c.dropout_rate}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="charts">
          <div className="grid lg:grid-cols-2 gap-4">
            <Card className="p-4">
              <h3 className="font-medium mb-3">Student Progress Distribution</h3>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={distData} dataKey="value" nameKey="name" outerRadius={100} label>
                    {distData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <RTooltip /><Legend />
                </PieChart>
              </ResponsiveContainer>
            </Card>
            <Card className="p-4">
              <h3 className="font-medium mb-3">Course-wise Avg Completion %</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={courseAnalytics}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="title" tick={{ fontSize: 10 }} />
                  <YAxis />
                  <RTooltip />
                  <Bar dataKey="avg_completion" fill="#2563eb" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card className="p-4 lg:col-span-2">
              <h3 className="font-medium mb-3">Certificates per Course</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={courseAnalytics}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="title" tick={{ fontSize: 10 }} />
                  <YAxis />
                  <RTooltip />
                  <Bar dataKey="certs" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function KpiBox({ label, value }: { label: string; value: any }) {
  return (
    <Card className="p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </Card>
  );
}

function Field({ label, value, missing }: { label: string; value: string; missing?: boolean }) {
  return (
    <div className="flex gap-3">
      <div className="w-40 text-muted-foreground">{label}</div>
      <div className="flex-1 font-medium">
        {missing ? (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="h-3 w-3" /> {value}
          </Badge>
        ) : value}
      </div>
    </div>
  );
}
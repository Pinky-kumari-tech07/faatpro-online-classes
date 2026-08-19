import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Edit, BookOpen, Users, IndianRupee, GraduationCap, Building2, UserPlus, Loader2, Search, PackageOpen, Trash2 } from "lucide-react";
import { useWorkspace } from "@/shared/hooks/useWorkspace";
import PageHeader from "@/modules/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  getBundle, getBundleCourses, bundleStudents, bundleAnalytics,
  enrollStudentInBundle, assignBundleToInstitution,
} from "./bundlesService";
import { format } from "date-fns";

export default function BundleDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { membership } = useWorkspace();
  const wsId = membership?.workspace.id;
  const qc = useQueryClient();
  const [assignOpen, setAssignOpen] = useState(false);
  const [instOpen, setInstOpen] = useState(false);

  const { data: bundle } = useQuery({ queryKey: ["bundle", id], queryFn: () => getBundle(id!), enabled: !!id });
  const { data: courses = [] } = useQuery({ queryKey: ["bundle-courses", id], queryFn: () => getBundleCourses(id!), enabled: !!id });
  const { data: students = [] } = useQuery({ queryKey: ["bundle-students", id], queryFn: () => bundleStudents(id!), enabled: !!id });
  const { data: analytics } = useQuery({ queryKey: ["bundle-analytics", id], queryFn: () => bundleAnalytics(id!), enabled: !!id });

  if (!bundle) return <div className="container mx-auto py-12 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>;

  const totalCourses = courses.length;
  const enrolled = analytics?.enrolled ?? 0;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <PageHeader
        title={bundle.name}
        description={bundle.short_description ?? "Course bundle"}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/app/bundles")}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
            <Button variant="outline" onClick={() => navigate(`/app/bundles/${bundle.id}/edit`)}><Edit className="h-4 w-4 mr-2" />Edit</Button>
            <Button variant="outline" onClick={() => setInstOpen(true)}><Building2 className="h-4 w-4 mr-2" />Assign to institution</Button>
            <Button onClick={() => setAssignOpen(true)}><UserPlus className="h-4 w-4 mr-2" />Assign students</Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<BookOpen />} label="Courses" value={totalCourses} />
        <StatCard icon={<Users />} label="Students" value={enrolled} />
        <StatCard icon={<IndianRupee />} label={`Revenue (${analytics?.currency ?? "INR"})`} value={(analytics?.revenue ?? 0).toFixed(2)} />
        <StatCard icon={<GraduationCap />} label="Status" value={<Badge className="capitalize">{bundle.status}</Badge>} />
      </div>

      <Tabs defaultValue="courses">
        <TabsList>
          <TabsTrigger value="courses">Courses</TabsTrigger>
          <TabsTrigger value="students">Students ({students.length})</TabsTrigger>
          <TabsTrigger value="overview">Overview</TabsTrigger>
        </TabsList>

        <TabsContent value="courses" className="mt-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Course</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Mandatory</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {courses.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No courses added yet.</TableCell></TableRow>
                ) : courses.map((bc: any) => (
                  <TableRow key={bc.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded bg-muted overflow-hidden flex items-center justify-center">
                          {bc.courses?.thumbnail_url ? <img src={bc.courses.thumbnail_url} className="h-full w-full object-cover" /> : <BookOpen className="h-4 w-4 text-muted-foreground" />}
                        </div>
                        <span className="font-medium">{bc.courses?.title}</span>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="secondary" className="capitalize">{bc.courses?.status}</Badge></TableCell>
                    <TableCell>{bc.courses?.currency} {bc.courses?.price_amount}</TableCell>
                    <TableCell>{bc.is_mandatory ? "Yes" : "No"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="students" className="mt-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead>Access</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No students assigned yet.</TableCell></TableRow>
                ) : students.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="font-medium">{s.profiles?.full_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{s.profiles?.email}</div>
                    </TableCell>
                    <TableCell><Badge variant="secondary" className="capitalize">{s.source}</Badge></TableCell>
                    <TableCell>{format(new Date(s.assigned_at), "PP")}</TableCell>
                    <TableCell>{s.access_expires_at ? format(new Date(s.access_expires_at), "PP") : "Lifetime"}</TableCell>
                    <TableCell>
                      <UnassignButton id={s.id} onDone={() => qc.invalidateQueries({ queryKey: ["bundle-students", id] })} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <Card className="p-5">
            <h3 className="font-semibold mb-2">Description</h3>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{bundle.description ?? "—"}</p>
          </Card>
          <Card className="p-5 grid grid-cols-2 gap-3 text-sm">
            <Field label="Access" value={bundle.access_type === "lifetime" ? "Lifetime" : `${bundle.access_duration} ${bundle.access_type}`} />
            <Field label="Certificate" value={bundle.certificate_mode} />
            <Field label="Regular price" value={`${bundle.currency} ${bundle.regular_price}`} />
            <Field label="Sale price" value={bundle.sale_price ? `${bundle.currency} ${bundle.sale_price}` : "—"} />
            <Field label="Category" value={bundle.category ?? "—"} />
            <Field label="Slug" value={bundle.slug} />
          </Card>
        </TabsContent>
      </Tabs>

      <AssignStudentsDialog open={assignOpen} onOpenChange={setAssignOpen} bundleId={bundle.id} workspaceId={wsId!} onDone={() => qc.invalidateQueries({ queryKey: ["bundle-students", id] })} />
      <AssignInstitutionDialog open={instOpen} onOpenChange={setInstOpen} bundleId={bundle.id} workspaceId={wsId!} onDone={() => qc.invalidateQueries({ queryKey: ["bundle-students", id] })} />
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-muted-foreground">{icon}</div>
      </div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium capitalize">{value}</div>
    </div>
  );
}

function UnassignButton({ id, onDone }: { id: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const handle = async () => {
    setBusy(true);
    const { error } = await supabase.from("student_bundles").delete().eq("id", id);
    setBusy(false);
    if (error) return toast({ title: "Remove failed", description: error.message, variant: "destructive" });
    toast({ title: "Removed from bundle" });
    onDone();
  };
  return <Button variant="ghost" size="icon" onClick={handle} disabled={busy}><Trash2 className="h-4 w-4" /></Button>;
}

function AssignStudentsDialog({ open, onOpenChange, bundleId, workspaceId, onDone }: { open: boolean; onOpenChange: (v: boolean) => void; bundleId: string; workspaceId: string; onDone: () => void }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const { data: roster = [] } = useQuery({
    queryKey: ["ws-students", workspaceId],
    queryFn: async () => {
      const { data } = await supabase
        .from("workspace_members")
        .select("profile_id, profiles:profile_id(id, full_name, email)")
        .eq("workspace_id", workspaceId)
        .eq("status", "active")
        .eq("role", "student");
      return (data ?? []).map((m: any) => m.profiles).filter(Boolean);
    },
    enabled: open && !!workspaceId,
  });

  const filtered = roster.filter((r: any) =>
    (r.full_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (r.email ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (sid: string) => setSelected((p) => p.includes(sid) ? p.filter(x => x !== sid) : [...p, sid]);

  const submit = async () => {
    if (!selected.length) return;
    let count = 0;
    for (const sid of selected) {
      try { await enrollStudentInBundle(sid, bundleId, "manual"); count++; } catch (e) { console.error(e); }
    }
    toast({ title: `Assigned ${count} student${count===1?"":"s"}` });
    onDone();
    onOpenChange(false);
    setSelected([]);
    setSearch("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Assign students</DialogTitle><DialogDescription>Selected students will be enrolled in every course of this bundle.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search students..." />
          </div>
          <div className="border rounded-md max-h-72 overflow-y-auto divide-y">
            {filtered.map((s: any) => (
              <button key={s.id} type="button" onClick={() => toggle(s.id)} className={`w-full flex items-center gap-2 p-2 text-left hover:bg-muted/50 ${selected.includes(s.id) ? "bg-primary/5" : ""}`}>
                <input type="checkbox" readOnly checked={selected.includes(s.id)} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{s.full_name ?? "—"}</div>
                  <div className="text-xs text-muted-foreground truncate">{s.email}</div>
                </div>
              </button>
            ))}
            {filtered.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">No students.</div>}
          </div>
          <div className="text-xs text-muted-foreground">{selected.length} selected</div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!selected.length}>Assign</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssignInstitutionDialog({ open, onOpenChange, bundleId, workspaceId, onDone }: { open: boolean; onOpenChange: (v: boolean) => void; bundleId: string; workspaceId: string; onDone: () => void }) {
  const [instId, setInstId] = useState<string>("");
  const [program, setProgram] = useState("");
  const [semester, setSemester] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: institutions = [] } = useQuery({
    queryKey: ["institutions", workspaceId],
    queryFn: async () => {
      const { data } = await supabase.from("institutions").select("id, name").eq("workspace_id", workspaceId).order("name");
      return data ?? [];
    },
    enabled: open && !!workspaceId,
  });

  const submit = async () => {
    if (!instId) return;
    setBusy(true);
    try {
      const n = await assignBundleToInstitution(bundleId, instId, program || null, semester || null);
      toast({ title: `Assigned to ${n} student${n===1?"":"s"}` });
      onDone();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Assign failed", description: e.message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Assign bundle to institution</DialogTitle><DialogDescription>All matching students will be enrolled in every course of this bundle.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Institution</Label>
            <Select value={instId} onValueChange={setInstId}>
              <SelectTrigger><SelectValue placeholder="Select an institution" /></SelectTrigger>
              <SelectContent>
                {institutions.map((i: any) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Program (optional)</Label>
              <Input value={program} onChange={(e) => setProgram(e.target.value)} placeholder="e.g. B.Tech CSE" />
            </div>
            <div className="space-y-2">
              <Label>Semester (optional)</Label>
              <Input value={semester} onChange={(e) => setSemester(e.target.value)} placeholder="e.g. 5" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!instId || busy}>{busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Assign</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

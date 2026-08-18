import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search, Users, Mail, UserPlus, Upload, Download, ArrowUpDown, ArrowUp, ArrowDown,
  MoreHorizontal, Calendar as CalendarIcon, Filter, X,
} from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/shared/hooks/useWorkspace";
import { useAuth } from "@/shared/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import PageHeader from "@/modules/shared/PageHeader";
import AddStudentDialog from "./AddStudentDialog";
import ImportStudentsDialog from "./ImportStudentsDialog";
import EnrollStudentDialog from "./EnrollStudentDialog";
import AssignBundleDialog from "@/modules/bundles/AssignBundleDialog";
import { useManageableCourses } from "@/shared/hooks/useManageableCourses";
import { exportToCsv, exportToXlsx, formatRelativeTime } from "./exportUtils";

type SortKey = "name" | "joined" | "courses" | "progress" | "status" | "lastLogin";
type SortDir = "asc" | "desc";
const PAGE_SIZE = 20;

export default function StudentsPage() {
  const { membership, primaryRole } = useWorkspace();
  const { user } = useAuth();
  const wsId = membership!.workspace.id;
  const canManage = ["organization_admin", "staff", "super_admin"].includes(primaryRole ?? "");
  const canAdministerStudents = ["organization_admin", "super_admin"].includes(primaryRole ?? "");
  const canAddStudent = canAdministerStudents;
  const isInstructor = primaryRole === "instructor";
  const hideContact = isInstructor;
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [searchParams, setSearchParams] = useSearchParams();
  const [courseFilter, setCourseFilter] = useState<string>(() => searchParams.get("course") ?? "all");

  // Keep filter in sync when the URL changes (e.g. deep link from Courses page)
  useEffect(() => {
    const fromUrl = searchParams.get("course");
    if (fromUrl && fromUrl !== courseFilter) setCourseFilter(fromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Reflect the current filter into the URL so the view is shareable
  useEffect(() => {
    const current = searchParams.get("course") ?? "all";
    if (courseFilter === current) return;
    const next = new URLSearchParams(searchParams);
    if (courseFilter === "all") next.delete("course");
    else next.set("course", courseFilter);
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseFilter]);
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [sortKey, setSortKey] = useState<SortKey>("joined");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assignBundle, setAssignBundle] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState<{ row: any } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ ids: string[] } | null>(null);
  const [bulkDeactivate, setBulkDeactivate] = useState(false);
  const [messageTo, setMessageTo] = useState<{ ids: string[] } | null>(null);
  const [messageBody, setMessageBody] = useState("");
  const [open, setOpen] = useState<any>(null);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [enrollStudentId, setEnrollStudentId] = useState<string | undefined>();
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Show students from every course the current user can manage (admins,
  // staff, and instructors — including co-instructed and assigned courses).
  const { courses: manageableCourses, isLoading: manageableLoading } = useManageableCourses();
  const manageableCourseIds = manageableCourses.map((c: any) => c.id);

  const { data: students } = useQuery({
    queryKey: ["students", manageableCourseIds.join(",")],
    enabled: !manageableLoading,
    queryFn: async () => {
      if (manageableCourseIds.length === 0) return [];
      // 1. Pull enrollments for every course the user can manage (across workspaces)
      const eq = supabase
        .from("enrollments")
        .select("id, student_id, course_id, status, enrolled_at, completed_at, courses:course_id(id, title)")
        .in("course_id", manageableCourseIds);
      const { data: enrolls } = await eq.order("enrolled_at", { ascending: false });
      const enrollments = enrolls ?? [];
      if (enrollments.length === 0) return [];

      const studentIds = Array.from(new Set(enrollments.map((e: any) => e.student_id)));
      const courseIds = Array.from(new Set(enrollments.map((e: any) => e.course_id)));

      // 2. Pull student profiles (name only for instructors)
      const profileCols = hideContact
        ? "id, full_name, avatar_url, is_active, status, last_login_at, total_login_count, created_at"
        : "id, full_name, avatar_url, email, phone, is_active, status, last_login_at, total_login_count, created_at";
      const { data: profs } = await supabase
        .from("profiles")
        .select(profileCols)
        .in("id", studentIds);
      const profMap = new Map<string, any>((profs ?? []).map((p: any) => [p.id, p]));

      // 3. Membership for status
      const { data: members } = await supabase
        .from("workspace_members")
        .select("profile_id, status")
        .eq("workspace_id", wsId)
        .eq("role", "student")
        .in("profile_id", studentIds);
      const memberMap = new Map<string, any>((members ?? []).map((m: any) => [m.profile_id, m]));

      // 4. Lesson counts per course
      const { data: lessons } = await supabase
        .from("lessons")
        .select("id, course_id")
        .in("course_id", courseIds);
      const lessonsByCourse = new Map<string, string[]>();
      (lessons ?? []).forEach((l: any) => {
        const arr = lessonsByCourse.get(l.course_id) ?? [];
        arr.push(l.id);
        lessonsByCourse.set(l.course_id, arr);
      });

      // 5. Completed lesson progress for these students
      const { data: progress } = await supabase
        .from("lesson_progress")
        .select("student_id, lesson_id, is_completed")
        .in("student_id", studentIds)
        .eq("is_completed", true);
      const completedSet = new Set<string>();
      (progress ?? []).forEach((p: any) => completedSet.add(`${p.student_id}:${p.lesson_id}`));

      // 6. Group enrollments by student (one row per student)
      const byStudent = new Map<string, any>();
      enrollments.forEach((e: any) => {
        const lessonIds = lessonsByCourse.get(e.course_id) ?? [];
        const total = lessonIds.length;
        const done = lessonIds.filter((lid) => completedSet.has(`${e.student_id}:${lid}`)).length;
        const pct = total === 0 ? 0 : Math.round((done / total) * 100);
        const courseEntry = {
          enrollment_id: e.id,
          course_id: e.course_id,
          course_title: e.courses?.title ?? "—",
          enrolled_at: e.enrolled_at,
          progress_pct: pct,
          status: e.status === "completed" || pct >= 100 ? "completed" : "active",
        };
        const existing = byStudent.get(e.student_id);
        if (existing) {
          existing.courses.push(courseEntry);
          existing.first_enrolled_at = existing.first_enrolled_at < e.enrolled_at ? existing.first_enrolled_at : e.enrolled_at;
        } else {
          const prof = profMap.get(e.student_id);
          const member = memberMap.get(e.student_id);
          byStudent.set(e.student_id, {
            id: e.student_id,
            profile_id: e.student_id,
            profiles: prof,
            member_status: member?.status ?? "active",
            courses: [courseEntry],
            first_enrolled_at: e.enrolled_at,
          });
        }
      });

      const rows = Array.from(byStudent.values()).map((r) => {
        const courseCount = r.courses.length;
        const avgProgress = courseCount
          ? Math.round(r.courses.reduce((s: number, c: any) => s + c.progress_pct, 0) / courseCount)
          : 0;
        const allCompleted = courseCount > 0 && r.courses.every((c: any) => c.status === "completed");
        const isActive = (r.profiles?.is_active ?? true) !== false;
        return {
          ...r,
          course_count: courseCount,
          avg_progress: avgProgress,
          is_active: isActive,
          status: !isActive ? "inactive" : (allCompleted ? "completed" : "active"),
        };
      });

      return rows;
    },
  });

  const { data: courses } = useQuery({
    queryKey: ["courses-min2", wsId, isInstructor ? user?.id : "all", manageableCourseIds.join(",")],
    queryFn: async () => {
      if (isInstructor) {
        // Limit to courses the instructor owns or co-instructs.
        if (manageableCourseIds.length === 0) return [];
        const { data } = await supabase
          .from("courses")
          .select("id, title, slug")
          .in("id", manageableCourseIds)
          .is("deleted_at", null);
        return data ?? [];
      }
      const { data } = await supabase
        .from("courses")
        .select("id, title, slug")
        .eq("workspace_id", wsId)
        .is("deleted_at", null);
      return data ?? [];
    },
  });

  const { data: detail } = useQuery({
    queryKey: ["student-detail", open?.profile_id],
    enabled: !!open,
    queryFn: async () => {
      const sid = open.profile_id;
      const enrollQ = supabase
        .from("enrollments")
        .select("*, courses:course_id(title), bundles:bundle_id(name)")
        .eq("student_id", sid)
        .in("course_id", manageableCourseIds.length ? manageableCourseIds : ["00000000-0000-0000-0000-000000000000"]);
      const [enrollments, attempts, submissions, certs] = await Promise.all([
        enrollQ,
        supabase.from("quiz_attempts").select("*, quizzes:quiz_id(title)").eq("student_id", sid),
        supabase.from("assignment_submissions").select("*, assignments:assignment_id(title, max_points)").eq("student_id", sid),
        supabase.from("certificates").select("course_id, issued_at").eq("student_id", sid),
      ]);
      return {
        enrollments: enrollments.data ?? [],
        attempts: attempts.data ?? [],
        submissions: submissions.data ?? [],
        certs: certs.data ?? [],
      };
    },
  });

  const setActive = useMutation({
    mutationFn: async ({ ids, value }: { ids: string[]; value: boolean }) => {
      if (!canAdministerStudents) throw new Error("403 Forbidden");
      const { error } = await supabase
        .from("profiles")
        .update({ is_active: value })
        .in("id", ids);
      if (error) throw error;
      return { ids, value };
    },
    onSuccess: ({ ids, value }) => {
      toast({
        title: value ? "Student activated" : "Student deactivated",
        description: value
          ? `${ids.length} ${ids.length === 1 ? "student" : "students"} can now log in.`
          : `${ids.length} ${ids.length === 1 ? "student" : "students"} can no longer access the LMS.`,
      });
      qc.invalidateQueries({ queryKey: ["students"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const resetPassword = useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
    },
    onSuccess: () => toast({ title: "Reset link sent", description: "Student will receive an email to reset their password." }),
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const sendMessage = useMutation({
    mutationFn: async ({ ids, body }: { ids: string[]; body: string }) => {
      const me = user!.id;
      // For each recipient: create (or reuse) a 1:1 conversation, insert the
      // message, and drop an in-app notification so the student sees it in
      // Messages AND in the bell dropdown.
      for (const id of ids) {
        if (id === me) continue;
        // Atomically find-or-create the single 1:1 thread for this pair.
        const { data: convId, error: rpcErr } = await supabase.rpc(
          "get_or_create_direct_conversation",
          { _workspace_id: wsId, _other_user: id },
        );
        if (rpcErr) throw rpcErr;
        const { error: mErr } = await supabase.from("messages").insert({
          workspace_id: wsId, conversation_id: convId, sender_id: me, body,
        });
        if (mErr) throw mErr;
        await supabase.from("conversations")
          .update({ last_message_at: new Date().toISOString() })
          .eq("id", convId);
        await supabase.from("notifications").insert({
          workspace_id: wsId,
          profile_id: id,
          channel: "in_app",
          event_type: "admin_message",
          title: "New message",
          body,
          source_id: convId,
        });
      }
    },
    onSuccess: () => {
      toast({ title: "Message sent" });
      setMessageTo(null); setMessageBody("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteStudents = useMutation({
    mutationFn: async (ids: string[]) => {
      if (!canAdministerStudents) throw new Error("403 Forbidden");
      // Full soft-delete: deactivates the account and purges transactional
      // data (enrollments, progress, quiz attempts, submissions, messages,
      // notifications, cart/wishlist, discussions, attendance, live class
      // registrations, support tickets). Financial/audit records are kept.
      for (const id of ids) {
        const { error } = await (supabase as any).rpc("admin_soft_delete_student", {
          _student_id: id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "Students removed" });
      setSelected(new Set());
      qc.invalidateQueries();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // ---------- Filtering & sorting ----------
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (students ?? []).filter((r: any) => {
      // Never show soft-deleted profiles anywhere in the student list.
      if (r.profiles?.status === "deleted") return false;
      if (status === "active" && !r.is_active) return false;
      if (status === "inactive" && r.is_active) return false;
      if (status === "completed" && r.status !== "completed") return false;
      if (courseFilter !== "all" && !r.courses.some((c: any) => c.course_id === courseFilter)) return false;
      const enrolled = new Date(r.first_enrolled_at);
      if (dateFrom && enrolled < dateFrom) return false;
      if (dateTo) {
        const end = new Date(dateTo); end.setHours(23, 59, 59, 999);
        if (enrolled > end) return false;
      }
      if (!term) return true;
      return (
        (r.profiles?.full_name ?? "").toLowerCase().includes(term) ||
        r.courses.some((c: any) => c.course_title.toLowerCase().includes(term)) ||
        (!hideContact && (r.profiles?.email ?? "").toLowerCase().includes(term))
      );
    });
  }, [students, search, status, courseFilter, dateFrom, dateTo, hideContact]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a: any, b: any) => {
      let av: any; let bv: any;
      switch (sortKey) {
        case "name": av = a.profiles?.full_name ?? ""; bv = b.profiles?.full_name ?? ""; break;
        case "joined": av = a.first_enrolled_at; bv = b.first_enrolled_at; break;
        case "courses": av = a.course_count; bv = b.course_count; break;
        case "progress": av = a.avg_progress; bv = b.avg_progress; break;
        case "status": av = a.status; bv = b.status; break;
        case "lastLogin": av = a.profiles?.last_login_at ?? ""; bv = b.profiles?.last_login_at ?? ""; break;
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageStart = (page - 1) * PAGE_SIZE;
  const pageRows = sorted.slice(pageStart, pageStart + PAGE_SIZE);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("asc"); }
  };
  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey !== k ? <ArrowUpDown className="h-3 w-3 opacity-50" />
      : sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;

  const allOnPageSelected = pageRows.length > 0 && pageRows.every((r: any) => selected.has(r.id));
  const togglePageSelection = () => {
    const next = new Set(selected);
    if (allOnPageSelected) pageRows.forEach((r: any) => next.delete(r.id));
    else pageRows.forEach((r: any) => next.add(r.id));
    setSelected(next);
  };

  const buildExportRows = (rows: any[]) => rows.map((r: any) => ({
    "Student Name": r.profiles?.full_name ?? "",
    "Email": hideContact ? "" : (r.profiles?.email ?? ""),
    "Mobile": hideContact ? "" : (r.profiles?.phone ?? ""),
    "Status": r.is_active ? (r.status === "completed" ? "Completed" : "Active") : "Inactive",
    "Courses": r.courses.map((c: any) => c.course_title).join("; "),
    "Total Courses": r.course_count,
    "Progress (%)": r.avg_progress,
    "Enrollment Date": r.first_enrolled_at ? new Date(r.first_enrolled_at).toLocaleDateString() : "",
    "Last Login": r.profiles?.last_login_at ? new Date(r.profiles.last_login_at).toLocaleString() : "",
    "Total Login Count": r.profiles?.total_login_count ?? 0,
  }));

  const exportRows = (scope: "all" | "filtered" | "page", fmt: "csv" | "xlsx") => {
    const src = scope === "all" ? (students ?? []) : scope === "filtered" ? sorted : pageRows;
    const rows = buildExportRows(src);
    const ts = format(new Date(), "yyyyMMdd-HHmm");
    const name = `students-${scope}-${ts}`;
    if (fmt === "csv") exportToCsv(rows, name);
    else exportToXlsx(rows, name, "Students");
  };

  const clearFilters = () => {
    setSearch(""); setStatus("all"); setCourseFilter("all");
    setDateFrom(undefined); setDateTo(undefined); setPage(1);
  };
  const activeFilterCount =
    (search ? 1 : 0) + (status !== "all" ? 1 : 0) + (courseFilter !== "all" ? 1 : 0)
    + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0);

  return (
    <TooltipProvider delayDuration={150}>
    <div className="space-y-4 max-w-7xl">
      <PageHeader
        title="Students"
        description="Manage your learner directory, view progress and enroll students in courses."
        actions={canManage && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4 mr-1" /> Import students
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline"><Download className="h-4 w-4 mr-1" /> Export</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-popover">
                <DropdownMenuLabel>Export students</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => exportRows("all", "csv")}>All students (CSV)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportRows("all", "xlsx")}>All students (Excel)</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => exportRows("filtered", "csv")}>Filtered ({sorted.length}) — CSV</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportRows("filtered", "xlsx")}>Filtered ({sorted.length}) — Excel</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => exportRows("page", "csv")}>Current page — CSV</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportRows("page", "xlsx")}>Current page — Excel</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" onClick={() => setEnrollOpen(true)}>
              <Mail className="h-4 w-4 mr-1" /> Enroll student
            </Button>
            {canAddStudent && (
              <Button onClick={() => setAddOpen(true)}>
                <UserPlus className="h-4 w-4 mr-1" /> Add student
              </Button>
            )}
          </div>
        )}
      />

      {/* Filters bar (desktop inline / mobile drawer) */}
      <Card className="p-3 border-border shadow-none">
        <div className="hidden md:flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder={hideContact ? "Search by student or course…" : "Search by name, email or course…"}
              className="pl-9 h-9" />
          </div>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={courseFilter} onValueChange={(v) => { setCourseFilter(v); setPage(1); }}>
            <SelectTrigger className="w-48 h-9"><SelectValue placeholder="Course" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All courses</SelectItem>
              {(courses ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
            </SelectContent>
          </Select>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9">
                <CalendarIcon className="h-4 w-4 mr-1" />
                {dateFrom || dateTo
                  ? `${dateFrom ? format(dateFrom, "MMM d") : "…"} – ${dateTo ? format(dateTo, "MMM d") : "…"}`
                  : "Date range"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-3 bg-popover" align="start">
              <div className="flex gap-3">
                <div>
                  <div className="text-xs font-medium mb-1">From</div>
                  <Calendar mode="single" selected={dateFrom} onSelect={(d) => { setDateFrom(d ?? undefined); setPage(1); }} className="pointer-events-auto" />
                </div>
                <div>
                  <div className="text-xs font-medium mb-1">To</div>
                  <Calendar mode="single" selected={dateTo} onSelect={(d) => { setDateTo(d ?? undefined); setPage(1); }} className="pointer-events-auto" />
                </div>
              </div>
              {(dateFrom || dateTo) && (
                <Button variant="ghost" size="sm" className="mt-2"
                  onClick={() => { setDateFrom(undefined); setDateTo(undefined); }}>Clear dates</Button>
              )}
            </PopoverContent>
          </Popover>
          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" className="h-9" onClick={clearFilters}>
              <X className="h-3.5 w-3.5 mr-1" /> Clear
            </Button>
          )}
          <div className="ml-auto text-xs text-muted-foreground">
            {sorted.length} of {students?.length ?? 0}
          </div>
        </div>
        {/* Mobile: filter drawer trigger */}
        <div className="md:hidden flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search…" className="pl-9 h-9" />
          </div>
          <Button variant="outline" size="sm" onClick={() => setFiltersOpen(true)}>
            <Filter className="h-4 w-4 mr-1" />
            {activeFilterCount > 0 ? `Filters (${activeFilterCount})` : "Filters"}
          </Button>
        </div>
      </Card>

      {/* Bulk action bar */}
      {selected.size > 0 && canManage && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-primary/10 border border-primary/20">
          <span className="text-sm font-medium">{selected.size} selected</span>
          {canAdministerStudents && (
            <>
              <Button size="sm" variant="outline" onClick={() => setActive.mutate({ ids: Array.from(selected), value: true })}>
                Activate
              </Button>
              <Button size="sm" variant="outline" onClick={() => setBulkDeactivate(true)}>
                Deactivate
              </Button>
            </>
          )}
          <Button size="sm" variant="outline" onClick={() => {
            const rows = (students ?? []).filter((s: any) => selected.has(s.id));
            exportToCsv(buildExportRows(rows), `students-selected-${format(new Date(), "yyyyMMdd-HHmm")}`);
          }}>
            Export
          </Button>
          <Button size="sm" variant="outline" onClick={() => setMessageTo({ ids: Array.from(selected) })}>
            Send message
          </Button>
          <Button size="sm" variant="outline" onClick={() => setAssignBundle(true)}>
            Assign bundle
          </Button>
          {canAdministerStudents && (
            <Button size="sm" variant="outline" className="text-destructive" onClick={() => setConfirmDelete({ ids: Array.from(selected) })}>
              Delete
            </Button>
          )}
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
      )}

      {/* Desktop table */}
      <Card className="border-border shadow-none hidden md:block overflow-hidden">
        <div className="max-h-[calc(100vh-280px)] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow>
                {canManage && (
                  <TableHead className="w-10">
                    <Checkbox checked={allOnPageSelected} onCheckedChange={togglePageSelection} aria-label="Select page" />
                  </TableHead>
                )}
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("name")}>
                  <span className="inline-flex items-center gap-1">Name <SortIcon k="name" /></span>
                </TableHead>
                {!hideContact && <TableHead className="max-w-[200px]">Email</TableHead>}
                {!hideContact && <TableHead className="w-[120px]">Mobile</TableHead>}
                <TableHead className="max-w-[260px]">Enrolled courses</TableHead>
                <TableHead className="w-[90px] cursor-pointer select-none" onClick={() => toggleSort("courses")}>
                  <span className="inline-flex items-center gap-1">Total <SortIcon k="courses" /></span>
                </TableHead>
                <TableHead className="w-[150px] cursor-pointer select-none" onClick={() => toggleSort("progress")}>
                  <span className="inline-flex items-center gap-1">Progress <SortIcon k="progress" /></span>
                </TableHead>
                <TableHead className="w-[120px] cursor-pointer select-none" onClick={() => toggleSort("joined")}>
                  <span className="inline-flex items-center gap-1">Joined <SortIcon k="joined" /></span>
                </TableHead>
                <TableHead className="w-[130px] cursor-pointer select-none" onClick={() => toggleSort("lastLogin")}>
                  <span className="inline-flex items-center gap-1">Last login <SortIcon k="lastLogin" /></span>
                </TableHead>
                <TableHead className="w-[90px] cursor-pointer select-none" onClick={() => toggleSort("status")}>
                  <span className="inline-flex items-center gap-1">Status <SortIcon k="status" /></span>
                </TableHead>
                <TableHead className="w-[60px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map((s: any) => {
                const visible = s.courses.slice(0, 2);
                const extra = s.courses.length - visible.length;
                return (
                  <TableRow key={s.id} className={cn("hover:bg-muted/40", !s.is_active && "opacity-70")}>
                    {canManage && (
                      <TableCell className="w-10" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selected.has(s.id)}
                          onCheckedChange={(v) => {
                            const next = new Set(selected);
                            if (v) next.add(s.id); else next.delete(s.id);
                            setSelected(next);
                          }}
                        />
                      </TableCell>
                    )}
                    <TableCell className="py-2">
                      <button className="text-left font-medium truncate max-w-[180px] hover:underline" onClick={() => setOpen(s)}>
                        {s.profiles?.full_name ?? "Unnamed"}
                      </button>
                    </TableCell>
                    {!hideContact && <TableCell className="text-xs text-muted-foreground truncate max-w-[200px]">{s.profiles?.email ?? "—"}</TableCell>}
                    {!hideContact && <TableCell className="text-xs">{s.profiles?.phone ?? "—"}</TableCell>}
                    <TableCell className="py-2">
                      <div className="flex flex-wrap gap-1 max-w-[260px]">
                        {visible.map((c: any) => (
                          <Badge key={c.enrollment_id} variant="outline" className="font-normal text-[11px] py-0">
                            <span className="truncate max-w-[100px]">{c.course_title}</span>
                          </Badge>
                        ))}
                        {extra > 0 && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="secondary" className="text-[11px] py-0 cursor-help">+{extra}</Badge>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <div className="text-xs">
                                {s.courses.map((c: any) => <div key={c.enrollment_id}>{c.course_title}</div>)}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">{s.course_count}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={s.avg_progress} className="h-1.5 w-20" />
                        <span className="text-[11px] tabular-nums text-muted-foreground w-8">{s.avg_progress}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">{s.first_enrolled_at ? new Date(s.first_enrolled_at).toLocaleDateString() : "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatRelativeTime(s.profiles?.last_login_at)}</TableCell>
                    <TableCell>
                      {canAdministerStudents ? (
                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <Switch
                            checked={s.is_active}
                            onCheckedChange={(v) => {
                              if (!v) setConfirmDeactivate({ row: s });
                              else setActive.mutate({ ids: [s.id], value: true });
                            }}
                          />
                          <span className="text-[11px] text-muted-foreground">{s.is_active ? "On" : "Off"}</span>
                        </div>
                      ) : (
                        <Badge variant={s.is_active ? "default" : "secondary"}>{s.is_active ? "Active" : "Inactive"}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover">
                          <DropdownMenuItem onClick={() => setOpen(s)}>View profile</DropdownMenuItem>
                          {canManage && (
                            <DropdownMenuItem onClick={() => { setEnrollStudentId(s.id); setEnrollOpen(true); }}>
                              Enroll Student
                            </DropdownMenuItem>
                          )}
                          {canManage && (
                            <DropdownMenuItem onClick={() => { setEnrollStudentId(s.id); setEnrollOpen(true); }}>
                              Assign to Batch
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => setOpen(s)}>View enrollments</DropdownMenuItem>
                          {canAdministerStudents && s.profiles?.email && (
                            <DropdownMenuItem onClick={() => resetPassword.mutate(s.profiles.email)}>
                              Reset password
                            </DropdownMenuItem>
                          )}
                          {canManage && (
                            <DropdownMenuItem onClick={() => setMessageTo({ ids: [s.id] })}>
                              Send message
                            </DropdownMenuItem>
                          )}
                          {canAdministerStudents && (
                            <>
                              <DropdownMenuSeparator />
                              {s.is_active ? (
                                <DropdownMenuItem onClick={() => setConfirmDeactivate({ row: s })}>Deactivate</DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem onClick={() => setActive.mutate({ ids: [s.id], value: true })}>Activate</DropdownMenuItem>
                              )}
                              <DropdownMenuItem className="text-destructive" onClick={() => setConfirmDelete({ ids: [s.id] })}>
                                Delete
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
              {pageRows.length === 0 && (
                <TableRow><TableCell colSpan={hideContact ? 9 : 11} className="text-center py-12 text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" /> No students match your filters.
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        {sorted.length > PAGE_SIZE && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-border text-xs">
            <span className="text-muted-foreground">Page {page} of {totalPages}</span>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</Button>
              <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</Button>
            </div>
          </div>
        )}
      </Card>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {pageRows.map((s: any) => (
          <Card key={s.id} className="p-3 border-border shadow-none">
            <div className="flex items-start justify-between gap-2">
              <button className="text-left font-medium" onClick={() => setOpen(s)}>{s.profiles?.full_name ?? "Unnamed"}</button>
              {canAdministerStudents && (
                <Switch
                  checked={s.is_active}
                  onCheckedChange={(v) => {
                    if (!v) setConfirmDeactivate({ row: s });
                    else setActive.mutate({ ids: [s.id], value: true });
                  }}
                />
              )}
            </div>
            {!hideContact && <div className="text-xs text-muted-foreground truncate">{s.profiles?.email}</div>}
            <div className="mt-2 flex items-center gap-2 text-xs">
              <span className="tabular-nums">{s.course_count} courses</span>
              <Progress value={s.avg_progress} className="h-1.5 flex-1" />
              <span className="tabular-nums">{s.avg_progress}%</span>
            </div>
            <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
              <span>Joined {s.first_enrolled_at ? new Date(s.first_enrolled_at).toLocaleDateString() : "—"}</span>
              <span>Last login: {formatRelativeTime(s.profiles?.last_login_at)}</span>
            </div>
          </Card>
        ))}
        {pageRows.length === 0 && (
          <Card className="p-8 text-center text-muted-foreground">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-50" /> No students match your filters.
          </Card>
        )}
      </div>

      <Sheet open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <SheetContent className="sm:max-w-xl overflow-y-auto">
          <SheetHeader><SheetTitle>{open?.profiles?.full_name ?? "Student"}</SheetTitle></SheetHeader>
          <div className="mt-6 space-y-6">
            <div>
              <h3 className="text-sm font-semibold mb-2">Active enrollments ({detail?.enrollments.length ?? 0})</h3>
              <div className="space-y-2">
                {(detail?.enrollments ?? []).map((e: any) => {
                  const expires = e.access_expires_at ? new Date(e.access_expires_at) : null;
                  const remaining = expires ? Math.max(0, Math.ceil((expires.getTime() - Date.now()) / 86400000)) : null;
                  const hasCert = (detail?.certs ?? []).some((c: any) => c.course_id === e.course_id);
                  const sourceLabels: Record<string,string> = {
                    individual: "Self Purchase",
                    admin_assigned: "Manual (Admin)",
                    bulk_import: "Batch Import",
                    corporate: "Corporate",
                    college: "College",
                  };
                  return (
                    <div key={e.id} className="p-3 border border-border rounded-md text-sm space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium truncate">{e.courses?.title ?? e.bundles?.name ?? "—"}</div>
                        <Badge variant={e.status === "completed" ? "default" : "secondary"}>{e.status}</Badge>
                      </div>
                      {e.bundles?.name && (
                        <div className="text-[11px] text-muted-foreground">From bundle: {e.bundles.name}</div>
                      )}
                      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground">
                        <span>Enrolled: {e.enrolled_at ? new Date(e.enrolled_at).toLocaleDateString() : "—"}</span>
                        <span>Expires: {expires ? expires.toLocaleDateString() : "Lifetime"}</span>
                        <span>Remaining: {remaining === null ? "∞" : `${remaining} days`}</span>
                        <span>Source: {sourceLabels[e.enrollment_type] ?? e.enrollment_type}</span>
                        <span>Certificate: {hasCert ? "Issued" : "—"}</span>
                      </div>
                    </div>
                  );
                })}
                {(detail?.enrollments ?? []).length === 0 && <div className="text-sm text-muted-foreground">No enrollments yet.</div>}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold mb-2">Quiz performance ({detail?.attempts.length ?? 0})</h3>
              <div className="space-y-2">
                {(detail?.attempts ?? []).map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between p-3 border border-border rounded-md text-sm">
                    <span>{a.quizzes?.title}</span>
                    <span className="font-semibold">{a.score} / {a.max_score}</span>
                  </div>
                ))}
                {(detail?.attempts ?? []).length === 0 && <div className="text-sm text-muted-foreground">No attempts.</div>}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold mb-2">Assignment submissions ({detail?.submissions.length ?? 0})</h3>
              <div className="space-y-2">
                {(detail?.submissions ?? []).map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between p-3 border border-border rounded-md text-sm">
                    <span>{s.assignments?.title}</span>
                    <span className="font-semibold">{s.grade ?? "—"} / {s.assignments?.max_points}</span>
                  </div>
                ))}
                {(detail?.submissions ?? []).length === 0 && <div className="text-sm text-muted-foreground">No submissions.</div>}
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {canManage && (
        <EnrollStudentDialog
          open={enrollOpen}
          onOpenChange={(v) => { setEnrollOpen(v); if (!v) setEnrollStudentId(undefined); }}
          workspaceId={wsId}
          defaultStudentId={enrollStudentId}
        />
      )}

      {canAddStudent && (
        <>
          <AddStudentDialog
            open={addOpen}
            onOpenChange={setAddOpen}
            workspaceId={wsId}
            courses={(courses ?? []) as any}
          />
        </>
      )}

      {canManage && (
        <>
          <ImportStudentsDialog
            open={importOpen}
            onOpenChange={setImportOpen}
            workspaceId={wsId}
            courses={(courses ?? []) as any}
          />
        </>
      )}

      {/* Mobile filters drawer */}
      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="bottom" className="h-[85vh]">
          <SheetHeader><SheetTitle>Filters</SheetTitle></SheetHeader>
          <div className="mt-4 space-y-3">
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Course</Label>
              <Select value={courseFilter} onValueChange={(v) => { setCourseFilter(v); setPage(1); }}>
                <SelectTrigger><SelectValue placeholder="Course" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All courses</SelectItem>
                  {(courses ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={clearFilters}>Clear all</Button>
              <Button className="flex-1" onClick={() => setFiltersOpen(false)}>Apply</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Single deactivate confirm */}
      <AlertDialog open={!!confirmDeactivate} onOpenChange={(v) => !v && setConfirmDeactivate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate this student?</AlertDialogTitle>
            <AlertDialogDescription>
              They will not be able to log in until reactivated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDeactivate) {
                  setActive.mutate({ ids: [confirmDeactivate.row.id], value: false });
                  setConfirmDeactivate(null);
                }
              }}
            >Deactivate</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk deactivate confirm */}
      <AlertDialog open={bulkDeactivate} onOpenChange={setBulkDeactivate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate {selected.size} students?</AlertDialogTitle>
            <AlertDialogDescription>None of them will be able to log in until reactivated.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setActive.mutate({ ids: Array.from(selected), value: false });
              setBulkDeactivate(false); setSelected(new Set());
            }}>Deactivate all</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirm */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {confirmDelete?.ids.length ?? 0} student(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              This soft-deletes the account and revokes login access. Their enrollment history is preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (confirmDelete) {
                  deleteStudents.mutate(confirmDelete.ids);
                  setConfirmDelete(null);
                }
              }}
            >Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Send message dialog */}
      <Dialog open={!!messageTo} onOpenChange={(v) => { if (!v) { setMessageTo(null); setMessageBody(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send message</DialogTitle>
            <DialogDescription>
              Starts (or continues) a direct conversation with {messageTo?.ids.length ?? 0} student(s). They'll see it in Messages and get a bell notification.
            </DialogDescription>
          </DialogHeader>
          <textarea
            value={messageBody}
            onChange={(e) => setMessageBody(e.target.value)}
            rows={5}
            className="w-full border border-border rounded-md p-2 text-sm bg-background"
            placeholder="Type your message…"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setMessageTo(null); setMessageBody(""); }}>Cancel</Button>
            <Button
              disabled={!messageBody.trim() || !messageTo}
              onClick={() => sendMessage.mutate({ ids: messageTo!.ids, body: messageBody.trim() })}
            >Send</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AssignBundleDialog
        open={assignBundle}
        onOpenChange={setAssignBundle}
        studentIds={Array.from(selected)}
        onAssigned={() => setSelected(new Set())}
      />
    </div>
    </TooltipProvider>
  );
}
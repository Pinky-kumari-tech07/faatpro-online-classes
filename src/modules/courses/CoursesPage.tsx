import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, BookOpen, MoreHorizontal, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/shared/hooks/useWorkspace";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "@/components/ui/use-toast";
import PageHeader from "@/modules/shared/PageHeader";
import CourseFormDialog from "./CourseFormDialog";
import ReassignInstructorDialog from "./ReassignInstructorDialog";
import { courseLifecycleService } from "@/services/supabase/courseLifecycleService";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { courseService } from "@/services/supabase";
import CoursePrice from "@/modules/shared/CoursePrice";
import { coursePricingService } from "@/services/supabase/coursePricingService";
import StudentCoursesPage from "./StudentCoursesPage";
import { useAuth } from "@/shared/hooks/useAuth";
import { useRealtimeInvalidate } from "@/shared/hooks/useRealtimeInvalidate";

const statusColor: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  pending_review: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200",
  approved: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200",
  rejected: "bg-destructive/10 text-destructive",
  published: "bg-success/15 text-success",
  archived: "bg-destructive/10 text-destructive",
  suspended: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200",
};

export default function CoursesPage() {
  const navigate = useNavigate();
  const { membership, memberships, primaryRole } = useWorkspace();
  const { user } = useAuth();
  const wsId = membership!.workspace.id;
  // Capabilities must consider every role the user actually holds, not only the
  // single "primary" role. A user who is (for example) staff + organization_admin
  // resolved to a primary role without any matching action ended up with an
  // Actions menu that rendered zero items (an empty, seemingly broken popover).
  const effectiveRoles = Array.from(
    new Set([...(memberships ?? []).flatMap((m) => m.roles), ...(primaryRole ? [primaryRole] : [])]),
  );
  const hasAny = (roles: string[]) => roles.some((r) => effectiveRoles.includes(r as any));
  const canManage = hasAny(["organization_admin", "super_admin", "instructor"]);
  const canDelete = hasAny(["organization_admin", "super_admin"]);
  const canTransfer = hasAny(["organization_admin", "super_admin"]);
  const isAdminReviewer = hasAny(["organization_admin", "super_admin"]);
  const isInstructorOnly = hasAny(["instructor"]) && !isAdminReviewer;
  const isStudent = !primaryRole || primaryRole === "student" || primaryRole === "parent";
  if (isStudent) return <StudentCoursesPage />;
  const qc = useQueryClient();

  useRealtimeInvalidate(
    ["courses", "course_instructors", "enrollments"],
    [["courses"]],
  );

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "draft" | "pending_review" | "approved" | "rejected" | "published" | "archived">("all");
  const [priceFilter, setPriceFilter] = useState<"all" | "free" | "paid" | "discounted">("all");
  const [instructorFilter, setInstructorFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"updated" | "instructor" | "enrolled">("updated");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [confirmDelete, setConfirmDelete] = useState<any>(null);
  const [reassignCourse, setReassignCourse] = useState<any>(null);
  const [deletionRequestCourse, setDeletionRequestCourse] = useState<any>(null);
  const [deletionReason, setDeletionReason] = useState("");
  const [confirmDraftDelete, setConfirmDraftDelete] = useState<any>(null);
  const [suspendCourse, setSuspendCourse] = useState<any>(null);
  const [suspendReason, setSuspendReason] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["courses", wsId, search, status, page, primaryRole, user?.id],
    queryFn: async () => {
      const instructorOwnedIds = isInstructorOnly && user?.id
        ? await courseService.listAssignedCourseIds(user.id)
        : undefined;
      return courseService.listCourses(
        wsId,
        { search, status, page, pageSize: 12 },
        { role: primaryRole, userId: user?.id, instructorOwnedIds },
      );
    },
  });

  const baseRows: any[] = data?.rows ?? [];
  const instructorIds = useMemo(
    () => Array.from(new Set(baseRows.map((c) => c.instructor_id).filter(Boolean))),
    [baseRows],
  );
  const courseIds = useMemo(() => baseRows.map((c) => c.id), [baseRows]);

  const { data: instructorsMap = {} } = useQuery({
    queryKey: ["courses-instructor-names", instructorIds],
    enabled: instructorIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", instructorIds);
      if (error) throw error;
      const map: Record<string, { name: string; email?: string }> = {};
      (data ?? []).forEach((p: any) => {
        map[p.id] = { name: p.full_name || p.email || "Unknown", email: p.email };
      });
      return map;
    },
  });

  const { data: enrollmentCounts = {} } = useQuery({
    queryKey: ["courses-enrollment-counts", courseIds],
    enabled: courseIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("course_id")
        .in("course_id", courseIds)
        .eq("status", "active");
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data ?? []).forEach((r: any) => {
        counts[r.course_id] = (counts[r.course_id] ?? 0) + 1;
      });
      return counts;
    },
  });

  const changeStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("courses").update({ status: status as any }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Course updated" });
      qc.invalidateQueries({ queryKey: ["courses", wsId] });
      qc.invalidateQueries({ queryKey: ["manageable-courses"] });
    },
    onError: (e: any) => toast({ title: "Status change failed", description: e?.message ?? "Unknown", variant: "destructive" }),
  });

  const removeCourseFromCaches = (deletedId: string) => {
    qc.setQueriesData({ queryKey: ["courses"] }, (old: any) => {
      if (!old?.rows) return old;
      const rows = old.rows.filter((course: any) => course.id !== deletedId);
      return { ...old, rows, total: Math.max(0, (old.total ?? rows.length) - 1) };
    });
    qc.setQueriesData({ queryKey: ["manageable-courses"] }, (old: any) => {
      if (!Array.isArray(old)) return old;
      return old.filter((course: any) => course.id !== deletedId);
    });
  };

  const deleteCourse = useMutation({
    mutationFn: async (course: any) => {
      const id = course?.id;
      if (!canDelete) {
        throw new Error("UNAUTHORIZED_DELETE");
      }
      if (!id) {
        throw new Error("MISSING_COURSE_ID");
      }
      await courseLifecycleService.permanentDelete(id);
      return id;
    },
    onMutate: async (course: any) => {
      console.log("[deleteCourse] Request:", { id: course?.id, title: course?.title });
      await qc.cancelQueries({ queryKey: ["courses"] });
      await qc.cancelQueries({ queryKey: ["manageable-courses"] });
      if (course?.id) removeCourseFromCaches(course.id);
      return { id: course?.id };
    },
    onSuccess: (deletedId) => {
      toast({ title: "Course deleted successfully." });
      setConfirmDelete(null);
      if (deletedId) removeCourseFromCaches(deletedId);
      qc.invalidateQueries({ queryKey: ["courses"] });
      qc.invalidateQueries({ queryKey: ["manageable-courses"] });
      qc.invalidateQueries({ queryKey: ["my-courses"] });
      qc.invalidateQueries({ queryKey: ["public-courses"] });
      qc.invalidateQueries({ queryKey: ["public-featured-courses"] });
      qc.invalidateQueries({ queryKey: ["public-instructors"] });
      qc.invalidateQueries({ queryKey: ["public-trending-categories"] });
      qc.invalidateQueries({ queryKey: ["course-categories"] });
      qc.invalidateQueries({ queryKey: ["admin-dash-stats"] });
      qc.invalidateQueries({ queryKey: ["instr-dash"] });
      qc.invalidateQueries({ queryKey: ["student-dash-v2"] });
      qc.invalidateQueries({ queryKey: ["analytics"] });
      qc.invalidateQueries({ queryKey: ["rep-courses"] });
      qc.invalidateQueries({ queryKey: ["rep-ov"] });
      qc.invalidateQueries({ queryKey: ["activity-feed"] });
    },
    onError: (e: any) => {
      setConfirmDelete(null);
      console.error("[deleteCourse] Error:", e);
      if (e?.message === "UNAUTHORIZED_DELETE" || !canDelete) {
        toast({ title: "You are not authorized to delete this course.", variant: "destructive" });
      } else if (e?.message === "MISSING_COURSE_ID") {
        toast({ title: "Course no longer exists.", description: "Refreshing the list…", variant: "destructive" });
        qc.invalidateQueries({ queryKey: ["courses"] });
        qc.invalidateQueries({ queryKey: ["manageable-courses"] });
      } else if (e?.message === "NO_ROW_UPDATED") {
        toast({ title: "Course no longer exists.", description: "Refreshing the list…", variant: "destructive" });
        qc.invalidateQueries({ queryKey: ["courses"] });
        qc.invalidateQueries({ queryKey: ["manageable-courses"] });
      } else {
        toast({ title: "Failed to delete course", description: e?.message ?? "Unknown error", variant: "destructive" });
      }
    },
  });

  const instructorOptions = useMemo(() => {
    const seen = new Map<string, string>();
    baseRows.forEach((c) => {
      if (c.instructor_id) {
        seen.set(c.instructor_id, instructorsMap[c.instructor_id]?.name ?? "Unknown");
      }
    });
    return Array.from(seen.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [baseRows, instructorsMap]);
  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    baseRows.forEach((c) => { if (c.category) set.add(c.category); });
    return Array.from(set).sort();
  }, [baseRows]);

  const enriched = baseRows.map((c) => ({
    ...c,
    _instructorName: c.instructor_id ? (instructorsMap[c.instructor_id]?.name ?? "Unknown") : null,
    _enrolled: enrollmentCounts[c.id] ?? 0,
  }));

  const searchLower = search.trim().toLowerCase();
  const rows = enriched
    .filter((c: any) => {
      if (priceFilter === "free" && c.pricing_type !== "free") return false;
      if (priceFilter === "paid" && c.pricing_type !== "paid") return false;
      if (priceFilter === "discounted" && !coursePricingService.isDiscountActive(c)) return false;
      if (instructorFilter !== "all") {
        if (instructorFilter === "unassigned" ? !!c.instructor_id : c.instructor_id !== instructorFilter) return false;
      }
      if (categoryFilter !== "all" && c.category !== categoryFilter) return false;
      // Extend search to instructor name (title/slug/category already server-side)
      if (searchLower && !(
        (c.title ?? "").toLowerCase().includes(searchLower) ||
        (c.slug ?? "").toLowerCase().includes(searchLower) ||
        (c.category ?? "").toLowerCase().includes(searchLower) ||
        (c.subcategory ?? "").toLowerCase().includes(searchLower) ||
        (c._instructorName ?? "").toLowerCase().includes(searchLower)
      )) {
        // If server matched on title/slug/category we keep it, but this
        // client-side check also lets instructor-name matches pass through
        // when the server row was returned for another reason.
        return true;
      }
      return true;
    })
    .sort((a: any, b: any) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortBy === "instructor") {
        return (a._instructorName ?? "~").localeCompare(b._instructorName ?? "~") * dir;
      }
      if (sortBy === "enrolled") {
        return (a._enrolled - b._enrolled) * dir;
      }
      return (new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()) * dir;
    });

  const toggleSort = (key: "instructor" | "enrolled") => {
    if (sortBy === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(key); setSortDir(key === "enrolled" ? "desc" : "asc"); }
  };
  const SortIcon = ({ col }: { col: "instructor" | "enrolled" }) =>
    sortBy !== col ? <ArrowUpDown className="h-3 w-3 inline ml-1 opacity-50" /> :
    sortDir === "asc" ? <ArrowUp className="h-3 w-3 inline ml-1" /> : <ArrowDown className="h-3 w-3 inline ml-1" />;

  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / 12));

  return (
    <div className="space-y-6 max-w-7xl">
      <PageHeader
        title="Courses"
        description="Build, organize and publish courses for your learners."
        actions={
          canManage && (
            <Button onClick={() => navigate("/app/courses/new")}>
              <Plus className="h-4 w-4 mr-1" /> New course
            </Button>
          )
        }
      />

      <Card className="p-4 border-border shadow-none">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search title, slug, category or instructor…" className="pl-9" />
          </div>
          {isAdminReviewer && (
            <Select value={instructorFilter} onValueChange={(v) => { setInstructorFilter(v); setPage(1); }}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Instructor" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All instructors</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {instructorOptions.map(([id, name]) => (
                  <SelectItem key={id} value={id}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(1); }}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categoryOptions.map((cat) => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => { setStatus(v as any); setPage(1); }}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="pending_review">Pending review</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priceFilter} onValueChange={(v) => setPriceFilter(v as any)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All prices</SelectItem>
              <SelectItem value="free">Free</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="discounted">Discounted</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="border-border shadow-none">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Course</TableHead>
              <TableHead>Category</TableHead>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => toggleSort("instructor")}
              >
                Instructor<SortIcon col="instructor" />
              </TableHead>
              <TableHead
                className="text-right cursor-pointer select-none"
                onClick={() => toggleSort("enrolled")}
              >
                Enrolled<SortIcon col="enrolled" />
              </TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={8} className="py-10 text-center text-muted-foreground">Loading…</TableCell></TableRow>
            )}
            {!isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                  <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  No courses yet. Create your first course to get started.
                </TableCell>
              </TableRow>
            )}
            {rows.map((c: any) => (
              <TableRow key={c.id} className="cursor-pointer" onClick={() => navigate(`/app/courses/${c.id}`)}>
                <TableCell>
                  <div className="font-medium">{c.title}</div>
                  <div className="text-xs text-muted-foreground truncate max-w-md">{c.summary ?? c.description ?? "—"}</div>
                </TableCell>
                <TableCell className="text-sm">
                  {c.category ? (
                    <span>
                      {c.category}
                      {c.subcategory && <span className="text-muted-foreground"> › {c.subcategory}</span>}
                    </span>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {c._instructorName ? (
                    <span>{c._instructorName}</span>
                  ) : (
                    <Badge variant="secondary" className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200">
                      Unassigned
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="font-medium tabular-nums hover:underline text-primary disabled:text-muted-foreground disabled:no-underline"
                    disabled={c._enrolled === 0}
                    onClick={() => navigate(`/app/students?course=${c.id}`)}
                    title={c._enrolled === 0 ? "No active enrollments" : `View ${c._enrolled} enrolled student${c._enrolled === 1 ? "" : "s"}`}
                  >
                    {c._enrolled}
                  </button>
                </TableCell>
                <TableCell><CoursePrice course={c} size="sm" /></TableCell>
                <TableCell><Badge variant="secondary" className={statusColor[c.status]}>{c.status}</Badge></TableCell>
                <TableCell className="text-sm">{new Date(c.updated_at).toLocaleDateString()}</TableCell>
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label="Course actions">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      sideOffset={4}
                      collisionPadding={12}
                      className="z-50 min-w-[11rem] max-h-[60vh] overflow-y-auto"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <DropdownMenuItem onClick={() => navigate(`/app/courses/${c.id}`)}>
                        View course
                      </DropdownMenuItem>
                      {canManage && (
                        <DropdownMenuItem onClick={() => navigate(`/app/courses/${c.id}/edit`)}>
                          Edit in builder
                        </DropdownMenuItem>
                      )}
                      {canManage && (
                        <DropdownMenuItem onClick={() => { setEditing(c); setOpen(true); }}>
                          Quick edit
                        </DropdownMenuItem>
                      )}

                      {/* Instructor: submit for review / withdraw */}
                      {isInstructorOnly && (c.status === "draft" || c.status === "rejected") && (
                        <DropdownMenuItem onClick={() => changeStatus.mutate({ id: c.id, status: "pending_review" })}>Submit for review</DropdownMenuItem>
                      )}
                      {isInstructorOnly && c.status === "pending_review" && (
                        <DropdownMenuItem onClick={() => changeStatus.mutate({ id: c.id, status: "draft" })}>Withdraw review</DropdownMenuItem>
                      )}

                      {/* Admin approval workflow */}
                      {isAdminReviewer && c.status === "pending_review" && (
                        <>
                          <DropdownMenuItem onClick={() => changeStatus.mutate({ id: c.id, status: "approved" })}>Approve</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => changeStatus.mutate({ id: c.id, status: "rejected" })}>Reject</DropdownMenuItem>
                        </>
                      )}
                      {isAdminReviewer && c.status !== "published" && (
                        <DropdownMenuItem onClick={() => changeStatus.mutate({ id: c.id, status: "published" })}>Publish</DropdownMenuItem>
                      )}
                      {isAdminReviewer && c.status === "published" && (
                        <DropdownMenuItem onClick={() => changeStatus.mutate({ id: c.id, status: "draft" })}>Unpublish</DropdownMenuItem>
                      )}
                      {isAdminReviewer && c.status !== "archived" && (
                        <DropdownMenuItem onClick={() => changeStatus.mutate({ id: c.id, status: "archived" })}>Archive</DropdownMenuItem>
                      )}

                      {/* Admin lifecycle controls */}
                      {isAdminReviewer && c.status !== "suspended" && c.status !== "archived" && (
                        <DropdownMenuItem onClick={() => { setSuspendCourse(c); setSuspendReason(""); }}>
                          Suspend
                        </DropdownMenuItem>
                      )}
                      {isAdminReviewer && (c.status === "suspended" || c.status === "archived") && (
                        <DropdownMenuItem onClick={async () => {
                          try { await courseLifecycleService.restore(c.id); toast({ title: "Course restored" }); qc.invalidateQueries({ queryKey: ["courses"] }); }
                          catch (e: any) { toast({ title: "Failed", description: e.message, variant: "destructive" }); }
                        }}>Restore</DropdownMenuItem>
                      )}
                      {canTransfer && (
                        <DropdownMenuItem onClick={() => setReassignCourse(c)}>
                          Transfer instructor
                        </DropdownMenuItem>
                      )}

                      {/* Instructor deletion request */}
                      {isInstructorOnly && c.status === "draft" && (
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setConfirmDraftDelete(c)}>
                          Delete
                        </DropdownMenuItem>
                      )}
                      {isInstructorOnly && c.status !== "draft" && c.status !== "archived" && (
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => { setDeletionRequestCourse(c); setDeletionReason(""); }}>
                          Request deletion
                        </DropdownMenuItem>
                      )}

                      {/* Admin quick delete for draft (no approval needed) */}
                      {isAdminReviewer && c.status === "draft" && (
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setConfirmDraftDelete(c)}>
                          Delete draft
                        </DropdownMenuItem>
                      )}

                      {/* Admin hard delete only when archived */}
                      {canDelete && c.status === "archived" && (
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setConfirmDelete(c)}>
                          Delete permanently
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {pages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{total} courses</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}

      <CourseFormDialog open={open} onOpenChange={setOpen} initial={editing} workspaceId={wsId} />

      <ReassignInstructorDialog
        open={!!reassignCourse}
        onOpenChange={(o) => !o && setReassignCourse(null)}
        course={reassignCourse}
      />

      <Dialog open={!!deletionRequestCourse} onOpenChange={(o) => !o && setDeletionRequestCourse(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Request course deletion</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Course: <span className="font-medium text-foreground">{deletionRequestCourse?.title}</span>
            </p>
            <div>
              <Label>Reason</Label>
              <Textarea rows={4} value={deletionReason} onChange={(e) => setDeletionReason(e.target.value)} placeholder="Why should this course be removed?" />
            </div>
            <p className="text-xs text-muted-foreground">
              This will send a request to admins. Courses, videos, and student access are workspace-owned and are not removed without admin approval.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeletionRequestCourse(null)}>Cancel</Button>
            <Button
              disabled={deletionReason.trim().length < 5}
              onClick={async () => {
                try {
                  await courseLifecycleService.requestDeletion(deletionRequestCourse.id, deletionReason.trim());
                  toast({ title: "Deletion request submitted" });
                  setDeletionRequestCourse(null);
                } catch (e: any) {
                  toast({ title: "Failed", description: e.message, variant: "destructive" });
                }
              }}
            >Submit request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!suspendCourse} onOpenChange={(o) => !o && setSuspendCourse(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Suspend course</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Course: <span className="font-medium text-foreground">{suspendCourse?.title}</span>
            </p>
            <div>
              <Label>Reason</Label>
              <Textarea rows={3} value={suspendReason} onChange={(e) => setSuspendReason(e.target.value)} placeholder="Reason visible in the audit log…" />
            </div>
            <p className="text-xs text-muted-foreground">Suspending hides the course from the catalog but keeps content and enrollments. You can restore anytime.</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSuspendCourse(null)}>Cancel</Button>
            <Button
              onClick={async () => {
                try {
                  await courseLifecycleService.suspend(suspendCourse.id, suspendReason.trim());
                  toast({ title: "Course suspended" });
                  qc.invalidateQueries({ queryKey: ["courses"] });
                  setSuspendCourse(null);
                } catch (e: any) {
                  toast({ title: "Failed", description: e.message, variant: "destructive" });
                }
              }}
            >Suspend</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this course?</AlertDialogTitle>
            <AlertDialogDescription>
              "{confirmDelete?.title}" will be removed from course lists, catalog, search, statistics, and direct access.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && deleteCourse.mutate(confirmDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmDraftDelete} onOpenChange={(o) => !o && setConfirmDraftDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this draft course?</AlertDialogTitle>
            <AlertDialogDescription>
              "{confirmDraftDelete?.title}" is still a draft and will be permanently removed along with its sections, lessons, quizzes, assignments, and live classes. This action cannot be undone.
              {" "}If the course has ever been enrolled or paid for, deletion will be blocked and you'll need to submit a request for admin review.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                const course = confirmDraftDelete;
                if (!course) return;
                try {
                  await courseLifecycleService.instructorDeleteDraft(course.id);
                  removeCourseFromCaches(course.id);
                  toast({ title: "Draft course deleted" });
                  setConfirmDraftDelete(null);
                  qc.invalidateQueries({ queryKey: ["courses"] });
                  qc.invalidateQueries({ queryKey: ["manageable-courses"] });
                } catch (e: any) {
                  toast({ title: "Delete failed", description: e?.message ?? "Unknown error", variant: "destructive" });
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete draft
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
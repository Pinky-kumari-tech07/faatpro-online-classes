import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, PlayCircle, Search, Eye, MoreHorizontal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/shared/hooks/useWorkspace";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "@/components/ui/use-toast";
import PageHeader from "@/modules/shared/PageHeader";
import LessonFormDialog from "./LessonFormDialog";
import { useAuth } from "@/shared/hooks/useAuth";
import { useRealtimeInvalidate } from "@/shared/hooks/useRealtimeInvalidate";
import { useManageableCourses } from "@/shared/hooks/useManageableCourses";
import { CourseSelectItems } from "@/shared/components/CourseSelectItems";

export default function LessonsPage() {
  const { membership, primaryRole } = useWorkspace();
  const { user } = useAuth();
  const wsId = membership!.workspace.id;
  const canManage = ["organization_admin", "super_admin", "instructor"].includes(primaryRole ?? "");
  const [search, setSearch] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const [courseFilter, setCourseFilter] = useState<string>(searchParams.get("course") ?? "all");
  const [type, setType] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [confirmDelete, setConfirmDelete] = useState<any>(null);
  const qc = useQueryClient();

  useRealtimeInvalidate(
    ["lessons", "course_sections", "courses", "course_instructors"],
    [["lessons-all"], ["manageable-courses"]],
  );

  useEffect(() => {
    const c = searchParams.get("course");
    if (c && c !== courseFilter) setCourseFilter(c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (courseFilter && courseFilter !== "all") next.set("course", courseFilter);
    else next.delete("course");
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseFilter]);

  const { courses, isLoading: coursesLoading, error: coursesError } = useManageableCourses();

  const { data: lessons } = useQuery({
    queryKey: ["lessons-all", wsId, search, courseFilter, type, primaryRole, user?.id, (courses ?? []).map((c: any) => c.id).join(",")],
    enabled: !!courses,
    queryFn: async () => {
      const courseIds = (courses ?? []).map((c: any) => c.id);
      let q = supabase.from("lessons")
        .select("*, courses:course_id(title), course_sections:section_id(title)")
        .order("position");
      if (primaryRole === "instructor") {
        if (courseIds.length === 0) return [];
        q = q.in("course_id", courseIds);
      } else {
        q = q.eq("workspace_id", wsId);
      }
      if (courseFilter !== "all") q = q.eq("course_id", courseFilter);
      if (type !== "all") q = q.eq("lesson_type", type as any);
      if (search) q = q.ilike("title", `%${search}%`);
      const { data } = await q;
      return data ?? [];
    },
  });

  const togglePreview = useMutation({
    mutationFn: async ({ id, is_preview }: { id: string; is_preview: boolean }) => {
      const { error } = await supabase.from("lessons").update({ is_preview }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Lesson updated" });
      qc.invalidateQueries({ queryKey: ["lessons-all"] });
    },
    onError: (e: any) => toast({ title: "Couldn't update", description: e.message, variant: "destructive" }),
  });

  const deleteLesson = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lessons").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Lesson deleted" });
      setConfirmDelete(null);
      qc.invalidateQueries({ queryKey: ["lessons-all"] });
    },
    onError: (e: any) => toast({ title: "Couldn't delete", description: e.message, variant: "destructive" }),
  });

  const grouped: Record<string, any[]> = {};
  (lessons ?? []).forEach((l: any) => {
    const key = l.courses?.title ?? "Unassigned";
    (grouped[key] ||= []).push(l);
  });

  return (
    <div className="space-y-6 max-w-6xl">
      <PageHeader
        title="Lessons"
        description="All lessons across your courses, grouped by course and section."
        actions={canManage && (
          <Button onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> New lesson
          </Button>
        )}
      />

      <Card className="p-4 border-border shadow-none">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search lessons…" className="pl-9" />
          </div>
          <Select value={courseFilter} onValueChange={setCourseFilter}>
            <SelectTrigger className="w-56"><SelectValue placeholder="All courses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All courses</SelectItem>
              <CourseSelectItems courses={courses} isLoading={coursesLoading} error={coursesError} />
            </SelectContent>
          </Select>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="video">Video</SelectItem>
              <SelectItem value="pdf">PDF</SelectItem>
              <SelectItem value="text">Text</SelectItem>
              <SelectItem value="embed">Embed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <div className="space-y-4">
        {Object.entries(grouped).map(([course, items]) => (
          <Card key={course} className="border-border shadow-none">
            <div className="px-4 py-3 border-b border-border font-semibold">{course}</div>
            <div className="divide-y divide-border">
              {items.map((l: any) => (
                <div key={l.id} className="flex items-center gap-3 p-3 hover:bg-muted/40">
                  <PlayCircle className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">{l.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {l.course_sections?.title ?? "No section"} · {l.lesson_type}
                      {l.duration_seconds ? ` · ${Math.round(l.duration_seconds / 60)}m` : ""}
                    </div>
                  </div>
                  {l.is_preview && <Badge variant="secondary">Preview</Badge>}
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/lessons/${l.id}/preview`} target="_blank" rel="noreferrer">
                      <Eye className="h-3.5 w-3.5" /> Preview
                    </Link>
                  </Button>
                  {canManage && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => { setEditing(l); setOpen(true); }}>Edit</Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => togglePreview.mutate({ id: l.id, is_preview: !l.is_preview })}>
                            {l.is_preview ? "Unpublish (lock lesson)" : "Publish as free preview"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setConfirmDelete(l)}
                          >
                            Delete lesson
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </>
                  )}
                </div>
              ))}
            </div>
          </Card>
        ))}
        {(lessons ?? []).length === 0 && (
          <Card className="p-12 text-center text-muted-foreground border-border shadow-none">
            No lessons yet. Create your first lesson to get started.
          </Card>
        )}
      </div>

      <LessonFormDialog open={open} onOpenChange={setOpen} initial={editing} workspaceId={wsId} />

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this lesson?</AlertDialogTitle>
            <AlertDialogDescription>
              "{confirmDelete?.title}" will be permanently removed along with its progress and notes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && deleteLesson.mutate(confirmDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/shared/hooks/useWorkspace";
import { useAuth } from "@/shared/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, ChevronLeft, Trash2, PlayCircle, GripVertical } from "lucide-react";
import LessonFormDialog from "@/modules/lessons/LessonFormDialog";
import { toast } from "@/components/ui/use-toast";
import { sanitizeRichHtml, looksLikeHtml } from "@/lib/sanitizeHtml";
import {
  DndContext, PointerSensor, useSensor, useSensors, closestCenter, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export default function CourseDetailPage() {
  const { id } = useParams();
  const { membership, primaryRole } = useWorkspace();
  const { user } = useAuth();
  const isAdminReviewer = ["organization_admin", "super_admin"].includes(primaryRole ?? "");
  const canEditContent = ["organization_admin", "super_admin", "instructor"].includes(primaryRole ?? "");
  const isInstructorOnly = primaryRole === "instructor";
  const wsId = membership!.workspace.id;
  const qc = useQueryClient();
  const navigate = useNavigate();
  // Redirect editors to the full course builder so instructors get the same
  // curriculum experience as admins (sections + lessons + quizzes +
  // assignments + live classes, with edit/delete and drag-and-drop).
  useEffect(() => {
    if (canEditContent && id) {
      navigate(`/app/courses/${id}/edit`, { replace: true });
    }
  }, [canEditContent, id, navigate]);
  const [lessonOpen, setLessonOpen] = useState(false);
  const [editLesson, setEditLesson] = useState<any>(null);
  const [defaultSection, setDefaultSection] = useState<string | null>(null);
  const [newSection, setNewSection] = useState("");

  const { data: course, isLoading: courseLoading, isError: courseError } = useQuery({
    queryKey: ["course", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("*").eq("id", id!).is("deleted_at", null).single();
      if (error) throw error; return data;
    },
  });

  const { data: sections } = useQuery({
    queryKey: ["sections", id],
    queryFn: async () => {
      const { data } = await supabase.from("course_sections").select("*").eq("course_id", id!).order("position");
      return data ?? [];
    },
  });

  const { data: lessons } = useQuery({
    queryKey: ["lessons", id],
    queryFn: async () => {
      const { data } = await supabase.from("lessons").select("*").eq("course_id", id!).order("position");
      return data ?? [];
    },
  });

  const addSection = useMutation({
    mutationFn: async () => {
      if (!canEditContent) throw new Error("403 Forbidden");
      const pos = (sections?.length ?? 0);
      const { error } = await supabase.from("course_sections").insert({
        workspace_id: wsId, course_id: id!, title: newSection, position: pos,
      });
      if (error) throw error;
    },
    onSuccess: () => { setNewSection(""); qc.invalidateQueries({ queryKey: ["sections", id] }); },
  });

  const delSection = useMutation({
    mutationFn: async (sid: string) => {
      if (!canEditContent) throw new Error("403 Forbidden");
      const { error } = await supabase.from("course_sections").delete().eq("id", sid);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sections", id] }),
  });

  const delLesson = useMutation({
    mutationFn: async (lid: string) => {
      if (!canEditContent) throw new Error("403 Forbidden");
      const { error } = await supabase.from("lessons").delete().eq("id", lid);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lessons", id] }),
  });

  const reorderSections = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      if (!canEditContent) throw new Error("403 Forbidden");
      await Promise.all(orderedIds.map((sid, idx) =>
        supabase.from("course_sections").update({ position: idx }).eq("id", sid),
      ));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sections", id] }),
    onError: (e: any) => toast({ title: "Reorder failed", description: e.message, variant: "destructive" }),
  });

  const moveLesson = useMutation({
    mutationFn: async ({ lessonId, sectionId, position }: { lessonId: string; sectionId: string | null; position: number }) => {
      if (!canEditContent) throw new Error("403 Forbidden");
      const { error } = await supabase.from("lessons").update({ section_id: sectionId, position }).eq("id", lessonId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lessons", id] }),
    onError: (e: any) => toast({ title: "Move failed", description: e.message, variant: "destructive" }),
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const setStatus = useMutation({
    mutationFn: async (status: string) => {
      if (!isAdminReviewer && !isInstructorOnly) throw new Error("403 Forbidden");
      const { error } = await supabase.from("courses").update({ status: status as any }).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => { toast({ title: "Status updated" }); qc.invalidateQueries({ queryKey: ["course", id] }); },
  });

  if (courseLoading) return <div className="text-muted-foreground">Loading…</div>;
  if (courseError || !course) {
    return (
      <div className="space-y-4 max-w-3xl">
        <Link to="/app/courses" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" /> Back to courses
        </Link>
        <Card className="p-8 border-border shadow-none text-center text-muted-foreground">Course not found.</Card>
      </div>
    );
  }

  const lessonsBySection: Record<string, any[]> = {};
  (lessons ?? []).forEach((l: any) => {
    const key = l.section_id ?? "_unassigned";
    (lessonsBySection[key] ||= []).push(l);
  });
  Object.keys(lessonsBySection).forEach((k) =>
    lessonsBySection[k].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
  );

  const cleanDesc = sanitizeRichHtml(course.description ?? "");

  function handleSectionDrag(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = (sections ?? []).map((s: any) => s.id);
    const oldI = ids.indexOf(String(active.id));
    const newI = ids.indexOf(String(over.id));
    if (oldI < 0 || newI < 0) return;
    reorderSections.mutate(arrayMove(ids, oldI, newI));
  }

  function handleLessonDrag(sectionId: string, e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const items = lessonsBySection[sectionId] ?? [];
    const oldI = items.findIndex((l) => l.id === active.id);
    const newI = items.findIndex((l) => l.id === over.id);
    if (oldI < 0 || newI < 0) return;
    const reordered = arrayMove(items, oldI, newI);
    reordered.forEach((l, idx) => {
      if (l.position !== idx) moveLesson.mutate({ lessonId: l.id, sectionId, position: idx });
    });
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <Link to="/app/courses" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        <ChevronLeft className="h-4 w-4" /> Back to courses
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold tracking-tight">{course.title}</h1>
            <Badge variant="secondary">{course.status}</Badge>
          </div>
          {course.summary ? (
            <p className="text-muted-foreground max-w-2xl">{course.summary}</p>
          ) : cleanDesc ? (
            looksLikeHtml(cleanDesc) ? (
              <div
                className="prose prose-sm max-w-2xl text-muted-foreground prose-headings:text-foreground prose-strong:text-foreground prose-a:text-primary"
                dangerouslySetInnerHTML={{ __html: cleanDesc }}
              />
            ) : (
              <p className="text-muted-foreground max-w-2xl whitespace-pre-line">{cleanDesc}</p>
            )
          ) : (
            <p className="text-muted-foreground max-w-2xl">No description</p>
          )}
        </div>
        <div className="flex gap-2">
          {isAdminReviewer && course.status !== "published" && (
            <Button onClick={() => setStatus.mutate("published")}>Publish</Button>
          )}
          {isAdminReviewer && course.status === "published" && (
            <Button variant="outline" onClick={() => setStatus.mutate("draft")}>Unpublish</Button>
          )}
          {isAdminReviewer && course.status === "pending_review" && (
            <>
              <Button onClick={() => setStatus.mutate("approved")}>Approve</Button>
              <Button variant="outline" onClick={() => setStatus.mutate("rejected")}>Reject</Button>
            </>
          )}
          {isInstructorOnly && (course.status === "draft" || course.status === "rejected") && (
            <Button onClick={() => setStatus.mutate("pending_review")}>Submit for review</Button>
          )}
          {isInstructorOnly && course.status === "pending_review" && (
            <Button variant="outline" onClick={() => setStatus.mutate("draft")}>Withdraw</Button>
          )}
        </div>
      </div>

      {course.status === "pending_review" && (
        <Card className="p-3 border-amber-300 bg-amber-50 text-amber-900 text-sm">
          This course is awaiting admin review. Edits remain possible until approved.
        </Card>
      )}
      {course.status === "rejected" && course.review_notes && (
        <Card className="p-3 border-destructive bg-destructive/5 text-destructive text-sm">
          <div className="font-semibold mb-1">Rejected by reviewer</div>
          <div>{course.review_notes}</div>
        </Card>
      )}

      {canEditContent && (
        <Card className="p-4 border-border shadow-none">
          <div className="flex gap-2">
            <Input placeholder="New section title…" value={newSection} onChange={(e) => setNewSection(e.target.value)} />
            <Button onClick={() => addSection.mutate()} disabled={!newSection.trim()}>
              <Plus className="h-4 w-4 mr-1" /> Add section
            </Button>
          </div>
        </Card>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => canEditContent && handleSectionDrag(e)}>
        <SortableContext items={(sections ?? []).map((s: any) => s.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-4">
            {(sections ?? []).map((s: any) => (
              <SortableSectionCard
                key={s.id}
                section={s}
                lessons={lessonsBySection[s.id] ?? []}
                onAddLesson={() => { setEditLesson(null); setDefaultSection(s.id); setLessonOpen(true); }}
                onDeleteSection={() => delSection.mutate(s.id)}
                onEditLesson={(l) => { setEditLesson(l); setLessonOpen(true); }}
                onDeleteLesson={(lid) => delLesson.mutate(lid)}
                sensors={sensors}
                onLessonDrag={(e) => handleLessonDrag(s.id, e)}
                canEdit={canEditContent}
              />
            ))}
            {(sections ?? []).length === 0 && (
              <Card className="p-10 text-center text-muted-foreground border-border shadow-none">
                Add your first section to start building this course.
              </Card>
            )}
          </div>
        </SortableContext>
      </DndContext>

      {canEditContent && (
        <LessonFormDialog
          open={lessonOpen}
          onOpenChange={setLessonOpen}
          initial={editLesson}
          workspaceId={wsId}
          courseId={id!}
          defaultSectionId={defaultSection}
        />
      )}
    </div>
  );
}

function SortableSectionCard({
  section, lessons, onAddLesson, onDeleteSection, onEditLesson, onDeleteLesson, sensors, onLessonDrag, canEdit,
}: {
  section: any;
  lessons: any[];
  onAddLesson: () => void;
  onDeleteSection: () => void;
  onEditLesson: (l: any) => void;
  onDeleteLesson: (lid: string) => void;
  sensors: any;
  onLessonDrag: (e: DragEndEvent) => void;
  canEdit: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <Card ref={setNodeRef} style={style} className="border-border shadow-none">
      <div className="flex items-center justify-between p-4 border-b border-border gap-2">
        {canEdit && (
          <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground" aria-label="Drag section">
            <GripVertical className="h-4 w-4" />
          </button>
        )}
        <div className="font-semibold flex-1">{section.title}</div>
        {canEdit && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onAddLesson}>
              <Plus className="h-3 w-3 mr-1" /> Lesson
            </Button>
            <Button size="sm" variant="ghost" onClick={onDeleteSection}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => canEdit && onLessonDrag(e)}>
        <SortableContext items={lessons.map((l) => l.id)} strategy={verticalListSortingStrategy}>
          <div className="divide-y divide-border">
            {lessons.map((l) => (
              <SortableLessonRow
                key={l.id} lesson={l}
                onEdit={() => onEditLesson(l)}
                onDelete={() => onDeleteLesson(l.id)}
                canEdit={canEdit}
              />
            ))}
            {lessons.length === 0 && (
              <div className="p-4 text-sm text-muted-foreground">No lessons in this section yet.</div>
            )}
          </div>
        </SortableContext>
      </DndContext>
    </Card>
  );
}

function SortableLessonRow({ lesson, onEdit, onDelete, canEdit }: { lesson: any; onEdit: () => void; onDelete: () => void; canEdit: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lesson.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 p-3 hover:bg-muted/40">
      {canEdit && (
        <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground" aria-label="Drag lesson">
          <GripVertical className="h-4 w-4" />
        </button>
      )}
      <PlayCircle className="h-4 w-4 text-muted-foreground" />
      <div className="flex-1">
        <div className="text-sm font-medium">{lesson.title}</div>
        <div className="text-xs text-muted-foreground capitalize">{lesson.lesson_type} · {lesson.duration_seconds ? `${Math.round(lesson.duration_seconds / 60)}m` : "—"}</div>
      </div>
      {lesson.is_preview && <Badge variant="secondary">Preview</Badge>}
      {canEdit && (
        <>
          <Button size="sm" variant="ghost" onClick={onEdit}>Edit</Button>
          <Button size="sm" variant="ghost" onClick={onDelete}><Trash2 className="h-3 w-3" /></Button>
        </>
      )}
    </div>
  );
}
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DndContext, PointerSensor, useSensor, useSensors, closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus, GripVertical, Trash2, ChevronDown, ChevronRight, Pencil,
  PlayCircle, FileText, Radio, ClipboardList, FolderInput,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import LessonFormDialog from "@/modules/lessons/LessonFormDialog";
import QuizModal from "./modals/QuizModal";
import AssignmentModal from "./modals/AssignmentModal";
import LiveClassModal from "./modals/LiveClassModal";
import { toast } from "@/components/ui/use-toast";

type Item =
  | { kind: "lesson"; id: string; title: string; section_id: string | null; raw: any; position: number }
  | { kind: "quiz"; id: string; title: string; section_id: string | null; raw: any; position: number }
  | { kind: "assignment"; id: string; title: string; section_id: string | null; raw: any; position: number }
  | { kind: "live"; id: string; title: string; section_id: string | null; raw: any; position: number };

function ItemIcon({ kind }: { kind: Item["kind"] }) {
  const Cls = "h-4 w-4 text-muted-foreground";
  if (kind === "lesson") return <PlayCircle className={Cls} />;
  if (kind === "quiz") return <ClipboardList className={Cls} />;
  if (kind === "assignment") return <FileText className={Cls} />;
  return <Radio className={Cls} />;
}

function SortableItem({
  item, onEdit, onDelete, sections, onMove,
}: {
  item: Item;
  onEdit: () => void;
  onDelete: () => void;
  sections: { id: string; title: string }[];
  onMove: (item: Item, sectionId: string | null) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `${item.kind}:${item.id}` });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 px-3 py-2 hover:bg-muted/40 border-t border-border first:border-t-0">
      <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground"><GripVertical className="h-4 w-4" /></button>
      <ItemIcon kind={item.kind} />
      <div className="flex-1 text-sm">
        <span className="font-medium">{item.title}</span>
        <span className="ml-2 text-xs text-muted-foreground capitalize">{item.kind}</span>
      </div>
      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit}><Pencil className="h-3.5 w-3.5" /></Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" className="h-7 w-7" title="Move to section">
            <FolderInput className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
          <DropdownMenuLabel>Move to section</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {sections.length === 0 && (
            <DropdownMenuItem disabled>No sections available</DropdownMenuItem>
          )}
          {sections.map((s) => (
            <DropdownMenuItem
              key={s.id}
              disabled={s.id === item.section_id}
              onClick={() => onMove(item, s.id)}
            >
              {s.title}{s.id === item.section_id ? "  ·  current" : ""}
            </DropdownMenuItem>
          ))}
          {item.section_id && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onMove(item, null)}>
                Unassign
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onDelete}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
    </div>
  );
}

function SortableSection({
  section, children, header,
}: {
  section: any;
  children: React.ReactNode;
  header: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `section:${section.id}` });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <Card ref={setNodeRef} style={style} className="border-border shadow-none">
      <div className="flex items-center gap-2 p-3 border-b border-border">
        <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground"><GripVertical className="h-4 w-4" /></button>
        {header}
      </div>
      {children}
    </Card>
  );
}

export default function CurriculumStep({
  courseId, workspaceId,
}: { courseId: string; workspaceId: string }) {
  const qc = useQueryClient();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [newSectionTitle, setNewSectionTitle] = useState("");

  const [lessonOpen, setLessonOpen] = useState(false);
  const [lessonDefaults, setLessonDefaults] = useState<{ section: string | null; initial: any }>({ section: null, initial: null });

  const [quizOpen, setQuizOpen] = useState(false);
  const [quizInitial, setQuizInitial] = useState<any>(null);
  const [quizSection, setQuizSection] = useState<string | null>(null);

  const [asgnOpen, setAsgnOpen] = useState(false);
  const [asgnInitial, setAsgnInitial] = useState<any>(null);
  const [asgnSection, setAsgnSection] = useState<string | null>(null);

  const [liveOpen, setLiveOpen] = useState(false);
  const [liveInitial, setLiveInitial] = useState<any>(null);
  const [liveSection, setLiveSection] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["builder-curriculum", courseId],
    enabled: !!courseId,
    queryFn: async () => {
      const [{ data: sections }, { data: lessons }, { data: quizzes }, { data: assigns }, { data: lives }] =
        await Promise.all([
          supabase.from("course_sections").select("*").eq("course_id", courseId).order("position"),
          supabase.from("lessons").select("*").eq("course_id", courseId).order("position"),
          supabase.from("quizzes").select("*").eq("course_id", courseId).order("position"),
          supabase.from("assignments").select("*").eq("course_id", courseId).order("position"),
          supabase.from("live_classes").select("*").eq("course_id", courseId).order("starts_at"),
        ]);
      return {
        sections: sections ?? [],
        lessons: lessons ?? [],
        quizzes: quizzes ?? [],
        assigns: assigns ?? [],
        lives: lives ?? [],
      };
    },
  });

  const itemsBySection = useMemo<Record<string, Item[]>>(() => {
    const map: Record<string, Item[]> = {};
    for (const s of data?.sections ?? []) map[s.id] = [];
    map["_unassigned"] = [];
    for (const l of data?.lessons ?? []) {
      const k = l.section_id ?? "_unassigned";
      (map[k] ||= []).push({ kind: "lesson", id: l.id, title: l.title, section_id: l.section_id, raw: l, position: l.position ?? 0 });
    }
    for (const q of data?.quizzes ?? []) {
      const k = q.section_id ?? "_unassigned";
      (map[k] ||= []).push({ kind: "quiz", id: q.id, title: q.title, section_id: q.section_id ?? null, raw: q, position: q.position ?? 0 });
    }
    for (const a of data?.assigns ?? []) {
      const k = a.section_id ?? "_unassigned";
      (map[k] ||= []).push({ kind: "assignment", id: a.id, title: a.title, section_id: a.section_id ?? null, raw: a, position: a.position ?? 0 });
    }
    for (const lc of data?.lives ?? []) {
      const k = lc.section_id ?? "_unassigned";
      (map[k] ||= []).push({ kind: "live", id: lc.id, title: lc.title, section_id: lc.section_id ?? null, raw: lc, position: 0 });
    }
    Object.keys(map).forEach((k) => map[k].sort((a, b) => a.position - b.position));
    return map;
  }, [data]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const addSection = useMutation({
    mutationFn: async (title: string) => {
      const pos = data?.sections.length ?? 0;
      const { error } = await supabase.from("course_sections").insert({
        workspace_id: workspaceId, course_id: courseId, title, position: pos,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewSectionTitle("");
      qc.invalidateQueries({ queryKey: ["builder-curriculum", courseId] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const renameSection = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const { error } = await supabase.from("course_sections").update({ title }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["builder-curriculum", courseId] }),
  });

  const deleteSection = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("course_sections").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["builder-curriculum", courseId] }),
  });

  const reorderSections = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      await Promise.all(
        orderedIds.map((id, idx) =>
          supabase.from("course_sections").update({ position: idx }).eq("id", id),
        ),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["builder-curriculum", courseId] }),
  });

  const moveLesson = useMutation({
    mutationFn: async ({ lessonId, sectionId, position }: { lessonId: string; sectionId: string | null; position: number }) => {
      const { error } = await supabase.from("lessons").update({ section_id: sectionId, position }).eq("id", lessonId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["builder-curriculum", courseId] }),
  });

  const deleteItem = useMutation({
    mutationFn: async (item: Item) => {
      const table =
        item.kind === "lesson" ? "lessons"
          : item.kind === "quiz" ? "quizzes"
          : item.kind === "assignment" ? "assignments" : "live_classes";
      const { error } = await supabase.from(table).delete().eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["builder-curriculum", courseId] }),
    onError: (e: any) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  const moveItem = useMutation({
    mutationFn: async ({ item, sectionId }: { item: Item; sectionId: string | null }) => {
      const table =
        item.kind === "lesson" ? "lessons"
          : item.kind === "quiz" ? "quizzes"
          : item.kind === "assignment" ? "assignments" : "live_classes";
      const { error } = await supabase.from(table).update({ section_id: sectionId } as any).eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Item moved" });
      qc.invalidateQueries({ queryKey: ["builder-curriculum", courseId] });
    },
    onError: (e: any) => toast({ title: "Move failed", description: e.message, variant: "destructive" }),
  });

  function handleSectionDrag(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    if (!String(active.id).startsWith("section:") || !String(over.id).startsWith("section:")) return;
    const ids = (data?.sections ?? []).map((s: any) => s.id);
    const oldI = ids.indexOf(String(active.id).slice(8));
    const newI = ids.indexOf(String(over.id).slice(8));
    if (oldI < 0 || newI < 0) return;
    reorderSections.mutate(arrayMove(ids, oldI, newI));
  }

  function handleItemDrag(sectionId: string, e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const items = itemsBySection[sectionId] ?? [];
    const oldI = items.findIndex((it) => `${it.kind}:${it.id}` === active.id);
    const newI = items.findIndex((it) => `${it.kind}:${it.id}` === over.id);
    if (oldI < 0 || newI < 0) return;
    const reordered = arrayMove(items, oldI, newI);
    // Persist lesson positions only (other kinds unaffected for now)
    reordered.forEach((it, idx) => {
      if (it.kind === "lesson" && it.position !== idx) {
        moveLesson.mutate({ lessonId: it.id, sectionId: it.section_id, position: idx });
      }
    });
  }

  if (!courseId) {
    return (
      <Card className="p-10 text-center text-muted-foreground border-border shadow-none">
        Save the basics step first to start building your curriculum.
      </Card>
    );
  }

  const sections = data?.sections ?? [];

  return (
    <div className="space-y-5">
      <Card className="p-4 border-border shadow-none flex gap-2">
        <Input
          value={newSectionTitle}
          onChange={(e) => setNewSectionTitle(e.target.value)}
          placeholder="New section title (e.g. Module 1: Getting started)"
          onKeyDown={(e) => {
            if (e.key === "Enter" && newSectionTitle.trim()) addSection.mutate(newSectionTitle.trim());
          }}
        />
        <Button onClick={() => newSectionTitle.trim() && addSection.mutate(newSectionTitle.trim())}>
          <Plus className="h-4 w-4 mr-1" /> Add section
        </Button>
      </Card>

      {isLoading && <div className="text-muted-foreground">Loading curriculum…</div>}

      {!isLoading && sections.length === 0 && (itemsBySection["_unassigned"] ?? []).length === 0 && (
        <Card className="p-10 text-center text-muted-foreground border-border shadow-none">
          Add your first section to start building this course.
        </Card>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSectionDrag}>
        <SortableContext items={sections.map((s: any) => `section:${s.id}`)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {sections.map((s: any) => {
              const isCollapsed = !!collapsed[s.id];
              const items = itemsBySection[s.id] ?? [];
              return (
                <SortableSection
                  key={s.id}
                  section={s}
                  header={
                    <>
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7"
                        onClick={() => setCollapsed((c) => ({ ...c, [s.id]: !c[s.id] }))}
                      >
                        {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                      {editingSectionId === s.id ? (
                        <Input
                          autoFocus
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onBlur={() => {
                            if (editingTitle.trim() && editingTitle !== s.title) {
                              renameSection.mutate({ id: s.id, title: editingTitle.trim() });
                            }
                            setEditingSectionId(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                            if (e.key === "Escape") setEditingSectionId(null);
                          }}
                          className="h-8 max-w-xs"
                        />
                      ) : (
                        <div
                          className="font-semibold flex-1 cursor-text"
                          onClick={() => { setEditingSectionId(s.id); setEditingTitle(s.title); }}
                        >
                          {s.title}
                        </div>
                      )}
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" className="h-8" onClick={() => { setLessonDefaults({ section: s.id, initial: null }); setLessonOpen(true); }}>
                          <Plus className="h-3 w-3 mr-1" /> Lesson
                        </Button>
                        <Button size="sm" variant="outline" className="h-8" onClick={() => { setQuizInitial(null); setQuizSection(s.id); setQuizOpen(true); }}>
                          <Plus className="h-3 w-3 mr-1" /> Quiz
                        </Button>
                        <Button size="sm" variant="outline" className="h-8" onClick={() => { setAsgnInitial(null); setAsgnSection(s.id); setAsgnOpen(true); }}>
                          <Plus className="h-3 w-3 mr-1" /> Assignment
                        </Button>
                        <Button size="sm" variant="outline" className="h-8" onClick={() => { setLiveInitial(null); setLiveSection(s.id); setLiveOpen(true); }}>
                          <Plus className="h-3 w-3 mr-1" /> Live
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => deleteSection.mutate(s.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </>
                  }
                >
                  {!isCollapsed && (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleItemDrag(s.id, e)}>
                      <SortableContext items={items.map((it) => `${it.kind}:${it.id}`)} strategy={verticalListSortingStrategy}>
                        {items.length === 0 ? (
                          <div className="p-4 text-sm text-muted-foreground">No items yet. Add a lesson, quiz, assignment, or live class.</div>
                        ) : (
                          items.map((item) => (
                            <SortableItem
                              key={`${item.kind}:${item.id}`}
                              item={item}
                              sections={sections}
                              onMove={(it, sid) => moveItem.mutate({ item: it, sectionId: sid })}
                              onEdit={() => {
                                if (item.kind === "lesson") {
                                  setLessonDefaults({ section: item.section_id, initial: item.raw });
                                  setLessonOpen(true);
                                } else if (item.kind === "quiz") {
                                  setQuizInitial(item.raw); setQuizSection(item.section_id); setQuizOpen(true);
                                } else if (item.kind === "assignment") {
                                  setAsgnInitial(item.raw); setAsgnSection(item.section_id); setAsgnOpen(true);
                                } else {
                                  setLiveInitial(item.raw); setLiveSection(item.section_id); setLiveOpen(true);
                                }
                              }}
                              onDelete={() => deleteItem.mutate(item)}
                            />
                          ))
                        )}
                      </SortableContext>
                    </DndContext>
                  )}
                </SortableSection>
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      {/* Items not assigned to any section */}
      {(itemsBySection["_unassigned"] ?? []).length > 0 && (
        <Card className="border-border shadow-none">
          <div className="px-4 py-3 border-b border-border font-semibold text-sm">Unassigned items</div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleItemDrag("_unassigned", e)}>
            <SortableContext
              items={(itemsBySection["_unassigned"] ?? []).map((it) => `${it.kind}:${it.id}`)}
              strategy={verticalListSortingStrategy}
            >
              {(itemsBySection["_unassigned"] ?? []).map((item) => (
                <SortableItem
                  key={`${item.kind}:${item.id}`}
                  item={item}
                  sections={sections}
                  onMove={(it, sid) => moveItem.mutate({ item: it, sectionId: sid })}
                  onEdit={() => {
                    if (item.kind === "lesson") {
                      setLessonDefaults({ section: null, initial: item.raw }); setLessonOpen(true);
                    } else if (item.kind === "quiz") {
                      setQuizInitial(item.raw); setQuizOpen(true);
                    } else if (item.kind === "assignment") {
                      setAsgnInitial(item.raw); setAsgnOpen(true);
                    } else {
                      setLiveInitial(item.raw); setLiveOpen(true);
                    }
                  }}
                  onDelete={() => deleteItem.mutate(item)}
                />
              ))}
            </SortableContext>
          </DndContext>
        </Card>
      )}

      <LessonFormDialog
        open={lessonOpen}
        onOpenChange={(v) => {
          setLessonOpen(v);
          if (!v) qc.invalidateQueries({ queryKey: ["builder-curriculum", courseId] });
        }}
        initial={lessonDefaults.initial}
        workspaceId={workspaceId}
        courseId={courseId}
        defaultSectionId={lessonDefaults.section}
      />
      <QuizModal
        open={quizOpen} onOpenChange={setQuizOpen}
        workspaceId={workspaceId} courseId={courseId} sectionId={quizSection} initial={quizInitial}
      />
      <AssignmentModal
        open={asgnOpen} onOpenChange={setAsgnOpen}
        workspaceId={workspaceId} courseId={courseId} sectionId={asgnSection} initial={asgnInitial}
      />
      <LiveClassModal
        open={liveOpen} onOpenChange={setLiveOpen}
        workspaceId={workspaceId} courseId={courseId} sectionId={liveSection} initial={liveInitial}
      />
    </div>
  );
}
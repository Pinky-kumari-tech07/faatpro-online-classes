import { SelectItem } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

type CourseRow = {
  id: string;
  title: string;
  status?: string | null;
  visibility?: string | null;
};

function statusLabel(c: CourseRow): { label: string; variant: "default" | "secondary" | "outline" | "destructive" } {
  if (c.status === "archived") return { label: "Archived", variant: "destructive" };
  if (c.status === "draft") return { label: "Draft", variant: "secondary" };
  if (c.status === "unpublished") return { label: "Unpublished", variant: "secondary" };
  if (c.visibility === "private") return { label: "Private", variant: "outline" };
  if (c.status && c.status !== "published") {
    return { label: c.status.charAt(0).toUpperCase() + c.status.slice(1), variant: "secondary" };
  }
  return { label: "Published", variant: "default" };
}

interface Props {
  courses: CourseRow[];
  isLoading?: boolean;
  error?: unknown;
}

/**
 * Renders the option list for a course <Select> with status badges,
 * plus loading + empty states. Drop-in inside <SelectContent>.
 */
export function CourseSelectItems({ courses, isLoading, error }: Props) {
  if (isLoading) {
    return <div className="px-2 py-3 text-sm text-muted-foreground">Loading courses…</div>;
  }
  if (error) {
    const message = error instanceof Error ? error.message : "Unable to load courses";
    return <div className="px-2 py-3 text-sm text-destructive">{message}</div>;
  }
  if (!courses.length) {
    return <div className="px-2 py-3 text-sm text-muted-foreground">No courses available</div>;
  }
  return (
    <>
      {courses.map((c) => {
        const s = statusLabel(c);
        return (
          <SelectItem key={c.id} value={c.id}>
            <span className="flex items-center gap-2">
              <span className="truncate">{c.title}</span>
              <Badge variant={s.variant} className="text-[10px] px-1.5 py-0">{s.label}</Badge>
            </span>
          </SelectItem>
        );
      })}
    </>
  );
}
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, FileText, Video, ClipboardList, Users, Award } from "lucide-react";
import { activityService } from "@/services/supabase";
import { useWorkspace } from "@/shared/hooks/useWorkspace";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

const iconMap = {
  course: BookOpen, enrollment: Users, assignment: FileText,
  quiz: ClipboardList, live_class: Video, certificate: Award,
};

const FILTERS = [
  { id: "all", label: "All", types: null as null | string[] },
  { id: "courses", label: "Courses", types: ["course"] },
  { id: "students", label: "Students", types: ["enrollment"] },
  { id: "learning", label: "Learning", types: ["assignment", "quiz", "live_class"] },
  { id: "certificates", label: "Certificates", types: ["certificate"] },
];

export default function ActivityFeed() {
  const { membership } = useWorkspace();
  const [filter, setFilter] = useState("all");
  const { data = [] } = useQuery({
    queryKey: ["activity-feed", membership!.workspace.id],
    queryFn: () => activityService.recent(membership!.workspace.id),
  });
  const filtered = useMemo(() => {
    const f = FILTERS.find((x) => x.id === filter);
    if (!f?.types) return data;
    return data.filter((a) => f.types!.includes(a.type));
  }, [data, filter]);

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "text-xs px-2.5 py-1 rounded-full border transition-colors",
              filter === f.id
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border hover:bg-surface-muted"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <div className="text-sm text-muted-foreground py-8 text-center">No activity to show.</div>
      ) : (
        <ol className="relative border-l border-border/70 ml-3 space-y-3 pl-4">
          {filtered.map((a) => {
            const Icon = iconMap[a.type];
            return (
              <li key={a.id} className="relative">
                <span className="absolute -left-[26px] top-0.5 h-7 w-7 rounded-full bg-primary-soft text-primary grid place-items-center ring-4 ring-background">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm leading-snug">{a.title}</p>
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground bg-surface-muted px-1.5 py-0.5 rounded">{a.type.replace("_", " ")}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{formatDistanceToNow(new Date(a.at), { addSuffix: true })}</p>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
  }
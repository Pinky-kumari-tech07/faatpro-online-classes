import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { publicCourseService } from "../services/publicCourseService";

export default function InstructorsPage() {
  const { data = [], isLoading } = useQuery({
    queryKey: ["public-instructors"],
    queryFn: () => publicCourseService.listInstructors(),
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
      <h1 className="text-4xl font-bold">Meet our instructors</h1>
      <p className="text-muted-foreground mt-2 max-w-2xl">Practitioners and mentors helping learners turn knowledge into outcomes.</p>

      <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
        {!isLoading && data.length === 0 && (
          <div className="text-muted-foreground col-span-full">Instructor profiles will appear here as courses are published.</div>
        )}
        {data.map((i: any) => (
          <Link
            key={i.id}
            to={`/instructors/${i.id}`}
            className="block group"
          >
          <Card className="p-6 border-border text-center transition-all group-hover:border-primary group-hover:shadow-lg group-hover:-translate-y-0.5">
            <div className="h-20 w-20 mx-auto rounded-full bg-gradient-brand grid place-items-center text-primary-foreground text-2xl font-bold overflow-hidden">
              {i.avatar ? <img src={i.avatar} alt={i.name} className="w-full h-full object-cover" /> : i.name.charAt(0)}
            </div>
            <div className="mt-4 font-semibold group-hover:text-primary">{i.name}</div>
            <div className="text-xs text-muted-foreground mt-1">{i.count} courses</div>
            <div className="mt-3 flex flex-wrap justify-center gap-1">
              {i.categories.slice(0, 3).map((c: string) => <Badge key={c} variant="secondary">{c}</Badge>)}
            </div>
            <div className="mt-4 text-xs text-muted-foreground">
              {i.verified ? "✓ Verified" : "Instructor"} · {i.students ?? 0} students
            </div>
          </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
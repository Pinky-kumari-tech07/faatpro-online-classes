import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, ArrowRight, PlayCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/shared/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import PageHeader from "@/modules/shared/PageHeader";
import { useRealtimeInvalidate } from "@/shared/hooks/useRealtimeInvalidate";

export default function StudentCoursesPage() {
  const { user } = useAuth();

  useRealtimeInvalidate(
    ["enrollments", "courses", "lessons", "lesson_progress"],
    [["my-courses"]],
  );

  const { data, isLoading } = useQuery({
    queryKey: ["my-courses", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("id, status, course_id, enrolled_at, courses(id, title, slug, summary, thumbnail_url, profiles:profiles!courses_instructor_id_fkey(full_name))")
        .eq("student_id", user!.id)
        .order("enrolled_at", { ascending: false });

      const activeEnrollments = (enrollments ?? []).filter((e: any) => e.courses);
      const courseIds = activeEnrollments.map((e: any) => e.course_id);
      const [lessonsRes, progressRes] = await Promise.all([
        courseIds.length
          ? supabase.from("lessons").select("id, course_id").in("course_id", courseIds)
          : Promise.resolve({ data: [] as any[] }),
        courseIds.length
          ? supabase.from("lesson_progress").select("lesson_id, is_completed").eq("student_id", user!.id)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const lessonsByCourse: Record<string, string[]> = {};
      (lessonsRes.data ?? []).forEach((l: any) => {
        (lessonsByCourse[l.course_id] ||= []).push(l.id);
      });
      const completedSet = new Set(
        (progressRes.data ?? []).filter((p: any) => p.is_completed).map((p: any) => p.lesson_id),
      );

      return activeEnrollments.map((e: any) => {
        const lessonIds = lessonsByCourse[e.course_id] ?? [];
        const completed = lessonIds.filter((id) => completedSet.has(id)).length;
        const total = lessonIds.length;
        const progress = total ? Math.round((completed / total) * 100) : 0;
        return { ...e, _lessonCount: total, _completed: completed, _progress: progress };
      });
    },
  });

  const enrollments = useMemo(() => data ?? [], [data]);

  return (
    <div className="space-y-6 max-w-7xl">
      <PageHeader
        title="My courses"
        description="Pick up where you left off and keep your learning streak going."
        actions={
          <Button asChild variant="outline">
            <Link to="/courses">Browse catalogue</Link>
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
        </div>
      ) : enrollments.length === 0 ? (
        <Card className="p-12 text-center border-dashed border-border shadow-none">
          <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 grid place-items-center mb-4">
            <BookOpen className="h-7 w-7 text-primary" />
          </div>
          <h3 className="text-lg font-semibold">No courses enrolled yet</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            Browse the catalogue to enroll in your first course and start learning today.
          </p>
          <Button asChild className="mt-5"><Link to="/courses">Browse courses</Link></Button>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {enrollments.map((e: any) => (
            <Link key={e.id} to={`/learn/${e.course_id}`} className="group block">
              <Card className="overflow-hidden border-border shadow-none hover:shadow-soft hover:-translate-y-0.5 transition-all h-full flex flex-col">
                <div className="aspect-video bg-gradient-brand relative overflow-hidden">
                  {e.courses?.thumbnail_url ? (
                    <img
                      src={e.courses.thumbnail_url}
                      alt={e.courses?.title}
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="absolute inset-0 grid place-items-center">
                      <PlayCircle className="h-10 w-10 text-primary-foreground/80" />
                    </div>
                  )}
                </div>
                <div className="p-4 space-y-3 flex-1 flex flex-col">
                  <div>
                    <h4 className="font-semibold line-clamp-1 group-hover:text-primary transition-colors">
                      {e.courses?.title ?? "Untitled course"}
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {e.courses?.profiles?.full_name ?? "FAATPRO Instructor"} · {e._lessonCount} lessons
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {e.courses?.summary ?? "Continue your learning journey."}
                  </p>
                  <div className="mt-auto space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{e._completed}/{e._lessonCount} lessons</span>
                      <span className="font-medium text-foreground">{e._progress}%</span>
                    </div>
                    <Progress value={e._progress} className="h-1.5" />
                    <Button size="sm" variant="ghost" className="w-full justify-between gap-2 -mx-1">
                      Continue learning <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
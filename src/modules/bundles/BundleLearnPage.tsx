import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, CheckCircle2, PackageOpen } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import PageHeader from "@/modules/shared/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/shared/hooks/useAuth";
import { getBundle, getBundleCourses, bundleProgressForStudent } from "./bundlesService";

export default function BundleLearnPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: bundle } = useQuery({ queryKey: ["bundle", id], queryFn: () => getBundle(id!), enabled: !!id });
  const { data: courses = [] } = useQuery({ queryKey: ["bundle-courses", id], queryFn: () => getBundleCourses(id!), enabled: !!id });
  const { data: progress } = useQuery({
    queryKey: ["bundle-progress", id, user?.id],
    queryFn: () => bundleProgressForStudent(user!.id, id!),
    enabled: !!id && !!user,
  });
  const { data: enrollMap = {} } = useQuery({
    queryKey: ["bundle-enroll-map", id, user?.id],
    queryFn: async () => {
      const courseIds = courses.map((c: any) => c.course_id);
      if (!courseIds.length) return {};
      const { data } = await supabase.from("enrollments").select("course_id, status").eq("student_id", user!.id).in("course_id", courseIds);
      const m: Record<string, string> = {};
      (data ?? []).forEach((e: any) => { m[e.course_id] = e.status; });
      return m;
    },
    enabled: !!user && courses.length > 0,
  });

  if (!bundle) return null;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <PageHeader
        title={bundle.name}
        description={bundle.short_description ?? ""}
        actions={<Button variant="outline" onClick={() => navigate("/app/bundles/me")}><ArrowLeft className="h-4 w-4 mr-2" />My bundles</Button>}
      />

      <Card className="p-5">
        <div className="flex items-center justify-between mb-2">
          <div className="font-medium">Bundle progress</div>
          <div className="text-sm text-muted-foreground">{progress?.completed ?? 0} / {progress?.total ?? 0} courses</div>
        </div>
        <Progress value={progress?.progress ?? 0} />
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {courses.map((bc: any) => {
          const c = bc.courses;
          if (!c) return null;
          const status = enrollMap[c.id];
          return (
            <Link key={bc.id} to={`/app/courses/${c.id}`}>
              <Card className="overflow-hidden hover:shadow-md transition-shadow h-full">
                <div className="aspect-video bg-muted">
                  {c.thumbnail_url ? <img src={c.thumbnail_url} className="h-full w-full object-cover" /> : <div className="h-full w-full flex items-center justify-center"><BookOpen className="h-10 w-10 text-muted-foreground" /></div>}
                </div>
                <div className="p-4 space-y-2">
                  <div className="font-medium line-clamp-2">{c.title}</div>
                  {status === "completed" ? (
                    <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" />Completed</Badge>
                  ) : (
                    <Badge variant="secondary" className="capitalize">{status ?? "active"}</Badge>
                  )}
                </div>
              </Card>
            </Link>
          );
        })}
        {courses.length === 0 && (
          <Card className="p-8 text-center text-muted-foreground col-span-full">
            <PackageOpen className="h-8 w-8 mx-auto mb-2" />No courses in this bundle yet.
          </Card>
        )}
      </div>
    </div>
  );
}

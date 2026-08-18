import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { PackageOpen, BookOpen, Award, GraduationCap } from "lucide-react";
import { useAuth } from "@/shared/hooks/useAuth";
import PageHeader from "@/modules/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { listMyBundles, bundleProgressForStudent } from "./bundlesService";

export default function StudentBundlesPage() {
  const { user } = useAuth();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["my-bundles", user?.id],
    queryFn: () => listMyBundles(user!.id),
    enabled: !!user,
  });

  return (
    <div className="container mx-auto py-6 space-y-6">
      <PageHeader title="My bundles" description="Bundles you have been enrolled in." />
      {isLoading ? (
        <div className="text-center text-muted-foreground py-12">Loading...</div>
      ) : rows.length === 0 ? (
        <Card className="p-12 text-center">
          <PackageOpen className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
          <div className="font-medium">No bundles yet</div>
          <div className="text-sm text-muted-foreground">Bundles assigned to you will appear here.</div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map((r: any) => <BundleCard key={r.id} row={r} userId={user!.id} />)}
        </div>
      )}
    </div>
  );
}

function BundleCard({ row, userId }: { row: any; userId: string }) {
  const b = row.bundle;
  const { data: progress } = useQuery({
    queryKey: ["bundle-progress", row.bundle?.id, userId],
    queryFn: () => bundleProgressForStudent(userId, row.bundle.id),
    enabled: !!row.bundle?.id,
  });
  if (!b) return null;
  return (
    <Link to={`/app/bundles/learn/${b.id}`}>
      <Card className="overflow-hidden hover:shadow-md transition-shadow h-full">
        <div className="aspect-video bg-muted relative">
          {b.thumbnail_url ? (
            <img src={b.thumbnail_url} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full flex items-center justify-center"><PackageOpen className="h-10 w-10 text-muted-foreground" /></div>
          )}
          {b.certificate_mode !== "individual" && (
            <Badge className="absolute top-2 right-2"><Award className="h-3 w-3 mr-1" />Bundle cert</Badge>
          )}
        </div>
        <div className="p-4 space-y-3">
          <div>
            <div className="font-semibold line-clamp-1">{b.name}</div>
            <div className="text-xs text-muted-foreground line-clamp-2">{b.short_description}</div>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" />{progress?.total ?? 0} courses</div>
            <div className="flex items-center gap-1"><GraduationCap className="h-3.5 w-3.5" />{progress?.completed ?? 0} done</div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs"><span>Progress</span><span>{progress?.progress ?? 0}%</span></div>
            <Progress value={progress?.progress ?? 0} />
          </div>
        </div>
      </Card>
    </Link>
  );
}

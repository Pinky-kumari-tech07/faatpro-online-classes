import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/shared/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, Star, Users, BookOpen, ArrowRight } from "lucide-react";
import CoursePrice from "@/modules/shared/CoursePrice";

const PAGE_SIZE = 8;

const BADGE_META: Record<string, { label: string; className: string }> = {
  best_seller: { label: "Best Seller", className: "bg-amber-500 text-white" },
  featured: { label: "Featured", className: "bg-violet-600 text-white" },
  trending: { label: "Trending", className: "bg-rose-500 text-white" },
  editors_choice: { label: "Editor's Choice", className: "bg-sky-600 text-white" },
  new: { label: "New", className: "bg-emerald-500 text-white" },
};

function getActiveBadges(course: any): string[] {
  const raw = course?.badges;
  let arr: string[] = Array.isArray(raw) ? raw.filter((x) => typeof x === "string") : [];
  const createdAt = course?.created_at ? new Date(course.created_at).getTime() : null;
  if (createdAt && Date.now() - createdAt <= 30 * 24 * 60 * 60 * 1000 && !arr.includes("new")) {
    arr = ["new", ...arr];
  }
  if (course?.is_featured && !arr.includes("featured")) arr = [...arr, "featured"];
  return arr.filter((k) => BADGE_META[k]);
}

function rankCourse(c: any, sigCategories: Set<string>, sigInstructors: Set<string>) {
  if (c.category && sigCategories.has(c.category)) return 1;
  if (c.instructor_id && sigInstructors.has(c.instructor_id)) return 2;
  if (c.is_featured || (c.badges || []).includes?.("featured")) return 3;
  if ((c.badges || []).includes?.("best_seller")) return 4;
  if ((c.badges || []).includes?.("trending")) return 5;
  return 6;
}

export default function RecommendedCourses() {
  const { user } = useAuth();
  const [visible, setVisible] = useState(PAGE_SIZE);

  const { data, isLoading } = useQuery({
    enabled: !!user?.id,
    queryKey: ["recommended-courses", user?.id],
    queryFn: async () => {
      // Get the student's enrolled course ids (with category and instructor signals)
      const { data: enrolls } = await supabase
        .from("enrollments")
        .select("course_id, courses:course_id(category, instructor_id)")
        .eq("student_id", user!.id);
      const enrolledIds = new Set<string>();
      const sigCategories = new Set<string>();
      const sigInstructors = new Set<string>();
      (enrolls ?? []).forEach((e: any) => {
        if (e.course_id) enrolledIds.add(e.course_id);
        if (e.courses?.category) sigCategories.add(e.courses.category);
        if (e.courses?.instructor_id) sigInstructors.add(e.courses.instructor_id);
      });

      const { data: courses } = await supabase
        .from("courses")
        .select(
          "id, title, slug, summary, thumbnail_url, category, subcategory, price_amount, currency, pricing_type, sale_price, discount_type, discount_value, discount_starts_at, discount_ends_at, instructor_id, badges, is_featured, created_at, profiles:profiles!courses_instructor_id_fkey(full_name, avatar_url)"
        )
        .is("deleted_at", null)
        .eq("status", "published")
        .eq("visibility", "public")
        .order("created_at", { ascending: false })
        .limit(60);

      const filtered = (courses ?? []).filter((c: any) => !enrolledIds.has(c.id));
      filtered.sort((a: any, b: any) => {
        const ra = rankCourse(a, sigCategories, sigInstructors);
        const rb = rankCourse(b, sigCategories, sigInstructors);
        if (ra !== rb) return ra - rb;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      // Dedup by id (defensive)
      const seen = new Set<string>();
      return filtered.filter((c: any) => (seen.has(c.id) ? false : (seen.add(c.id), true)));
    },
  });

  const items = (data ?? []).slice(0, visible);
  const hasMore = (data?.length ?? 0) > visible;

  return (
    <Card className="rounded-2xl p-4 border-border/60 shadow-none">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <span className="h-7 w-7 rounded-lg bg-gradient-to-br from-amber-500 to-rose-500 text-white grid place-items-center">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          Recommended Courses For You
        </h3>
        <Button asChild variant="ghost" size="sm" className="rounded-full text-xs h-7">
          <Link to="/courses">
            Browse all <ArrowRight className="h-3 w-3 ml-1" />
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">
          No recommendations yet. Check back soon!
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {items.map((c: any) => {
              const badges = getActiveBadges(c);
              const instructorName = c.profiles?.full_name ?? "Instructor";
              return (
                <Card key={c.id} className="overflow-hidden border-border/60 flex flex-col group hover:shadow-md hover:-translate-y-0.5 transition-all">
                  <Link to={`/courses/${c.slug}`} className="block">
                    <div className="aspect-video bg-gradient-to-br from-violet-500 to-fuchsia-500 relative overflow-hidden">
                      {c.thumbnail_url ? (
                        <img
                          src={c.thumbnail_url}
                          alt={c.title}
                          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="absolute inset-0 grid place-items-center text-white/80">
                          <BookOpen className="h-8 w-8" />
                        </div>
                      )}
                      {badges.length > 0 && (
                        <div className="absolute top-2 right-2 flex flex-col items-end gap-1 max-w-[80%]">
                          {badges.map((k) => (
                            <Badge
                              key={k}
                              className={`text-[9px] font-semibold px-1.5 py-0.5 border-transparent ${BADGE_META[k].className}`}
                            >
                              {BADGE_META[k].label}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </Link>
                  <div className="p-3 flex-1 flex flex-col">
                    <Link to={`/courses/${c.slug}`} className="font-semibold text-sm line-clamp-2 group-hover:text-primary">
                      {c.title}
                    </Link>
                    <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1">
                      {instructorName}
                    </p>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-2">
                      <span className="inline-flex items-center gap-1">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        {c.rating ?? "4.8"}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {c.student_count ?? 0}
                      </span>
                    </div>
                    <div className="mt-2">
                      <CoursePrice course={c} size="sm" />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-1.5">
                      <Button asChild size="sm" variant="outline" className="h-8 text-xs">
                        <Link to={`/courses/${c.slug}`}>View</Link>
                      </Button>
                      <Button asChild size="sm" className="h-8 text-xs">
                        <Link to={`/courses/${c.slug}?action=enroll`}>Enroll</Link>
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
          {hasMore && (
            <div className="mt-4 text-center">
              <Button variant="outline" size="sm" onClick={() => setVisible((n) => n + PAGE_SIZE)}>
                Load more
              </Button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
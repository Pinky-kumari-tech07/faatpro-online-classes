import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, BookOpen, Clock, Star, Timer } from "lucide-react";
import CoursePrice from "@/modules/shared/CoursePrice";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import InstructorHoverCard from "./InstructorHoverCard";
import { coursePricingService } from "@/services/supabase/coursePricingService";

const BADGE_META: Record<string, { label: string; className: string }> = {
  best_seller: {
    label: "Best Seller",
    className: "bg-amber-500 text-white border-transparent shadow-sm",
  },
  featured: {
    label: "Featured",
    className: "bg-violet-600 text-white border-transparent shadow-sm",
  },
  trending: {
    label: "Trending",
    className: "bg-rose-500 text-white border-transparent shadow-sm",
  },
  editors_choice: {
    label: "Editor's Choice",
    className: "bg-sky-600 text-white border-transparent shadow-sm",
  },
  new: {
    label: "New",
    className: "bg-emerald-500 text-white border-transparent shadow-sm",
  },
};

function getActiveBadges(course: any): string[] {
  const raw = course?.badges;
  let arr: string[] = [];
  if (Array.isArray(raw)) arr = raw.filter((x) => typeof x === "string");
  // Auto "New": within 30 days of created_at, unless already present
  const createdAt = course?.created_at ? new Date(course.created_at).getTime() : null;
  if (createdAt && Date.now() - createdAt <= 30 * 24 * 60 * 60 * 1000) {
    if (!arr.includes("new")) arr = ["new", ...arr];
  }
  // Legacy: is_featured boolean → featured badge
  if (course?.is_featured && !arr.includes("featured")) arr = [...arr, "featured"];
  return arr.filter((k) => BADGE_META[k]);
}

export default function CourseCard({
  course,
  disableInstructorHoverCard = false,
}: {
  course: any;
  disableInstructorHoverCard?: boolean;
}) {
  const duration: string | undefined = course.duration;
  const navigate = useNavigate();
  const instructorId: string | undefined = course.instructor_id;
  const activeBadges = getActiveBadges(course);
  const saleMs = coursePricingService.saleMsRemaining(course);
  // Show countdown chip when sale ends within 7 days
  const showCountdown = saleMs !== null && saleMs > 0 && saleMs <= 7 * 24 * 3600 * 1000;
  const [, force] = useState(0);
  useEffect(() => {
    if (!showCountdown) return;
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [showCountdown]);
  const fmtCountdown = (ms: number) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (d > 0) return `${d}d ${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };
  const instructorName: string =
    course.profiles?.full_name ?? course.instructor_name ?? "Course Instructor";
  const instructorAvatar: string | null = course.profiles?.avatar_url ?? null;
  const initials = instructorName
    .split(/\s+/)
    .map((p: string) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const InstructorRow = (
    <span className="inline-flex items-center gap-2 min-w-0 max-w-full">
      <Avatar className="h-6 w-6 shrink-0">
        <AvatarImage src={instructorAvatar ?? undefined} alt={instructorName} />
        <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
          {initials || "I"}
        </AvatarFallback>
      </Avatar>
      <span className="truncate">
        Instructor: <span className="font-medium text-foreground">{instructorName}</span>
      </span>
    </span>
  );

  return (
    <Link to={`/courses/${course.slug}`} className="group block h-full">
      <Card className="overflow-hidden border-border h-full flex flex-col transition-all duration-300 group-hover:-translate-y-1 group-hover:border-primary group-hover:shadow-lg">
        <div className="aspect-video bg-gradient-brand relative overflow-hidden">
          {course.thumbnail_url ? (
            <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-primary-foreground/80 transition-transform duration-500 group-hover:scale-110">
              <BookOpen className="h-10 w-10" />
            </div>
          )}
          {course.category && (
            <Badge className="absolute top-3 left-3 bg-primary text-primary-foreground hover:bg-primary border-transparent">
              {course.category}{course.subcategory ? ` › ${course.subcategory}` : ""}
            </Badge>
          )}
          {activeBadges.length > 0 && (
            <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5 max-w-[60%]">
              {activeBadges.map((k) => (
                <Badge
                  key={k}
                  className={`text-[10px] font-semibold px-2 py-0.5 ${BADGE_META[k].className}`}
                >
                  {BADGE_META[k].label}
                </Badge>
              ))}
            </div>
          )}
          {showCountdown && saleMs !== null && (
            <div className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-md bg-black/70 backdrop-blur-sm text-white px-2 py-1 text-[10px] font-semibold">
              <Timer className="h-3 w-3" />
              <span>Sale ends in {fmtCountdown(saleMs)}</span>
            </div>
          )}
        </div>
        <div className="p-4 flex-1 flex flex-col">
          <h3 className="font-semibold leading-snug group-hover:text-primary line-clamp-2">{course.title}</h3>
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{course.summary}</p>
          <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground min-w-0">
            <div className="min-w-0 flex-1" onClick={(e) => e.preventDefault()}>
              {instructorId && disableInstructorHoverCard ? (
                // The whole card is already an <a>; a nested <a> is invalid HTML,
                // so navigate imperatively instead.
                <span
                  role="link"
                  tabIndex={0}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    navigate(`/instructors/${instructorId}`);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      navigate(`/instructors/${instructorId}`);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 hover:text-primary max-w-full cursor-pointer"
                >
                  {InstructorRow}
                </span>
              ) : instructorId ? (
                <InstructorHoverCard
                  instructorId={instructorId}
                  fallbackName={instructorName}
                  fallbackAvatar={instructorAvatar}
                >
                  {InstructorRow}
                </InstructorHoverCard>
              ) : (
                InstructorRow
              )}
            </div>
            {duration && (
              <span className="flex items-center gap-1 shrink-0"><Clock className="h-3.5 w-3.5" /> {duration}</span>
            )}
          </div>
          <div className="mt-auto pt-4 flex items-center justify-between">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Star className="h-3.5 w-3.5 fill-warning text-warning" /> {course.rating ?? "4.8"}
            </div>
            <CoursePrice course={course} size="sm" />
          </div>
          <div className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all">
            View course <ArrowRight className="h-3.5 w-3.5" />
          </div>
        </div>
      </Card>
    </Link>
  );
}
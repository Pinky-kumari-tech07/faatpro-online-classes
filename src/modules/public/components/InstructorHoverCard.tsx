import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, GraduationCap, BadgeCheck, Briefcase, Star } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  instructorPublicService,
  parseExpertise,
  type PublicInstructor,
} from "../services/instructorPublicService";

function initials(name: string) {
  return name.split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

function CardBody({ data, loading }: { data: PublicInstructor | null | undefined; loading: boolean }) {
  if (loading || !data) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-1.5 flex-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
      </div>
    );
  }
  const tags = parseExpertise(data.expertise);
  const verified = data.verification_status === "approved";
  const bio = data.bio ? (data.bio.length > 140 ? data.bio.slice(0, 140) + "…" : data.bio) : null;

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <Avatar className="h-12 w-12 ring-2 ring-primary/10">
          <AvatarImage src={data.avatar_url ?? undefined} alt={data.full_name} />
          <AvatarFallback className="bg-primary/10 text-primary font-semibold">
            {initials(data.full_name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold leading-tight truncate">{data.full_name}</span>
            {verified && (
              <BadgeCheck
                className="h-4 w-4 text-primary shrink-0"
                aria-label="Verified instructor"
              />
            )}
          </div>
          {data.designation && (
            <div className="text-xs text-muted-foreground truncate">{data.designation}</div>
          )}
        </div>
      </div>

      {bio && <p className="text-sm text-muted-foreground leading-relaxed">{bio}</p>}

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Star className="h-3.5 w-3.5 fill-warning text-warning" />
          <span className="text-foreground font-medium">4.8</span> rating
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <BookOpen className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium">{data.total_courses}</span>{" "}
          {data.total_courses === 1 ? "course" : "courses"}
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <GraduationCap className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium">
            {data.total_students.toLocaleString()}
          </span>{" "}
          students
        </div>
        {data.years_experience != null && data.years_experience > 0 && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Briefcase className="h-3.5 w-3.5" />
            <span className="text-foreground font-medium">{data.years_experience}</span> yrs exp.
          </div>
        )}
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {tags.map((t) => (
            <Badge key={t} variant="secondary" className="text-[10px] font-medium">
              {t}
            </Badge>
          ))}
        </div>
      )}

      <Button asChild size="sm" className="w-full mt-1">
        <Link to={`/instructors/${data.id}`}>View profile</Link>
      </Button>
    </div>
  );
}

export default function InstructorHoverCard({
  instructorId,
  fallbackName,
  fallbackAvatar,
  children,
}: {
  instructorId: string;
  fallbackName?: string;
  fallbackAvatar?: string | null;
  children: ReactNode;
}) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["public-instructor", instructorId],
    queryFn: () => instructorPublicService.getInstructorById(instructorId),
    enabled: enabled && !!instructorId,
    staleTime: 5 * 60 * 1000,
  });

  if (!instructorId) return <>{children}</>;

  if (isMobile) {
    return (
      <>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setEnabled(true);
            setOpen(true);
          }}
          className="inline-flex items-center gap-1.5 hover:text-primary text-left max-w-full"
          aria-label={`View instructor ${fallbackName ?? ""} profile`}
        >
          {children}
        </button>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="bottom" className="rounded-t-2xl">
            <SheetHeader className="text-left">
              <SheetTitle>Instructor</SheetTitle>
            </SheetHeader>
            <div className="mt-4">
              <CardBody
                data={data ?? {
                  id: instructorId,
                  full_name: fallbackName ?? "Instructor",
                  avatar_url: fallbackAvatar ?? null,
                  bio: null,
                  designation: null,
                  expertise: null,
                  years_experience: null,
                  linkedin_url: null,
                  social_links: null,
                  verification_status: null,
                  total_courses: 0,
                  total_students: 0,
                  average_rating: null,
                  total_reviews: null,
                }}
                loading={isLoading && !data}
              />
            </div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <HoverCard openDelay={120} closeDelay={80} onOpenChange={(v) => v && setEnabled(true)}>
      <HoverCardTrigger asChild>
        {/* Rendered as a span, not a <Link>: this trigger sits inside the course
            card's own <a>, and a nested anchor is invalid HTML. */}
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
          {children}
        </span>
      </HoverCardTrigger>
      <HoverCardContent
        side="top"
        align="start"
        className="w-80 rounded-2xl shadow-xl border-border p-5 animate-in fade-in-0 zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        <CardBody data={data} loading={isLoading} />
      </HoverCardContent>
    </HoverCard>
  );
}
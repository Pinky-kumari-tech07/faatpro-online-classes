import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BadgeCheck,
  BookOpen,
  GraduationCap,
  Briefcase,
  Star,
  Linkedin,
  Globe,
  ArrowLeft,
} from "lucide-react";
import {
  instructorPublicService,
  parseExpertise,
} from "../services/instructorPublicService";
import CourseCard from "../components/CourseCard";

export default function InstructorProfilePage() {
  const { id } = useParams<{ id: string }>();

  const { data: instructor, isLoading } = useQuery({
    queryKey: ["public-instructor", id],
    queryFn: () => instructorPublicService.getInstructorById(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });

  const { data: courses = [] } = useQuery({
    queryKey: ["public-instructor-courses", id],
    queryFn: () => instructorPublicService.listInstructorCourses(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  if (!instructor) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-20 text-center">
        <h1 className="text-2xl font-bold">Instructor not found</h1>
        <p className="text-muted-foreground mt-2">
          This instructor profile is unavailable or has been removed.
        </p>
        <Button asChild className="mt-6">
          <Link to="/instructors">Browse all instructors</Link>
        </Button>
      </div>
    );
  }

  const initials = instructor.full_name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const tags = parseExpertise(instructor.expertise);
  const verified = instructor.verification_status === "approved";
  const social = (instructor.social_links ?? {}) as Record<string, string>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      <Link
        to="/instructors"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary mb-6"
      >
        <ArrowLeft className="h-4 w-4" /> All instructors
      </Link>

      <Card className="p-6 sm:p-8 border-border overflow-hidden relative">
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-brand opacity-10" aria-hidden />
        <div className="relative flex flex-col sm:flex-row sm:items-start gap-6">
          <Avatar className="h-24 w-24 ring-4 ring-background shadow-lg">
            <AvatarImage src={instructor.avatar_url ?? undefined} alt={instructor.full_name} />
            <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold">{instructor.full_name}</h1>
              {verified && (
                <Badge className="gap-1 bg-primary/10 text-primary hover:bg-primary/15 border-primary/20">
                  <BadgeCheck className="h-3.5 w-3.5" /> Verified
                </Badge>
              )}
            </div>
            {instructor.designation && (
              <p className="text-muted-foreground mt-1">{instructor.designation}</p>
            )}
            {instructor.bio && (
              <p className="mt-4 text-sm sm:text-base leading-relaxed text-foreground/90 max-w-3xl">
                {instructor.bio}
              </p>
            )}
            {tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {tags.map((t) => (
                  <Badge key={t} variant="secondary">
                    {t}
                  </Badge>
                ))}
              </div>
            )}
            {(instructor.linkedin_url || social.website) && (
              <div className="mt-4 flex gap-2">
                {instructor.linkedin_url && (
                  <Button asChild variant="outline" size="sm">
                    <a
                      href={instructor.linkedin_url}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="LinkedIn profile"
                    >
                      <Linkedin className="h-4 w-4" /> LinkedIn
                    </a>
                  </Button>
                )}
                {social.website && (
                  <Button asChild variant="outline" size="sm">
                    <a href={social.website} target="_blank" rel="noreferrer" aria-label="Website">
                      <Globe className="h-4 w-4" /> Website
                    </a>
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>

      <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Star className="h-5 w-5 fill-warning text-warning" />}
          label="Average rating"
          value="4.8"
        />
        <StatCard
          icon={<BookOpen className="h-5 w-5 text-primary" />}
          label="Published courses"
          value={instructor.total_courses}
        />
        <StatCard
          icon={<GraduationCap className="h-5 w-5 text-primary" />}
          label="Total students"
          value={instructor.total_students.toLocaleString()}
        />
        <StatCard
          icon={<Briefcase className="h-5 w-5 text-primary" />}
          label="Experience"
          value={
            instructor.years_experience ? `${instructor.years_experience} yrs` : "—"
          }
        />
      </div>

      <section className="mt-12">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl sm:text-2xl font-bold">Courses by {instructor.full_name}</h2>
          <span className="text-sm text-muted-foreground">{courses.length} total</span>
        </div>
        {courses.length === 0 ? (
          <Card className="p-10 mt-6 text-center text-muted-foreground border-dashed">
            No published courses yet.
          </Card>
        ) : (
          <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((c: any) => (
              <CourseCard key={c.id} course={c} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <Card className="p-4 border-border">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </Card>
  );
}
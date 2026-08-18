import { Link } from "react-router-dom";
import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/shared/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { TypeAnimation } from "react-type-animation";
import {
  ArrowRight,
  Video,
  Award,
  ClipboardCheck,
  Sparkles,
  GraduationCap,
  Users,
  CheckCircle2,
  PlayCircle,
  Calendar,
  Clock,
  BarChart3,
  Code2,
  Briefcase,
  Megaphone,
  Palette,
  Wallet,
  Star,
  Rocket,
  Sprout,
  Fish,
  Smartphone,
  Table2,
  FileCode2,
  BrainCircuit,
  Cpu,
  Cloud,
  Link2,
  ShieldCheck,
  BadgeCheck,
  KanbanSquare,
  ClipboardList,
  Boxes,
  Workflow,
  Wifi,
  Database,
} from "lucide-react";
import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { publicCourseService } from "../services/publicCourseService";
import CourseCard from "../components/CourseCard";
import HomeCarousel from "../components/HomeCarousel";
import { categoryService } from "@/services/supabase/categoryService";
import { supabase } from "@/integrations/supabase/client";
import { useCoursesRealtime } from "@/shared/hooks/useCoursesRealtime";
import heroStudents from "@/assets/hero-students.png.asset.json";
import faatproHero from "@/assets/faatpro-hero-new.png.asset.json";

const stats = [
  { label: "Active Learners", value: "5000+", icon: Users },
  { label: "Courses", value: "21+", icon: BookOpen },
  { label: "Expert Instructors", value: "15+", icon: GraduationCap },
  { label: "Completion Rate", value: "99.9 %", icon: BadgeCheck },
];

const STAT_ICONS = [Users, BookOpen, GraduationCap, BadgeCheck];

const features = [
  //   { icon: Clock, title: "Flexible learning schedule", desc: "Learn at your pace with structured paths that adapt to your week." },
  {
    icon: GraduationCap,
    title: "Expert Instructors",
    desc: "Practitioners who teach what they ship — not theory in isolation.",
  },
  {
    icon: ClipboardCheck,
    title: "Assignments & quizzes",
    desc: "Practice, submit, and get feedback that moves your skills forward.",
  },
  { icon: Award, title: "Verified certificates", desc: "Shareable certificates with a public verification code." },
  { icon: Video, title: "Live classes", desc: "Mentor-led sessions with recordings." },
  // { icon: BarChart3, title: "Progress tracking", desc: "Dashboards, completion %, streaks, and outcome milestones." },
];

type TrendingCategory = { label: string; slug: string; count: number | null; icon: any; iconUrl?: string | null };

const ICON_MAP: Record<string, any> = {
  Sprout,
  Fish,
  Code2,
  Smartphone,
  Table2,
  FileCode2,
  BarChart3,
  BrainCircuit,
  Cloud,
  Link2,
  ShieldCheck,
  Palette,
  BadgeCheck,
  Megaphone,
  KanbanSquare,
  ClipboardList,
  Briefcase,
  Wifi,
  Database,
  Wallet,
  Workflow,
};

// No hardcoded categories. The homepage renders whatever is in the
// `course_categories` table and always computes counts from the live
// `courses` table (published + public + not deleted only).

const testimonials = [
  {
    q: "The structure finally made things click. I went from tutorials to shipping in 6 weeks.",
    n: "Aisha Mohanty",
    r: "UI Expert",
    rating: 5,
  },
  {
    q: "Live classes plus assignments kept me accountable. The certificate is a real signal on my résumé.",
    n: "Mukesh Sahu",
    r: "Software Engineer",
    rating: 5,
  },
  {
    q: "Best learning experience I've used — calm, fast, and focused on outcomes.",
    n: "Priya Singh",
    r: "Data Analyst",
    rating: 5,
  },
];

export default function HomePage() {
  const { session, loading } = useAuth();
  const queryClient = useQueryClient();
  useCoursesRealtime([["public-featured-courses"], ["public-homepage-stats"]]);
  const { data: featured = [] } = useQuery({
    queryKey: ["public-featured-courses"],
    queryFn: () => publicCourseService.listFeaturedCourses(6),
  });
  const { data: dbCategories = [] } = useQuery({
    queryKey: ["public-trending-categories"],
    queryFn: () => categoryService.listTrendingCategories(),
  });
  const { data: liveStats } = useQuery({
    queryKey: ["public-homepage-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_public_homepage_stats");
      if (error) throw error;
      return Array.isArray(data) ? data[0] : data;
    },
    refetchOnWindowFocus: false,
  });

  // Realtime sync: refresh featured courses and trending categories on any backend change
  useEffect(() => {
    const channel = supabase
      .channel("public-home-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "courses" }, () => {
        queryClient.invalidateQueries({ queryKey: ["public-featured-courses"] });
        queryClient.invalidateQueries({ queryKey: ["public-trending-categories"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "course_categories" }, () => {
        queryClient.invalidateQueries({ queryKey: ["public-trending-categories"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Signed-in visitors go straight to the dashboard. This check must stay
  // AFTER every hook above — an early return before them renders fewer hooks
  // on the authenticated pass and crashes the page.
  if (!loading && session) {
    return <Navigate to="/app/dashboard" replace />;
  }

  const trendingCategories: TrendingCategory[] = dbCategories.map((c) => ({
        label: c.name,
        slug: c.slug,
        count: c.course_count ?? 0,
        icon: (c.icon && !/^https?:\/\//.test(c.icon) && ICON_MAP[c.icon]) || Sparkles,
        iconUrl: c.icon && /^https?:\/\//.test(c.icon) ? c.icon : null,
      }));
  const displayCourses: any[] = featured;

  const fmt = (n: number | null | undefined) => {
    const v = Number(n ?? 0);
    if (v >= 1000) return `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k+`;
    return `${v}${v > 0 ? "+" : ""}`;
  };
  const liveStatsList = [
    { label: "Active Learners", value: fmt(liveStats?.active_learners as any), icon: Users },
    { label: "Courses", value: fmt(liveStats?.courses as any), icon: BookOpen },
    { label: "Expert Instructors", value: fmt(liveStats?.expert_instructors as any), icon: GraduationCap },
    { label: "Completion Rate", value: `${Number(liveStats?.completion_rate ?? 0)}%`, icon: BadgeCheck },
  ];

  return (
    <div>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary-soft/60 via-background to-background -z-10" />
        <div className="absolute top-20 -right-32 h-96 w-96 rounded-full bg-accent/20 blur-3xl -z-10" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-10 grid lg:grid-cols-2 gap-8 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-soft text-primary text-xs font-medium">
              <Sparkles className="h-3.5 w-3.5" /> Learn Anywhere and Anytime
            </div>

            <h1 className="mt-5 text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05] tracking-tight">
              Build{" "}
              <span className="text-primary">Careers</span>
              <br />
              with structured, Programme.
            </h1>

            <p className="mt-5 text-lg text-muted-foreground max-w-xl">
              Learn through courses, live classes, quizzes, progress tracking, and verified certificates.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/courses">
                  Explore courses <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/auth/register/student?next=/courses">Start learning</Link>
              </Button>
            </div>
          </div>

          {/* Hero visual */}
          <div className="relative group flex items-center justify-center min-h-[560px]">
            {/* Soft glow */}
            <div className="absolute inset-0 bg-gradient-brand opacity-20 blur-3xl rounded-full" />

            {/* Circular themed background */}
            <div className="relative aspect-square w-[88%] max-w-[520px] rounded-full bg-gradient-brand shadow-2xl shadow-primary/30 transition-all duration-500 group-hover:scale-105 group-hover:shadow-primary/50">
              {/* Decorative rings */}
              <div className="absolute inset-0 rounded-full border border-white/20" />
              <div className="absolute -inset-4 rounded-full border border-primary/20 animate-[spin_30s_linear_infinite]" />
              <div className="absolute -inset-10 rounded-full border border-dashed border-accent/30 animate-[spin_45s_linear_infinite_reverse]" />

              {/* Hero image */}
              <img
                src={faatproHero.url}
                alt="FAATPRO student"
                className="absolute inset-0 w-full h-full object-contain drop-shadow-2xl transition-transform duration-500 group-hover:-translate-y-2"
              />

              {/* Floating icons */}
              <div className="absolute -top-4 left-6 h-14 w-14 rounded-2xl bg-white shadow-xl flex items-center justify-center animate-[float_4s_ease-in-out_infinite] transition-transform group-hover:scale-110">
                <GraduationCap className="h-7 w-7 text-primary" />
              </div>
              <div className="absolute top-1/4 -right-4 h-14 w-14 rounded-2xl bg-white shadow-xl flex items-center justify-center animate-[float_5s_ease-in-out_infinite_0.5s] transition-transform group-hover:scale-110">
                <BookOpen className="h-7 w-7 text-accent" />
              </div>
              <div className="absolute bottom-10 -left-6 h-14 w-14 rounded-2xl bg-white shadow-xl flex items-center justify-center animate-[float_4.5s_ease-in-out_infinite_1s] transition-transform group-hover:scale-110">
                <BadgeCheck className="h-7 w-7 text-primary" />
              </div>
              <div className="absolute -bottom-2 right-10 h-14 w-14 rounded-2xl bg-white shadow-xl flex items-center justify-center animate-[float_5.5s_ease-in-out_infinite_1.5s] transition-transform group-hover:scale-110">
                <Rocket className="h-7 w-7 text-accent" />
              </div>
              <div className="absolute top-1/2 -left-4 h-12 w-12 rounded-2xl bg-white shadow-xl flex items-center justify-center animate-[float_6s_ease-in-out_infinite_0.8s] transition-transform group-hover:scale-110">
                <Star className="h-6 w-6 text-warning" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURED COURSES */}
      <section className="bg-surface-muted">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
          {/* HEADING */}
          <div className="mb-8">
            <Badge variant="secondary" className="mb-3">
              On Trending
            </Badge>

            <h2 className="text-3xl font-bold">Featured Courses</h2>

            <p className="text-muted-foreground mt-1">Curated programs from our top instructors.</p>
          </div>

          {/* CAROUSEL */}
          {displayCourses.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-background/60 py-16 text-center">
              <p className="text-muted-foreground">No published courses yet. Check back soon.</p>
            </div>
          ) : (
            <HomeCarousel
              items={displayCourses}
              keyFor={(c: any) => c.id}
              renderItem={(c: any) => <CourseCard course={c} disableInstructorHoverCard />}
              slideClassName="basis-full sm:basis-1/2 lg:basis-1/4"
              ariaLabel="Featured courses"
            />
          )}

          {/* BUTTON */}
          <div className="mt-10 text-center">
            <Button asChild size="lg" className="rounded-xl px-8">
              <Link to="/courses">
                View all courses
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* CATEGORIES */}
      {trendingCategories.length > 0 && (
      <section className="relative overflow-hidden bg-gradient-to-br from-background via-surface-muted to-background">
        {/* Decorative glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/3 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          {/* Header */}
          <div className="mb-10 text-center sm:text-left">
            <Badge
              variant="secondary"
              className="mb-4 px-4 py-1 text-sm font-semibold rounded-full bg-primary/10 text-primary border border-primary/20"
            >
              Explore
            </Badge>

            <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight">
              Course{" "}
              <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                Categories
              </span>
            </h2>

            <p className="text-muted-foreground mt-3 text-base sm:text-lg max-w-2xl">
              Find the skill area that matches your future goals and start learning with confidence.
            </p>
          </div>

          {/* Carousel */}
          <HomeCarousel
            items={trendingCategories}
            keyFor={(c) => c.slug}
            slideClassName="basis-[85%] sm:basis-1/2 lg:basis-1/4 pl-2"
            ariaLabel="Trending categories"
            delay={4000}
            renderItem={(c) => (
              <Link to={`/courses?category=${encodeURIComponent(c.slug)}`} className="block h-full group">
                <Card
                  className="
              relative overflow-hidden h-full
              rounded-3xl border border-border/50
              bg-gradient-to-br from-background to-muted/40
              p-6 sm:p-7
              transition-all duration-500
              hover:-translate-y-3
              hover:rotate-[0.5deg]
              hover:border-primary/40
              hover:shadow-[0_25px_60px_-15px_hsl(var(--primary)/0.35)]
              active:scale-[0.98]
              backdrop-blur-xl
            "
                >
                  {/* Glow effect */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition duration-500">
                    <div className="absolute -top-16 -right-16 h-40 w-40 bg-primary/10 rounded-full blur-3xl" />
                  </div>

                  {/* Top */}
                  <div className="relative flex items-start justify-between">
                    {/* 3D Icon */}
                    <div
                      className="
                  h-16 w-16 sm:h-18 sm:w-18
                  rounded-2xl
                  bg-gradient-to-br from-primary to-primary/70
                  text-primary-foreground
                  grid place-items-center
                  shadow-[0_10px_25px_hsl(var(--primary)/0.45)]
                  ring-1 ring-white/10
                  transition-all duration-500
                  group-hover:scale-110
                  group-hover:rotate-6
                "
                    >
                      {c.iconUrl ? (
                        <img
                          src={c.iconUrl}
                          alt={c.label}
                          loading="lazy"
                          className="h-10 w-10 sm:h-12 sm:w-12 object-contain drop-shadow-lg"
                        />
                      ) : (
                        <c.icon className="h-7 w-7 sm:h-8 sm:w-8 drop-shadow-lg" />
                      )}
                    </div>

                    {/* Explore */}
                    <span
                      className="
                  inline-flex items-center gap-1.5
                  text-sm font-semibold text-primary
                  opacity-0 translate-x-2
                  transition-all duration-300
                  group-hover:opacity-100
                  group-hover:translate-x-0
                "
                    >
                      Explore
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </div>

                  {/* Content */}
                  <div className="relative mt-8">
                    <h3 className="text-lg sm:text-xl font-extrabold leading-snug tracking-tight text-foreground line-clamp-2">
                      {c.label}
                    </h3>

                    <p className="mt-3 text-sm text-muted-foreground font-medium">
                      {`${c.count ?? 0} ${(c.count ?? 0) === 1 ? "course" : "courses"}`}
                    </p>
                  </div>

                  {/* Bottom gradient border */}
                  <div className="absolute bottom-0 left-0 h-1 w-0 bg-gradient-to-r from-primary to-primary/50 transition-all duration-500 group-hover:w-full rounded-full" />
                </Card>
              </Link>
            )}
          />
        </div>
      </section>
      )}

      {/* BECOME INSTRUCTOR */}
      {/* WHY */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 py-20">
        {/* Background Glow */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute top-0 left-1/4 h-72 w-72 bg-primary/20 blur-3xl rounded-full" />
          <div className="absolute bottom-0 right-1/4 h-72 w-72 bg-pink-500/10 blur-3xl rounded-full" />
        </div>

        {/* Heading */}
        <div className="max-w-2xl">
          <Badge variant="secondary" className="mb-4 px-4 py-1 text-sm rounded-full">
            Why FAATPRO
          </Badge>

          <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight">
            Everything you need
            <span className="bg-gradient-to-r from-primary to-pink-500 bg-clip-text text-transparent">
              {" "}
              to learn deeply
            </span>
          </h2>

          <p className="text-muted-foreground text-lg mt-4 leading-relaxed">
            A modern learning experience with immersive lessons, premium visuals, and distraction-free learning.
          </p>
        </div>

        {/* Cards */}
        <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-7">
          {features.map((f) => (
            <Card
              key={f.title}
              className="group relative overflow-hidden border border-white/10 bg-white/5 backdrop-blur-xl p-7 rounded-3xl transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:shadow-primary/20"
            >
              {/* Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              {/* 3D Icon */}
              <div className="relative">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-pink-500 shadow-lg shadow-primary/30 flex items-center justify-center transform transition-transform duration-500 group-hover:rotate-6 group-hover:scale-110">
                  <f.icon className="h-8 w-8 text-white drop-shadow-lg" />
                </div>
              </div>

              {/* Content */}
              <div className="relative mt-6">
                <h3 className="text-xl font-semibold tracking-tight">{f.title}</h3>

                <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{f.desc}</p>
              </div>

              {/* Bottom Glow */}
              <div className="absolute -bottom-10 -right-10 h-32 w-32 bg-primary/10 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            </Card>
          ))}
        </div>
      </section>

      {/* FREE COURSES */}
      {/* <section>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
          
          <div className="mb-8">
            <Badge variant="secondary" className="mb-3">
              Free
            </Badge>

            <h2 className="text-3xl font-bold">Free courses</h2>

            <p className="text-muted-foreground mt-1">
              Start learning today — no payment required.
            </p>
          </div>

          
          <HomeCarousel
            items={freeDisplay}
            keyFor={(c: any) => c.id}
            renderItem={(c: any) => <CourseCard course={c} disableInstructorHoverCard />}
            slideClassName="basis-full sm:basis-1/2 lg:basis-1/3"
            ariaLabel="Free courses"
            delay={5500}
          />

          
          <div className="flex justify-center mt-10">
            <Button
              asChild
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-6 rounded-xl shadow-md transition-all duration-300"
            >
              <Link to="/courses" className="flex items-center gap-2">
                Browse Catalog
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section> */}

      {/* BECOME INSTRUCTOR */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
        <div
          className="
      relative
      overflow-hidden
      rounded-[40px]
      bg-[#0d2355]
      text-white
      shadow-[0_20px_80px_rgba(0,0,0,0.18)]
    "
        >
          {/* BACKGROUND GLOW */}
          <div className="absolute -top-20 -right-20 w-72 h-72 bg-blue-500/20 rounded-full blur-3xl" />

          <div className="absolute bottom-0 left-0 w-72 h-72 bg-indigo-500/20 rounded-full blur-3xl" />

          {/* FLOATING EMOJI */}
          <div
            className="
        absolute
        top-2 sm:top-6 lg:top-10
        right-8 sm:right-12 lg:right-16
        text-6xl
        md:text-7xl
        animate-bounce
        drop-shadow-2xl
      "
          >
            🎓
          </div>

          <div className="grid lg:grid-cols-2 items-center">
            {/* LEFT SIDE */}
            <div className="relative z-10 p-8 sm:p-12 lg:p-16">
              <Badge
                className="
            bg-white/10
            text-white
            border-0
            px-4
            py-1
            rounded-full
            mb-5
          "
              >
                For Instructors
              </Badge>

              <h2 className="text-4xl md:text-5xl font-extrabold leading-tight">
                Teach with
                <span className="text-blue-300"> FAATPRO</span>
              </h2>

              <p className="mt-5 text-white/75 leading-8 max-w-xl text-lg">
                Create engaging courses, host live sessions, manage assignments, and track student growth from one
                modern teaching platform.
              </p>

              {/* FEATURES */}
              <div className="mt-10 space-y-4">
                {[
                  "Section-based course builder with videos, PDFs & lessons",
                  "Live classes, attendance tracking & recordings",
                  // "Assignments, quizzes, grading & certificates",
                  // "Real-time analytics and student progress tracking",
                ].map((item, i) => (
                  <div
                    key={i}
                    className="
                flex
                items-start
                gap-4
                bg-white/5
                border
                border-white/10
                rounded-2xl
                px-5
                py-4
                backdrop-blur-md
                hover:bg-white/10
                transition-all
                duration-300
              "
                  >
                    <div
                      className="
                  h-10
                  w-10
                  rounded-xl
                  bg-green-500/20
                  flex
                  items-center
                  justify-center
                  shrink-0
                "
                    >
                      <CheckCircle2 className="h-5 w-5 text-green-400" />
                    </div>

                    <p className="text-sm sm:text-base text-white/90 leading-relaxed">{item}</p>
                  </div>
                ))}
              </div>

              {/* BUTTONS */}
              <div className="mt-10 flex flex-wrap gap-4">
                <Button
                  asChild
                  size="lg"
                  className="
              rounded-2xl
              px-8
              h-14
              text-base
              font-semibold
              shadow-xl
              bg-white text-primary hover:bg-white/90
            "
                >
                  <Link to="/auth/register/instructor">Become an Instructor</Link>
                </Button>
              </div>
            </div>

            {/* RIGHT SIDE */}
            <div className="relative p-8 sm:p-12 lg:p-16">
              {/* IMAGE CONTAINER */}
              <div
                className="
            relative
            rounded-[32px]
            overflow-hidden
            shadow-2xl
          "
              >
                <img
                  src="/__l5e/assets-v1/50afd2d5-7ecc-408f-bf1e-d9e5155a63ed/instructor-indian.png"
                  alt="Instructor"
                  className="
              w-full
              h-[400px]
              sm:h-[500px]
              object-cover
            "
                />

                {/* IMAGE OVERLAY */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

                {/* FLOATING CARD */}
                <div
                  className="
              absolute
              top-6
              -left-4
              bg-white
              text-black
              rounded-2xl
              px-5
              py-4
              shadow-2xl
              animate-[float_4s_ease-in-out_infinite]
            "
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="
                  h-12
                  w-12
                  rounded-xl
                  bg-blue-100
                  flex
                  items-center
                  justify-center
                "
                    >
                      <Users className="h-6 w-6 text-blue-600" />
                    </div>

                    <div>
                      <div className="text-sm text-muted-foreground">Active Learners</div>

                      <div className="font-bold text-2xl">1,284+</div>
                    </div>
                  </div>
                </div>

                {/* BOTTOM GRADIENT */}
                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <div
                    className="
                bg-white/10
                backdrop-blur-md
                border
                border-white/10
                rounded-2xl
                px-5
                py-4
              "
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="
                    h-12
                    w-12
                    rounded-xl
                    bg-white/20
                    flex
                    items-center
                    justify-center
                    text-2xl
                  "
                      >
                        🚀
                      </div>

                      <div>
                        <div className="font-semibold text-lg">Grow Your Teaching Career</div>

                        <div className="text-sm text-white/70">Inspire students from anywhere in the world.</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* FLOAT ANIMATION */}
          <style>
            {`
        @keyframes float {
          0% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-12px);
          }
          100% {
            transform: translateY(0px);
          }
        }
      `}
          </style>
        </div>
      </section>
      {/* TRUST BAR */}
      <section className="bg-gradient-brand text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-8">
          {liveStatsList.map((s) => (
            <div key={s.label} className="flex items-center gap-4 justify-center md:justify-start">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
                <s.icon className="h-6 w-6 text-white" />
              </div>
              <div className="text-center md:text-left">
                <div className="text-2xl md:text-3xl font-bold tracking-tight">{s.value}</div>
                <div className="mt-1 text-sm md:text-base text-white/80">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="bg-surface-muted">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
          <Badge variant="secondary" className="mb-3">
            Loved by learners
          </Badge>
          <h2 className="text-3xl font-bold">Real outcomes, real learners</h2>
          <div className="mt-8 grid md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <Card key={t.n} className="p-6 border-border">
                <div className="flex gap-0.5 text-warning">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-warning" />
                  ))}
                </div>
                <div className="mt-4 text-sm leading-relaxed">"{t.q}"</div>
                <div className="mt-5 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-brand text-primary-foreground grid place-items-center font-semibold">
                    {t.n[0]}
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{t.n}</div>
                    <div className="text-xs text-muted-foreground">{t.r}</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-24">
        <div className="relative overflow-visible">
          {/* Floating Student Image */}
          <div className="absolute right-0 -top-20 z-20 hidden lg:block">
            <img
              src={heroStudents.url}
              alt="Indian students"
              className="h-[435px] object-contain drop-shadow-2xl rounded-br-[30px]"
            />
          </div>

          {/* CTA Card */}
          <div className="relative rounded-3xl bg-gradient-brand p-10 sm:p-14 text-primary-foreground overflow-hidden">
            {/* Background Glow */}
            <div className="absolute -top-20 -right-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" />

            {/* Content */}
            <div className="relative z-10 max-w-2xl lg:max-w-[55%]">
              <Rocket className="h-10 w-10" />

              <h2 className="mt-4 text-3xl sm:text-4xl font-bold">Your Future Starts Here ..</h2>

              <p className="mt-3 text-primary-foreground/80 text-lg">
                Join learners and instructors building real skills with FAATPRO.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <Button asChild size="lg" variant="secondary">
                  <Link to="/courses">Explore courses</Link>
                </Button>

                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="bg-transparent border-white/40 text-primary-foreground hover:bg-white/10"
                >
                  <a href="https://faatpro.com/auth/register/student?next=/courses">Create account</a>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

import { normalizeMeetingUrl } from "@/lib/meetingUrl";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BookOpen, PlayCircle, Award, Video, Trophy, FileText, ArrowRight,
  Clock, Flame, GraduationCap, CalendarCheck, PartyPopper, RotateCcw, Eye,
} from "lucide-react";
import { X } from "lucide-react";
import { useState } from "react";
import { useWorkspace } from "@/shared/hooks/useWorkspace";
import { useAuth } from "@/shared/hooks/useAuth";
import { dashboardService } from "@/services/supabase";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow, format } from "date-fns";
import { cn } from "@/lib/utils";
import { getProfileCompletion } from "@/shared/utils/profileCompletion";
import { AlertCircle } from "lucide-react";
import RecommendedCourses from "../components/RecommendedCourses";

const fadeUp = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
} as const;

const TONES = {
  violet: { grad: "from-violet-500 to-fuchsia-500", soft: "bg-violet-100 text-violet-700", ring: "ring-violet-200" },
  blue:   { grad: "from-sky-500 to-blue-600",       soft: "bg-sky-100 text-sky-700",       ring: "ring-sky-200" },
  orange: { grad: "from-orange-400 to-rose-500",    soft: "bg-orange-100 text-orange-700", ring: "ring-orange-200" },
  teal:   { grad: "from-teal-400 to-emerald-500",   soft: "bg-teal-100 text-teal-700",     ring: "ring-teal-200" },
  amber:  { grad: "from-amber-400 to-orange-500",   soft: "bg-amber-100 text-amber-700",   ring: "ring-amber-200" },
  pink:   { grad: "from-pink-500 to-rose-500",      soft: "bg-pink-100 text-pink-700",     ring: "ring-pink-200" },
} as const;
type ToneKey = keyof typeof TONES;

function StatTile({
  label, value, hint, icon: Icon, tone,
}: { label: string; value: string | number; hint?: string; icon: any; tone: ToneKey }) {
  const t = TONES[tone];
  return (
    <motion.div {...fadeUp}>
      <Card className="p-3.5 rounded-2xl border-border/60 shadow-none hover:shadow-md hover:-translate-y-0.5 transition-all">
        <div className="flex items-center gap-3">
          <div className={cn("h-10 w-10 rounded-xl grid place-items-center text-white bg-gradient-to-br shrink-0", t.grad)}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</div>
            <div className="text-xl font-bold leading-tight truncate">{value}</div>
            {hint && <div className="text-[10px] text-muted-foreground truncate">{hint}</div>}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

export default function StudentDashboard() {
  const { membership } = useWorkspace();
  const { user } = useAuth();
  const wsId = membership!.workspace.id;

  const { data, isLoading } = useQuery({
    queryKey: ["student-dash-v2", wsId, user?.id],
    queryFn: () => dashboardService.getStudentDashboardStats(wsId, user!.id),
    enabled: !!user,
  });

  const { data: profile } = useQuery({
    queryKey: ["profile-name", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, phone, avatar_url")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: studentExtras } = useQuery({
    queryKey: ["student-profile-banner", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("student_profiles")
        .select("country, state, city, university_name")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const completion = getProfileCompletion({
    full_name: profile?.full_name,
    phone: (profile as any)?.phone,
    avatar_url: (profile as any)?.avatar_url,
    country: studentExtras?.country,
    state: studentExtras?.state,
    city: studentExtras?.city,
    university_name: studentExtras?.university_name,
  });
  const [bannerDismissed, setBannerDismissed] = useState(() => {
    try {
      const until = Number(localStorage.getItem("faatpro_profile_banner_snooze") || 0);
      return until > Date.now();
    } catch { return false; }
  });
  const showProfileBanner = completion.percent < 100 && !bannerDismissed;
  const remindLater = () => {
    try { localStorage.setItem("faatpro_profile_banner_snooze", String(Date.now() + 24 * 3600 * 1000)); } catch {}
    setBannerDismissed(true);
  };
  const dismissBanner = () => {
    try { localStorage.setItem("faatpro_profile_banner_snooze", String(Date.now() + 30 * 24 * 3600 * 1000)); } catch {}
    setBannerDismissed(true);
  };

  const enrollments = data?.enrollments ?? [];
  const last = data?.lastLesson;
  const upcomingLive = data?.upcomingLive ?? [];
  const upcomingAssignments = data?.upcomingAssignments ?? [];
  const certificates = data?.certificates ?? [];
  const recentAttempts = data?.recentAttempts ?? [];
  const progressByCourse: Record<string, number> = data?.progressByCourse ?? {};
  const certificateByCourse: Record<string, any> = data?.certificateByCourse ?? {};

  const fullName =
    (profile?.full_name && profile.full_name.trim()) ||
    (user?.user_metadata as any)?.full_name ||
    user?.email?.split("@")[0] ||
    "there";
  const overallProgress = data?.overallProgress ?? 0;
  const lastCourseCompleted = !!last?.courseCompleted;
  const lastCourseCert = last?.courseId ? certificateByCourse[last.courseId] : null;

  const bestQuiz = recentAttempts.length
    ? Math.max(...recentAttempts.map((q: any) => (q.max_score ? Math.round((q.score / q.max_score) * 100) : 0)))
    : 0;

  return (
    <div className="-m-6 md:-m-8 p-4 md:p-6 flex flex-col gap-4">
      {showProfileBanner && (
        <motion.div {...fadeUp} className="shrink-0">
          <Card className="rounded-2xl border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white grid place-items-center shrink-0">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-amber-900">Complete your profile (optional)</div>
                <p className="text-xs text-amber-800/80">
                  Complete your profile for a better learning experience. This is optional — you can keep learning anytime. ({completion.percent}% complete)
                </p>
                <div className="mt-2">
                  <Progress value={completion.percent} className="h-1.5 bg-amber-100 [&>div]:bg-gradient-to-r [&>div]:from-amber-500 [&>div]:to-orange-500" />
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button asChild size="sm" className="rounded-full bg-amber-600 hover:bg-amber-700 text-white">
                  <Link to="/app/settings?tab=personal">Complete Profile</Link>
                </Button>
                <Button size="sm" variant="ghost" className="rounded-full text-amber-900 hover:bg-amber-100" onClick={remindLater}>
                  Remind me later
                </Button>
                <button
                  aria-label="Dismiss"
                  onClick={dismissBanner}
                  className="h-8 w-8 grid place-items-center rounded-full text-amber-900 hover:bg-amber-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Top row — greeting + quick stats */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 shrink-0">
        <motion.div {...fadeUp} className="lg:col-span-1">
          <Card className="relative overflow-hidden rounded-2xl border-0 shadow-md text-white h-full">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-600 via-fuchsia-500 to-pink-500" />
            <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
            <div className="relative p-4">
              <div className="text-[11px] uppercase tracking-wider opacity-80 font-semibold">Hello</div>
              <div className="text-lg font-bold truncate">{fullName} 👋</div>
              <div className="text-[11px] opacity-90 mt-0.5">Keep up the momentum today.</div>
            </div>
          </Card>
        </motion.div>
        <StatTile label="Courses" value={enrollments.length} hint="Enrolled" icon={BookOpen} tone="blue" />
        <StatTile label="Progress" value={`${overallProgress}%`} hint={`${data?.completedLessons ?? 0}/${data?.totalLessons ?? 0} lessons`} icon={Trophy} tone="teal" />
        <StatTile label="Certificates" value={certificates.length} hint="Earned" icon={Award} tone="amber" />
      </div>

      {/* Second row — Continue learning + Assignments + Quizzes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 shrink-0">
        {/* Continue learning */}
        <motion.div {...fadeUp} className="lg:col-span-1">
          <Card className="relative overflow-hidden rounded-2xl border-0 shadow-md text-white h-full min-h-[160px]">
            <div className={cn(
              "absolute inset-0 bg-gradient-to-br",
              lastCourseCompleted ? "from-emerald-500 to-teal-600" : "from-indigo-600 to-sky-500"
            )} />
            <div className="absolute -right-10 -bottom-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
            <div className="relative p-4 flex flex-col h-full">
              <div className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider bg-white/20 backdrop-blur px-2 py-0.5 rounded-full w-fit">
                {lastCourseCompleted
                  ? (<><PartyPopper className="h-3 w-3" /> Completed</>)
                  : (<><Flame className="h-3 w-3" /> Continue</>)}
              </div>
              {last && lastCourseCompleted ? (
                <>
                  <div className="font-bold text-base mt-2 line-clamp-2 leading-snug">
                    Course Completed Successfully 🎉
                  </div>
                  <p className="text-[11px] opacity-90 mt-1 line-clamp-2">{last.title}</p>
                  <div className="mt-auto pt-3">
                    <Button asChild size="sm" variant="secondary" className="rounded-full h-7 text-xs gap-1">
                      <Link to="/app/certificates">
                        <Award className="h-3.5 w-3.5" /> View My Certificate
                      </Link>
                    </Button>
                  </div>
                </>
              ) : last ? (
                <>
                  <div className="font-bold text-base mt-2 line-clamp-2 leading-snug">{last.title}</div>
                  <div className="mt-auto pt-3 space-y-2">
                    <Progress value={overallProgress} className="h-1.5 bg-white/20 [&>div]:bg-white" />
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] opacity-90">{overallProgress}% complete</span>
                      <Button asChild size="sm" variant="secondary" className="rounded-full h-7 text-xs gap-1">
                        <Link to={last.courseId ? `/courses/${last.courseId}/lessons/${last.lessonId}/preview` : `/lessons/${last.lessonId}/preview`}>
                          <PlayCircle className="h-3.5 w-3.5" /> Resume
                        </Link>
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="font-bold text-base mt-2">Start learning</div>
                  <p className="text-[11px] opacity-90 mt-1">Enroll in a course to begin.</p>
                  <Button asChild size="sm" variant="secondary" className="rounded-full h-7 text-xs mt-auto w-fit">
                    <Link to="/courses">Browse</Link>
                  </Button>
                </>
              )}
            </div>
          </Card>
        </motion.div>

        {/* Assignments */}
        <motion.div {...fadeUp}>
          <Card className="rounded-2xl p-4 border-border/60 shadow-none h-full min-h-[160px] flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <span className="h-7 w-7 rounded-lg bg-gradient-to-br from-orange-400 to-rose-500 text-white grid place-items-center">
                  <FileText className="h-3.5 w-3.5" />
                </span>
                Assignments
              </h3>
              <Badge variant="secondary" className="rounded-full text-[10px] bg-orange-100 text-orange-700">
                {upcomingAssignments.length} due
              </Badge>
            </div>
            {upcomingAssignments.length === 0 ? (
              <div className="flex-1 grid place-items-center text-center">
                <div>
                  <CalendarCheck className="h-6 w-6 mx-auto text-muted-foreground/60" />
                  <p className="text-[11px] text-muted-foreground mt-1">No pending assignments.</p>
                </div>
              </div>
            ) : (
              <ul className="space-y-1.5 flex-1 overflow-hidden">
                {upcomingAssignments.slice(0, 2).map((a: any) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 p-2 rounded-xl bg-orange-50/60">
                    <div className="min-w-0">
                      <div className="font-medium text-xs truncate">{a.title}</div>
                      {a.due_at && (
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" /> {formatDistanceToNow(new Date(a.due_at), { addSuffix: true })}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <Button asChild size="sm" variant="ghost" className="rounded-full text-xs h-7 mt-2 self-end">
              <Link to="/app/assignments">View all <ArrowRight className="h-3 w-3 ml-1" /></Link>
            </Button>
          </Card>
        </motion.div>

        {/* Quizzes */}
        <motion.div {...fadeUp}>
          <Card className="rounded-2xl p-4 border-border/60 shadow-none h-full min-h-[160px] flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <span className="h-7 w-7 rounded-lg bg-gradient-to-br from-teal-400 to-emerald-500 text-white grid place-items-center">
                  <Trophy className="h-3.5 w-3.5" />
                </span>
                Quizzes
              </h3>
              {recentAttempts.length > 0 && (
                <Badge variant="secondary" className="rounded-full text-[10px] bg-emerald-100 text-emerald-700">
                  Best {bestQuiz}%
                </Badge>
              )}
            </div>
            {recentAttempts.length === 0 ? (
              <div className="flex-1 grid place-items-center text-center">
                <div>
                  <Trophy className="h-6 w-6 mx-auto text-muted-foreground/60" />
                  <p className="text-[11px] text-muted-foreground mt-1">No attempts yet.</p>
                </div>
              </div>
            ) : (
              <ul className="space-y-1.5 flex-1 overflow-hidden">
                {recentAttempts.slice(0, 2).map((q: any) => {
                  const pct = q.max_score ? Math.round((q.score / q.max_score) * 100) : 0;
                  return (
                    <li key={q.id} className="flex items-center justify-between gap-2 p-2 rounded-xl bg-emerald-50/60">
                      <div className="min-w-0">
                        <div className="font-medium text-xs truncate">{q.quizzes?.title ?? "Quiz"}</div>
                        <div className="text-[10px] text-muted-foreground">{q.score}/{q.max_score}</div>
                      </div>
                      <Badge className={cn(
                        "rounded-full text-[10px] border-0",
                        pct >= 70 ? "bg-emerald-500 text-white" : pct >= 40 ? "bg-amber-500 text-white" : "bg-rose-500 text-white"
                      )}>{pct}%</Badge>
                    </li>
                  );
                })}
              </ul>
            )}
            <Button asChild size="sm" variant="ghost" className="rounded-full text-xs h-7 mt-2 self-end">
              <Link to="/app/quizzes">All quizzes <ArrowRight className="h-3 w-3 ml-1" /></Link>
            </Button>
          </Card>
        </motion.div>
      </div>

      {/* Third row — Courses (span 2) + Live + Support */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 flex-1 min-h-0">
        {/* My courses */}
        <motion.div {...fadeUp} className="lg:col-span-2 min-h-0">
          <Card className="rounded-2xl p-4 border-border/60 shadow-none h-full flex flex-col">
            <div className="flex items-center justify-between mb-3 shrink-0">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <span className="h-7 w-7 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white grid place-items-center">
                  <BookOpen className="h-3.5 w-3.5" />
                </span>
                My courses
              </h3>
              <Button asChild variant="ghost" size="sm" className="rounded-full text-xs h-7">
                <Link to="/app/courses">Explore <ArrowRight className="h-3 w-3 ml-1" /></Link>
              </Button>
            </div>
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
              </div>
            ) : enrollments.length === 0 ? (
              <div className="flex-1 grid place-items-center text-center">
                <div>
                  <div className="mx-auto h-12 w-12 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white grid place-items-center mb-2">
                    <GraduationCap className="h-6 w-6" />
                  </div>
                  <p className="font-medium text-sm">No courses yet</p>
                  <Button asChild size="sm" className="mt-3 rounded-full"><Link to="/courses">Browse courses</Link></Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 overflow-y-auto pr-1 -mr-1">
                {enrollments.slice(0, 4).map((e: any, idx: number) => {
                  const progress = progressByCourse[e.course_id] ?? 0;
                  const status = progress >= 100 ? "Completed" : progress > 0 ? "In progress" : "Not started";
                  const hasCert = !!certificateByCourse[e.course_id];
                  return (
                    <motion.div
                      key={e.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: idx * 0.04 }}
                    >
                      <Link
                        to={progress >= 100 && hasCert ? "/app/certificates" : `/learn/${e.course_id}`}
                        className="group block h-full"
                      >
                        <div className="rounded-xl border border-border/60 overflow-hidden hover:shadow-md hover:-translate-y-0.5 hover:border-primary/40 transition-all bg-card flex gap-3 p-2.5">
                          <div className="h-16 w-20 shrink-0 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 relative overflow-hidden">
                            {e.courses?.thumbnail_url ? (
                              <img src={e.courses.thumbnail_url} alt={e.courses?.title}
                                className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                            ) : (
                              <div className="absolute inset-0 grid place-items-center">
                                <PlayCircle className="h-6 w-6 text-white/80" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0 flex flex-col">
                            <div className="flex items-start justify-between gap-1">
                              <h4 className="font-semibold text-xs line-clamp-1 group-hover:text-primary transition-colors">
                                {e.courses?.title ?? "Untitled course"}
                              </h4>
                            </div>
                            <Badge variant="secondary" className={cn(
                              "rounded-full text-[9px] mt-0.5 self-start border-0",
                              progress >= 100 ? "bg-emerald-100 text-emerald-700" : "bg-violet-100 text-violet-700"
                            )}>
                              {status}
                            </Badge>
                            <div className="mt-auto space-y-1">
                              <Progress value={progress} className="h-1 [&>div]:bg-gradient-to-r [&>div]:from-violet-500 [&>div]:to-fuchsia-500" />
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-[10px] text-muted-foreground font-medium">{progress}% complete</div>
                                <span className={cn(
                                  "text-[10px] font-semibold inline-flex items-center gap-0.5 shrink-0",
                                  progress >= 100 ? "text-emerald-600" : "text-primary"
                                )}>
                                  {progress >= 100
                                    ? (hasCert
                                        ? (<><Eye className="h-2.5 w-2.5" /> Review Course</>)
                                        : (<><RotateCcw className="h-2.5 w-2.5" /> Restart Course</>))
                                    : (<><PlayCircle className="h-2.5 w-2.5" /> Resume</>)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </Card>
        </motion.div>

        {/* Right column: Live classes */}
        <div className="min-h-0">
          <motion.div {...fadeUp} className="min-h-0 h-full">
            <Card className="rounded-2xl p-4 border-border/60 shadow-none h-full flex flex-col">
              <div className="flex items-center justify-between mb-2 shrink-0">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <span className="h-7 w-7 rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 text-white grid place-items-center">
                    <Video className="h-3.5 w-3.5" />
                  </span>
                  Live classes
                </h3>
                <Button asChild variant="ghost" size="sm" className="rounded-full text-xs h-7">
                  <Link to="/app/live-classes">All</Link>
                </Button>
              </div>
              {upcomingLive.length === 0 ? (
                <div className="flex-1 grid place-items-center text-center">
                  <div>
                    <Video className="h-5 w-5 mx-auto text-muted-foreground/60" />
                    <p className="text-[11px] text-muted-foreground mt-1">Nothing scheduled.</p>
                  </div>
                </div>
              ) : (
                <ul className="space-y-1.5 overflow-y-auto -mr-1 pr-1">
                  {upcomingLive.slice(0, 4).map((l: any) => (
                    <li key={l.id} className="flex items-center gap-2 p-2 rounded-xl bg-sky-50/60">
                      <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 text-white grid place-items-center shrink-0">
                        <Video className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-xs truncate">{l.title}</div>
                        <div className="text-[10px] text-muted-foreground">{format(new Date(l.starts_at), "MMM d · p")}</div>
                      </div>
                      {l.meeting_url && (
                        <a href={normalizeMeetingUrl(l.meeting_url)} target="_blank" rel="noopener noreferrer"
                          className="text-[10px] font-semibold text-sky-600 hover:underline shrink-0">Join</a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </motion.div>
        </div>
      </div>

      {/* Recommended Courses For You */}
      <motion.div {...fadeUp}>
        <RecommendedCourses />
      </motion.div>
    </div>
  );
}

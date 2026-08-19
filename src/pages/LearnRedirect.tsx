import { useEffect } from "react";
import { Navigate, useLocation, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/shared/hooks/useAuth";
import { savePostLoginRedirect } from "@/lib/authRedirect";
import { pickResumeLessonId } from "@/lib/resumeLesson";

/**
 * /learn/:courseId
 * Resolves the lesson the student should be sent to:
 *  - the first lesson (by position) that isn't completed yet
 *  - else the most recently viewed lesson (course fully complete)
 *  - else the first lesson in the course
 * If the user isn't enrolled, send them to the public course page.
 */
export default function LearnRedirect() {
  const { courseId } = useParams();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["learn-redirect", courseId, user?.id],
    enabled: !!courseId && !!user?.id,
    queryFn: async () => {
      const [enrollmentRes, courseRes, lessonsRes, progressRes] = await Promise.all([
        supabase.from("enrollments").select("id, status, access_expires_at").eq("student_id", user!.id).eq("course_id", courseId!).maybeSingle(),
        supabase.from("courses").select("id, slug").eq("id", courseId!).is("deleted_at", null).maybeSingle(),
        supabase.from("lessons").select("id, position").eq("course_id", courseId!).order("position", { ascending: true }),
        supabase.from("lesson_progress").select("lesson_id, last_viewed_at, is_completed").eq("student_id", user!.id).order("last_viewed_at", { ascending: false }),
      ]);
      const lessons = lessonsRes.data ?? [];
      const lessonId = pickResumeLessonId(lessons as any, (progressRes.data ?? []) as any);
      const enr: any = enrollmentRes.data;
      const expired = !!enr && (
        enr.status === "expired" ||
        (enr.access_expires_at && new Date(enr.access_expires_at).getTime() < Date.now())
      );
      return {
        enrolled: !!enr && !!courseRes.data && !expired,
        expired: expired && !!courseRes.data,
        slug: courseRes.data?.slug ?? null,
        lessonId,
      };
    },
  });

  useEffect(() => {
    if (authLoading || user) return;
    savePostLoginRedirect(location.pathname + location.search + location.hash);
  }, [authLoading, user, location.pathname, location.search, location.hash]);

  if (authLoading) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground text-sm">Loading your course…</div>;
  }
  if (!user) {
    const nextPath = location.pathname + location.search + location.hash;
    const next = encodeURIComponent(nextPath);
    return <Navigate to={`/auth/login?next=${next}`} replace />;
  }
  if (isLoading || !data) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground text-sm">Loading your course…</div>;
  }
  if (data.expired) {
    return <Navigate to={data.slug ? `/courses/${data.slug}?expired=1` : "/courses"} replace />;
  }
  if (!data.enrolled) {
    return <Navigate to={data.slug ? `/courses/${data.slug}` : "/courses"} replace />;
  }
  if (!data.lessonId) {
    return <Navigate to={data.slug ? `/courses/${data.slug}` : "/app/dashboard"} replace />;
  }
  return <Navigate to={`/courses/${courseId}/lessons/${data.lessonId}/preview`} replace />;
}
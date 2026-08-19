import { useQuery } from "@tanstack/react-query";
import { courseService } from "@/services/supabase";
import { useAuth } from "./useAuth";
import { useWorkspace } from "./useWorkspace";
import { useRealtimeInvalidate } from "./useRealtimeInvalidate";

/**
 * Single source of truth for the "courses you can pick from" dropdown used
 * across Lessons, Assignments, Quizzes, Live Classes, Certificates,
 * Discussions, Announcements, and Reports. For admin / instructor / staff
 * users, it returns every course in the database across every status, sorted
 * alphabetically by title. Realtime-invalidates whenever courses change so
 * newly created, edited, published, or archived courses appear automatically.
 */
export function useManageableCourses(options: { enabled?: boolean } = {}) {
  const { user } = useAuth();
  const { membership, primaryRole } = useWorkspace();
  const wsId = membership?.workspace.id ?? "";
  const enabled = options.enabled ?? true;

  useRealtimeInvalidate(
    ["courses", "course_instructors"],
    [["manageable-courses"]],
  );

  const query = useQuery({
    queryKey: ["manageable-courses", wsId, primaryRole, user?.id],
    queryFn: () => courseService.listManageableCourses(wsId, primaryRole, user?.id ?? null),
    enabled: enabled && !!wsId && !!user,
  });

  return {
    courses: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
  };
}
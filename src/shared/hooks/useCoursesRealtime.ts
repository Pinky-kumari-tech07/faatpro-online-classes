import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribe to live updates on the public course catalog so the storefront
 * reflects admin/instructor edits the moment they happen.
 *
 * Pass the React Query keys that should be invalidated when a relevant row
 * changes. By default it watches the `courses`, `course_sections`, `lessons`,
 * `quizzes` and `assignments` tables (all already in the supabase_realtime
 * publication).
 */
export function useCoursesRealtime(invalidateKeys: (string | undefined | null)[][] = [["public-courses"], ["public-featured-courses"]]) {
  const qc = useQueryClient();

  useEffect(() => {
    const invalidate = () => {
      invalidateKeys.forEach((key) => {
        const cleaned = key.filter((k) => k !== undefined && k !== null) as string[];
        if (cleaned.length === 0) return;
        qc.invalidateQueries({ queryKey: cleaned });
      });
    };

    const channel = supabase
      .channel("public-courses-stream")
      .on("postgres_changes", { event: "*", schema: "public", table: "courses" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "course_sections" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "lessons" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "quizzes" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "assignments" }, invalidate)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qc, JSON.stringify(invalidateKeys)]);
}
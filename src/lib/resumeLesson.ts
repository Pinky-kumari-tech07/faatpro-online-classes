export type ResumeLesson = { id: string; position?: number | null };
export type ResumeProgress = { lesson_id: string; is_completed?: boolean | null; last_viewed_at?: string | null };

/**
 * Decides which lesson a student should resume at.
 * `lessons` must already be ordered by position, `progress` by last_viewed_at desc.
 *
 * Rules, in order:
 *  1. the first lesson (by position) that is not completed yet
 *  2. otherwise the most recently viewed lesson (course fully complete)
 *  3. otherwise the first lesson (no progress at all)
 */
export function pickResumeLessonId(
  lessons: ResumeLesson[],
  progress: ResumeProgress[],
): string | null {
  const lessonIds = new Set(lessons.map((l) => l.id));
  const known = progress.filter((p) => lessonIds.has(p.lesson_id));
  const completed = new Set(known.filter((p) => p.is_completed).map((p) => p.lesson_id));

  const firstIncomplete = lessons.find((l) => !completed.has(l.id));
  const mostRecent = known[0]?.lesson_id ?? null;

  return firstIncomplete?.id ?? mostRecent ?? lessons[0]?.id ?? null;
}
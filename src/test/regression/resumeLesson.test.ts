import { describe, it, expect } from "vitest";
import { pickResumeLessonId } from "@/lib/resumeLesson";

const lessons = [
  { id: "l1", position: 1 },
  { id: "l2", position: 2 },
  { id: "l3", position: 3 },
];

describe("Continue Learning – resume lesson selection", () => {
  it("A. no progress at all -> first lesson", () => {
    expect(pickResumeLessonId(lessons, [])).toBe("l1");
  });

  it("B. lesson 1 complete, lesson 2 incomplete -> lesson 2", () => {
    expect(
      pickResumeLessonId(lessons, [
        { lesson_id: "l1", is_completed: true, last_viewed_at: "2026-01-01" },
      ]),
    ).toBe("l2");
  });

  it("C. several lessons complete -> first remaining incomplete", () => {
    expect(
      pickResumeLessonId(lessons, [
        { lesson_id: "l2", is_completed: true, last_viewed_at: "2026-01-02" },
        { lesson_id: "l1", is_completed: true, last_viewed_at: "2026-01-01" },
      ]),
    ).toBe("l3");
  });

  it("does not prefer the most recently viewed lesson over an earlier incomplete one", () => {
    // l3 was viewed most recently but never completed, l1 is still incomplete
    expect(
      pickResumeLessonId(lessons, [
        { lesson_id: "l3", is_completed: false, last_viewed_at: "2026-02-01" },
        { lesson_id: "l2", is_completed: true, last_viewed_at: "2026-01-05" },
      ]),
    ).toBe("l1");
  });

  it("D. fully complete course -> most recently viewed lesson", () => {
    expect(
      pickResumeLessonId(lessons, [
        { lesson_id: "l2", is_completed: true, last_viewed_at: "2026-03-01" },
        { lesson_id: "l3", is_completed: true, last_viewed_at: "2026-02-01" },
        { lesson_id: "l1", is_completed: true, last_viewed_at: "2026-01-01" },
      ]),
    ).toBe("l2");
  });

  it("E. ignores progress rows belonging to other courses", () => {
    expect(
      pickResumeLessonId(lessons, [
        { lesson_id: "other-course-lesson", is_completed: true, last_viewed_at: "2026-05-01" },
        { lesson_id: "l1", is_completed: true, last_viewed_at: "2026-01-01" },
      ]),
    ).toBe("l2");
  });

  it("course with no lessons -> null", () => {
    expect(pickResumeLessonId([], [])).toBeNull();
  });
});
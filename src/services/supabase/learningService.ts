import { supabase } from "@/integrations/supabase/client";

export const learningService = {
  async getLessonWithCourse(lessonId: string) {
    const { data, error } = await supabase
      .from("lessons")
      .select("*, courses:course_id(id, title, slug, workspace_id, instructor_id, description, summary, thumbnail_url), course_sections:section_id(id, title, position)")
      .eq("id", lessonId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async getCurriculum(courseId: string) {
    const [sectionsRes, lessonsRes] = await Promise.all([
      supabase.from("course_sections").select("*").eq("course_id", courseId).order("position"),
      supabase.from("lessons").select("id, title, lesson_type, duration_seconds, position, is_preview, section_id").eq("course_id", courseId).order("position"),
    ]);
    if (sectionsRes.error) throw sectionsRes.error;
    if (lessonsRes.error) throw lessonsRes.error;
    return { sections: sectionsRes.data ?? [], lessons: lessonsRes.data ?? [] };
  },

  async getEnrollment(studentId: string, courseId: string) {
    const { data } = await supabase
      .from("enrollments")
      .select("*")
      .eq("student_id", studentId)
      .eq("course_id", courseId)
      .maybeSingle();
    if (!data) return null;
    // Enforce existing course-validity rules: only active (non-expired) or
    // completed enrollments grant access. Expired or time-lapsed enrollments
    // are surfaced as `null` so the caller redirects back to the detail page.
    const status = (data as any).status;
    const expiresAt = (data as any).access_expires_at as string | null;
    if (status === "expired") return null;
    if (expiresAt && new Date(expiresAt).getTime() < Date.now()) return null;
    if (status !== "active" && status !== "completed") return null;
    return data;
  },

  async getProgress(studentId: string, lessonId: string) {
    const { data } = await supabase
      .from("lesson_progress")
      .select("*")
      .eq("student_id", studentId)
      .eq("lesson_id", lessonId)
      .maybeSingle();
    return data;
  },

  async listCourseProgress(studentId: string, courseIds: string[]) {
    if (!courseIds.length) return [];
    const { data } = await supabase
      .from("lesson_progress")
      .select("lesson_id, is_completed, progress_seconds")
      .eq("student_id", studentId)
      .in("lesson_id", courseIds);
    return data ?? [];
  },

  async listLessonProgressForStudent(studentId: string, lessonIds: string[]) {
    if (!lessonIds.length) return [];
    const { data } = await supabase
      .from("lesson_progress")
      .select("lesson_id, is_completed, progress_seconds")
      .eq("student_id", studentId)
      .in("lesson_id", lessonIds);
    return data ?? [];
  },

  async saveProgress(payload: {
    workspace_id: string;
    lesson_id: string;
    student_id: string;
    enrollment_id: string | null;
    progress_seconds: number;
    is_completed?: boolean;
  }) {
    const existing = await learningService.getProgress(payload.student_id, payload.lesson_id);
    if (existing) {
      const { data, error } = await supabase
        .from("lesson_progress")
        .update({
          progress_seconds: payload.progress_seconds,
          is_completed: payload.is_completed ?? existing.is_completed,
          last_viewed_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select()
        .maybeSingle();
      if (error) throw error;
      return data;
    }
    const { data, error } = await supabase
      .from("lesson_progress")
      .insert({
        workspace_id: payload.workspace_id,
        lesson_id: payload.lesson_id,
        student_id: payload.student_id,
        enrollment_id: payload.enrollment_id ?? null,
        progress_seconds: payload.progress_seconds,
        is_completed: payload.is_completed ?? false,
        last_viewed_at: new Date().toISOString(),
      } as any)
      .select()
      .maybeSingle();
    if (error) throw error;
    return data;
  },
};

export const studentNotesService = {
  async list(studentId: string, lessonId: string) {
    const { data } = await supabase
      .from("student_notes")
      .select("*")
      .eq("student_id", studentId)
      .eq("lesson_id", lessonId)
      .order("timestamp_seconds", { ascending: true });
    return data ?? [];
  },
  async create(payload: {
    workspace_id: string;
    student_id: string;
    course_id: string;
    lesson_id: string;
    timestamp_seconds: number;
    body: string;
  }) {
    const { data, error } = await supabase.from("student_notes").insert(payload).select().maybeSingle();
    if (error) throw error;
    return data;
  },
  async remove(id: string) {
    const { error } = await supabase.from("student_notes").delete().eq("id", id);
    if (error) throw error;
  },
};

export const lessonAssetService = {
  async list(lessonId: string) {
    const { data } = await supabase
      .from("lesson_assets")
      .select("*")
      .eq("lesson_id", lessonId)
      .order("created_at", { ascending: true });
    return data ?? [];
  },
};

export const discussionService = {
  async listForLesson(lessonId: string) {
    const { data } = await supabase
      .from("discussions")
      .select("*")
      .eq("lesson_id", lessonId)
      .order("created_at", { ascending: false });
    return data ?? [];
  },
  async listReplies(discussionId: string) {
    const { data } = await supabase
      .from("discussion_replies")
      .select("*")
      .eq("discussion_id", discussionId)
      .order("created_at", { ascending: true });
    return data ?? [];
  },
  async createThread(payload: {
    workspace_id: string;
    course_id: string;
    lesson_id: string;
    author_id: string;
    title: string;
    body: string;
  }) {
    const { data, error } = await supabase.from("discussions").insert(payload).select().maybeSingle();
    if (error) throw error;
    return data;
  },
  async createReply(payload: {
    workspace_id: string;
    discussion_id: string;
    author_id: string;
    body: string;
    is_instructor_answer?: boolean;
  }) {
    const { data, error } = await supabase.from("discussion_replies").insert(payload).select().maybeSingle();
    if (error) throw error;
    return data;
  },
};
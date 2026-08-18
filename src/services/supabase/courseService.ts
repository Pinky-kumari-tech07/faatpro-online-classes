import { supabase } from "@/integrations/supabase/client";
import type { Course, PageParams, Paginated } from "@/types";

export const courseService = {
  /**
   * Returns the list of course IDs an instructor has been explicitly assigned
   * to (via the course_instructors table) in addition to the ones they own
   * via courses.instructor_id.
   */
  async listAssignedCourseIds(userId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from("course_instructors")
      .select("course_id")
      .eq("instructor_id", userId);
    if (error) {
      console.warn("[courseService] listAssignedCourseIds error:", error);
      return [];
    }
    return Array.from(new Set((data ?? []).map((r: any) => r.course_id).filter(Boolean)));
  },

  /**
   * Courses an instructor can manage = courses they created (instructor_id)
   * UNION courses they were assigned to (course_instructors).
   */
  async listInstructorCourses(
    userId: string,
    select = "id, title, workspace_id",
  ): Promise<any[]> {
    const assignedIds = await courseService.listAssignedCourseIds(userId);
    let q = supabase.from("courses").select(select).is("deleted_at", null);
    if (assignedIds.length > 0) {
      q = q.or(`instructor_id.eq.${userId},id.in.(${assignedIds.join(",")})`);
    } else {
      q = q.eq("instructor_id", userId);
    }
    const { data, error } = await q;
    if (error) {
      console.warn("[courseService] listInstructorCourses error:", error);
      return [];
    }
    return data ?? [];
  },

  async listCourses(
    workspaceId: string,
    filters: PageParams = {},
    options: { role?: string | null; userId?: string | null; instructorOwnedIds?: string[] } = {},
  ): Promise<Paginated<Course>> {
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 12;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const sort = filters.sort ?? { column: "updated_at", ascending: false };

    let q = supabase
      .from("courses")
      .select("*", { count: "exact" })
      .is("deleted_at", null)
      .order(sort.column, { ascending: sort.ascending })
      .range(from, to);

    // Instructors must only see courses they own or co-instruct. Admin/staff
    // see every course via RLS. Students use StudentCoursesPage.
    const role = options.role ?? null;
    const userId = options.userId ?? null;
    if (role === "instructor" && userId) {
      const owned = options.instructorOwnedIds ?? [];
      if (owned.length > 0) {
        q = q.or(`instructor_id.eq.${userId},id.in.(${owned.join(",")})`);
      } else {
        q = q.eq("instructor_id", userId);
      }
    }

    if (filters.status && filters.status !== "all") {
      q = q.eq("status", filters.status);
    }
    if (filters.search) {
      const s = filters.search.replace(/[,()]/g, " ").trim();
      if (s) {
        q = q.or(
          `title.ilike.%${s}%,slug.ilike.%${s}%,category.ilike.%${s}%,subcategory.ilike.%${s}%`,
        );
      }
    }

    const { data, count, error } = await q;
    if (error) throw error;
    return {
      rows: (data ?? []) as Course[],
      total: count ?? 0,
      page,
      pageSize,
    };
  },

  /**
   * Unified course picker for Lessons, Assignments, Quizzes, Live Classes,
   * Certificates, Discussions, Announcements, and Reports.
   *
   * Admin / instructor / staff users must see every course in the database,
   * across every status. No instructor-owned / assigned / workspace / status
   * filters are applied here; RLS grants the complete read path for LMS staff.
   */
  async listManageableCourses(
    workspaceId: string,
    role: string | null,
    userId: string | null,
  ): Promise<any[]> {
    const select = "id, title, slug, status, visibility, instructor_id, workspace_id, passing_percentage";
    const isStaff = role === "organization_admin" || role === "staff" || role === "super_admin";

    // Instructors: only courses they own or are assigned to as co-instructor.
    if (!isStaff && role === "instructor" && userId) {
      const assignedIds = await courseService.listAssignedCourseIds(userId);
      let q = supabase
        .from("courses")
        .select(select)
        .is("deleted_at", null)
        .order("title", { ascending: true });
      if (assignedIds.length > 0) {
        q = q.or(`instructor_id.eq.${userId},id.in.(${assignedIds.join(",")})`);
      } else {
        q = q.eq("instructor_id", userId);
      }
      const { data, error } = await q;
      if (error) {
        console.error("[courseService] listManageableCourses(instructor) error:", error);
        throw error;
      }
      console.log(`[courseService] instructor=${userId} courses=${data?.length ?? 0}`);
      return data ?? [];
    }

    const rows: any[] = [];
    const pageSize = 1000;
    let total: number | null = null;

    for (let from = 0; ; from += pageSize) {
      const { data, count, error } = await supabase
        .from("courses")
        .select(select, { count: "exact" })
        .is("deleted_at", null)
        .order("title", { ascending: true })
        .range(from, from + pageSize - 1);

      if (error) {
        console.error("[courseService] listManageableCourses error:", error.message, error);
        throw error;
      }

      if (total == null) total = count ?? null;
      rows.push(...(data ?? []));
      if (!data || data.length < pageSize || (total != null && rows.length >= total)) break;
    }

    console.log(
      `[courseService] listManageableCourses role=${role ?? "unknown"} ws=${workspaceId} user=${userId ?? "none"} -> ${rows.length}${total != null ? `/${total}` : ""} courses`,
    );
    return rows;
  },
};
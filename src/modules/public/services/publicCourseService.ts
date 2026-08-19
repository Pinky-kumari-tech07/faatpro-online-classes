import { supabase } from "@/integrations/supabase/client";

export interface PublicCourseFilters {
  search?: string;
  category?: string;
  subcategory?: string;
  child_category?: string;
  languages?: string[];
  boards?: string[];
  sort?: "newest" | "price_asc" | "price_desc";
}

export const publicCourseService = {
  async listPublishedCourses(filters: PublicCourseFilters = {}) {
    let q = supabase
      .from("courses")
      .select("id, title, slug, summary, thumbnail_url, category, subcategory, child_category, languages, boards, tags, price_amount, currency, pricing_type, sale_price, discount_type, discount_value, discount_starts_at, discount_ends_at, allow_coupons, gst_rate, tax_inclusive, visibility, status, instructor_id, badges, is_featured, created_at, profiles:profiles!courses_instructor_id_fkey(full_name, avatar_url)")
      .is("deleted_at", null)
      .eq("status", "published")
      .eq("visibility", "public");
    if (filters.search) q = q.ilike("title", `%${filters.search}%`);
    if (filters.category && filters.category !== "all") q = q.eq("category", filters.category);
    if (filters.subcategory && filters.subcategory !== "all") q = q.eq("subcategory", filters.subcategory);
    if (filters.child_category && filters.child_category !== "all") q = q.eq("child_category", filters.child_category);
    if (filters.languages && filters.languages.length) q = q.overlaps("languages", filters.languages);
    if (filters.boards && filters.boards.length) q = q.overlaps("boards", filters.boards);
    if (filters.sort === "price_asc") q = q.order("price_amount", { ascending: true });
    else if (filters.sort === "price_desc") q = q.order("price_amount", { ascending: false });
    else q = q.order("created_at", { ascending: false });
    const { data, error } = await q.limit(60);
    if (error) throw error;
    return data ?? [];
  },

  async listFeaturedCourses(limit = 6) {
    const { data } = await supabase
      .from("courses")
      .select("id, title, slug, summary, thumbnail_url, category, subcategory, child_category, languages, boards, tags, price_amount, currency, pricing_type, sale_price, discount_type, discount_value, discount_starts_at, discount_ends_at, allow_coupons, gst_rate, tax_inclusive, instructor_id, badges, is_featured, is_best_seller, is_trending, is_new, is_editors_choice, created_at, profiles:profiles!courses_instructor_id_fkey(full_name, avatar_url)")
      .is("deleted_at", null)
      .eq("status", "published")
      .eq("visibility", "public")
      .order("created_at", { ascending: false })
      .limit(limit);
    return data ?? [];
  },

  async getCourseBySlug(slug: string) {
    const { data: course, error } = await supabase
      .from("courses")
      .select("*, profiles:profiles!courses_instructor_id_fkey(full_name, avatar_url)")
      .is("deleted_at", null)
      .eq("slug", slug)
      .eq("status", "published")
      .eq("visibility", "public")
      .maybeSingle();
    if (error) throw error;
    if (!course) return null;

    // RLS hides sections/lessons/quizzes/assignments/enrollments from anonymous
    // and non-enrolled users. Use a security-definer RPC that returns safe
    // curriculum metadata for any published+public course.
    const { data: curriculum, error: rpcErr } = await supabase.rpc(
      "get_public_course_curriculum",
      { _course_id: course.id },
    );
    if (rpcErr) throw rpcErr;
    const c: any = curriculum ?? {};
    return {
      course,
      sections: c.sections ?? [],
      lessons: c.lessons ?? [],
      stats: c.stats ?? { modules: 0, lessons: 0, quizzes: 0, assignments: 0, students: 0, durationMinutes: 0 },
    };
  },

  async listInstructors() {
    const { data, error } = await supabase.rpc("get_public_instructors");
    if (error) throw error;
    return ((data as any[]) ?? []) as Array<{
      id: string;
      name: string;
      avatar: string | null;
      count: number;
      students: number;
      categories: string[];
      verified: boolean;
    }>;
  },

  async listPublishedBundles(filters: { search?: string; sort?: "newest" | "price_asc" | "price_desc" } = {}) {
    let q = supabase
      .from("course_bundles")
      .select("id, name, slug, short_description, description, thumbnail_url, banner_url, category, tags, regular_price, sale_price, currency, certificate_mode, is_featured, created_at, bundle_courses(count)")
      .eq("status", "published");
    if (filters.search) q = q.ilike("name", `%${filters.search}%`);
    if (filters.sort === "price_asc") q = q.order("regular_price", { ascending: true });
    else if (filters.sort === "price_desc") q = q.order("regular_price", { ascending: false });
    else q = q.order("created_at", { ascending: false });
    const { data, error } = await q.limit(60);
    if (error) throw error;
    return data ?? [];
  },

  async getBundleBySlug(slug: string) {
    const { data: bundle, error } = await supabase
      .from("course_bundles")
      .select("*")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();
    if (error) throw error;
    if (!bundle) return null;
    const { data: bcs } = await supabase
      .from("bundle_courses")
      .select("course_id, position, is_mandatory, courses:course_id(id, title, slug, summary, thumbnail_url, price_amount, currency, category, instructor_id, profiles:profiles!courses_instructor_id_fkey(full_name, avatar_url))")
      .eq("bundle_id", bundle.id)
      .order("position", { ascending: true });
    const courseIds = (bcs ?? []).map((b: any) => b.course_id);
    let stats = { lessons: 0, quizzes: 0, assignments: 0, durationMinutes: 0 };
    if (courseIds.length) {
      const results = await Promise.all(
        courseIds.map((id) => supabase.rpc("get_public_course_curriculum", { _course_id: id }))
      );
      for (const r of results) {
        const s = (r.data as any)?.stats;
        if (s) {
          stats.lessons += s.lessons || 0;
          stats.quizzes += s.quizzes || 0;
          stats.assignments += s.assignments || 0;
          stats.durationMinutes += s.durationMinutes || 0;
        }
      }
    }
    return { bundle, courses: bcs ?? [], stats };
  },

  async listBundlesContainingCourse(courseId: string) {
    const { data, error } = await supabase
      .from("bundle_courses")
      .select("bundle:bundle_id(id, name, slug, regular_price, sale_price, currency, thumbnail_url, status)")
      .eq("course_id", courseId);
    if (error) return [];
    return (data ?? [])
      .map((r: any) => r.bundle)
      .filter((b: any) => b && b.status === "published");
  },
};

export const certificateVerificationService = {
  async verifyCertificate(code: string) {
    const { data, error } = await supabase.rpc("verify_certificate", { _code: code });
    if (error) throw error;
    return (data?.[0] ?? null) as null | {
      certificate_number: string;
      issued_at: string;
      student_name: string;
      course_title: string;
      workspace_name: string;
      completion_percentage: number | null;
      completion_date: string | null;
      verification_code: string;
      accent_color: string;
      revoked_at: string | null;
      template_id: string | null;
      template_snapshot: any | null;
      pdf_url: string | null;
    };
  },
};

export const contactService = {
  async submitContactMessage(payload: { name: string; email: string; phone?: string; subject?: string; message: string }) {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : null;
    const { error } = await supabase.rpc("submit_website_inquiry", {
      p_name: payload.name,
      p_email: payload.email,
      p_phone: payload.phone ?? "",
      p_subject: payload.subject ?? "Website Inquiry",
      p_message: payload.message,
      p_user_agent: ua,
      p_ip: null,
    } as any);
    if (error) throw error;
  },
};
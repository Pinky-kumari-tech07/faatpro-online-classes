import { supabase } from "@/integrations/supabase/client";

export interface PublicInstructor {
  id: string;
  full_name: string;
  avatar_url: string | null;
  bio: string | null;
  designation: string | null;
  expertise: string | null;
  years_experience: number | null;
  linkedin_url: string | null;
  social_links: any;
  verification_status: "pending" | "approved" | "rejected" | null;
  total_courses: number;
  total_students: number;
  average_rating: number | null;
  total_reviews: number | null;
}

export const instructorPublicService = {
  async getInstructorById(id: string): Promise<PublicInstructor | null> {
    const [{ data: profile }, { data: ip }, { data: courses }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, avatar_url, bio, designation, expertise, years_experience, linkedin_url, social_links")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("instructor_profiles")
        .select("verification_status")
        .eq("user_id", id)
        .maybeSingle(),
      supabase
        .from("courses")
        .select("id")
        .eq("instructor_id", id)
        .eq("status", "published")
        .eq("visibility", "public")
        .is("deleted_at", null),
    ]);
    if (!profile) return null;

    const courseIds = (courses ?? []).map((c: any) => c.id);
    let total_students = 0;
    if (courseIds.length) {
      const { count } = await supabase
        .from("enrollments")
        .select("student_id", { count: "exact", head: true })
        .in("course_id", courseIds);
      total_students = count ?? 0;
    }

    return {
      id: profile.id,
      full_name: profile.full_name ?? "Instructor",
      avatar_url: profile.avatar_url,
      bio: (profile as any).bio ?? null,
      designation: (profile as any).designation ?? null,
      expertise: (profile as any).expertise ?? null,
      years_experience: (profile as any).years_experience ?? null,
      linkedin_url: (profile as any).linkedin_url ?? null,
      social_links: (profile as any).social_links ?? null,
      verification_status: (ip?.verification_status as any) ?? null,
      total_courses: courseIds.length,
      total_students,
      average_rating: null,
      total_reviews: null,
    };
  },

  async listInstructorCourses(id: string) {
    const { data } = await supabase
      .from("courses")
      .select(
        "id, title, slug, summary, thumbnail_url, category, subcategory, price_amount, currency, pricing_type, sale_price, discount_type, discount_value, discount_starts_at, discount_ends_at, profiles:profiles!courses_instructor_id_fkey(full_name, avatar_url)",
      )
      .eq("instructor_id", id)
      .eq("status", "published")
      .eq("visibility", "public")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    return data ?? [];
  },
};

export function parseExpertise(expertise: string | null | undefined): string[] {
  if (!expertise) return [];
  return expertise
    .split(/[,|/]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 6);
}
import { supabase } from "@/integrations/supabase/client";

export interface CourseCategory {
  id: string;
  workspace_id: string;
  name: string;
  slug: string;
  icon: string | null;
  description: string | null;
  status: "active" | "inactive";
  is_trending: boolean;
  sort_order: number;
  course_count: number | null;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
}

export type CategoryFilters = {
  search?: string;
  status?: "all" | "active" | "inactive";
  trending?: "all" | "trending" | "not_trending";
};

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function applyActiveCourseCounts(categories: CourseCategory[], workspaceId?: string, publicOnly = false) {
  if (!categories.length) return categories;
  let q = supabase.from("courses").select("category").is("deleted_at", null).not("category", "is", null);
  if (workspaceId) q = q.eq("workspace_id", workspaceId);
  if (publicOnly) q = q.eq("status", "published").eq("visibility", "public");
  const { data } = await q;
  const counts = new Map<string, number>();
  (data ?? []).forEach((row: any) => {
    if (!row.category) return;
    counts.set(row.category, (counts.get(row.category) ?? 0) + 1);
  });
  return categories.map((category) => ({
    ...category,
    course_count: counts.get(category.name) ?? 0,
  }));
}

export const categoryService = {
  async listCategories(workspaceId: string, filters: CategoryFilters = {}) {
    let q = supabase
      .from("course_categories" as any)
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (filters.status && filters.status !== "all") q = q.eq("status", filters.status);
    if (filters.trending === "trending") q = q.eq("is_trending", true);
    if (filters.trending === "not_trending") q = q.eq("is_trending", false);
    if (filters.search) q = q.ilike("name", `%${filters.search}%`);
    const { data, error } = await q;
    if (error) throw error;
    return applyActiveCourseCounts((data ?? []) as unknown as CourseCategory[], workspaceId);
  },

  async listTrendingCategories() {
    const { data, error } = await supabase
      .from("course_categories" as any)
      .select("id, name, slug, icon, course_count, sort_order, is_trending, status")
      .eq("status", "active")
      .eq("is_trending", true)
      .order("sort_order", { ascending: true })
      .limit(50);
    if (error) throw error;
    return applyActiveCourseCounts((data ?? []) as unknown as CourseCategory[], undefined, true);
  },

  async createCategory(workspaceId: string, payload: Partial<CourseCategory>) {
    const row = {
      workspace_id: workspaceId,
      name: payload.name!,
      slug: payload.slug?.trim() ? slugify(payload.slug) : slugify(payload.name!),
      icon: payload.icon ?? null,
      description: payload.description ?? null,
      status: payload.status ?? "active",
      is_trending: payload.is_trending ?? false,
      sort_order: payload.sort_order ?? 0,
      course_count: payload.course_count ?? null,
      parent_id: payload.parent_id ?? null,
    };
    const { data, error } = await supabase.from("course_categories" as any).insert(row).select().single();
    if (error) throw friendlyError(error);
    return data as unknown as CourseCategory;
  },

  async updateCategory(id: string, payload: Partial<CourseCategory>) {
    const patch: any = { ...payload };
    if (payload.slug) patch.slug = slugify(payload.slug);
    delete patch.id;
    delete patch.workspace_id;
    delete patch.created_at;
    delete patch.updated_at;
    const { data, error } = await supabase.from("course_categories" as any).update(patch).eq("id", id).select().single();
    if (error) throw friendlyError(error);
    return data as unknown as CourseCategory;
  },

  async deleteCategory(id: string) {
    const { error } = await supabase.from("course_categories" as any).delete().eq("id", id);
    if (error) throw error;
  },

  async reorderCategories(items: { id: string; sort_order: number }[]) {
    await Promise.all(
      items.map((it) =>
        supabase.from("course_categories" as any).update({ sort_order: it.sort_order }).eq("id", it.id),
      ),
    );
  },
};

function friendlyError(error: any): Error {
  if (error?.code === "23505") {
    if (String(error.message ?? "").includes("slug")) {
      return new Error("A category with this slug already exists in this workspace.");
    }
    if (String(error.message ?? "").toLowerCase().includes("name")) {
      return new Error("A category with this name already exists in this workspace.");
    }
    return new Error("A duplicate category already exists in this workspace.");
  }
  return error instanceof Error ? error : new Error(error?.message ?? "Unknown error");
}
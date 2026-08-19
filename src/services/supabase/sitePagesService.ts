import { supabase } from "@/integrations/supabase/client";

export type SitePage = {
  id: string;
  slug: string;
  title: string;
  content: string;
  meta_title: string | null;
  meta_description: string | null;
  og_image_url: string | null;
  status: "draft" | "published";
  created_by: string | null;
  updated_by: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SitePageVersion = {
  id: string;
  page_id: string;
  version_number: number;
  title: string;
  content: string;
  meta_title: string | null;
  meta_description: string | null;
  og_image_url: string | null;
  status: string;
  edited_by: string | null;
  created_at: string;
};

export const sitePagesService = {
  async listAll(): Promise<SitePage[]> {
    const { data, error } = await supabase
      .from("site_pages")
      .select("*")
      .order("title");
    if (error) throw error;
    return (data as SitePage[]) ?? [];
  },
  async listPublishedFooter(): Promise<Pick<SitePage, "slug" | "title">[]> {
    const { data, error } = await supabase
      .from("site_pages")
      .select("slug,title")
      .eq("status", "published")
      .in("slug", [
        "privacy-policy",
        "terms-and-conditions",
        "return-refund-policy",
        "code-of-conduct",
      ]);
    if (error) throw error;
    return data ?? [];
  },
  async getBySlug(slug: string): Promise<SitePage | null> {
    const { data, error } = await supabase
      .from("site_pages")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw error;
    return (data as SitePage) ?? null;
  },
  async update(
    id: string,
    patch: Partial<Pick<SitePage, "title" | "content" | "meta_title" | "meta_description" | "og_image_url" | "status">>,
    userId: string | null,
  ): Promise<SitePage> {
    const updates = { ...patch, updated_by: userId } as typeof patch & {
      updated_by: string | null;
      published_at?: string;
    };
    if (patch.status === "published") updates.published_at = new Date().toISOString();
    const { data, error } = await supabase
      .from("site_pages")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return data as SitePage;
  },
  async listVersions(pageId: string): Promise<SitePageVersion[]> {
    const { data, error } = await supabase
      .from("site_page_versions")
      .select("*")
      .eq("page_id", pageId)
      .order("version_number", { ascending: false });
    if (error) throw error;
    return (data as SitePageVersion[]) ?? [];
  },
  async restoreVersion(version: SitePageVersion, userId: string | null): Promise<SitePage> {
    return this.update(
      version.page_id,
      {
        title: version.title,
        content: version.content,
        meta_title: version.meta_title,
        meta_description: version.meta_description,
        og_image_url: version.og_image_url,
      },
      userId,
    );
  },
};
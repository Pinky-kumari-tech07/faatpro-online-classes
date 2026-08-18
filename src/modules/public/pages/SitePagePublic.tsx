import { Link, useParams, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { ChevronRight, Loader2 } from "lucide-react";
import { sitePagesService } from "@/services/supabase/sitePagesService";

const TITLES: Record<string, string> = {
  "privacy-policy": "Privacy Policy",
  "terms-and-conditions": "Terms & Conditions",
  "return-refund-policy": "Return & Refund Policy",
  "code-of-conduct": "Code of Conduct",
};

export default function SitePagePublic({ slug: slugProp }: { slug?: string }) {
  const params = useParams();
  const slug = slugProp ?? params.slug ?? "";

  const { data, isLoading, isError } = useQuery({
    queryKey: ["site-page", slug],
    queryFn: () => sitePagesService.getBySlug(slug),
    enabled: !!slug,
  });

  if (!slug) return <Navigate to="/" replace />;

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !data || data.status !== "published") {
    return (
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-20 text-center">
        <h1 className="text-2xl font-semibold">{TITLES[slug] ?? "Page"}</h1>
        <p className="text-muted-foreground mt-2">This page is not available right now.</p>
        <Link to="/" className="text-primary mt-4 inline-block">Back to home</Link>
      </section>
    );
  }

  const updated = new Date(data.updated_at).toLocaleDateString(undefined, {
    year: "numeric", month: "long", day: "numeric",
  });

  return (
    <>
      <Helmet>
        <title>{data.meta_title || `${data.title} | FAATPRO`}</title>
        {data.meta_description && (
          <meta name="description" content={data.meta_description} />
        )}
        <link rel="canonical" href={`/${data.slug}`} />
        <meta property="og:title" content={data.meta_title || data.title} />
        {data.meta_description && (
          <meta property="og:description" content={data.meta_description} />
        )}
        <meta property="og:url" content={`/${data.slug}`} />
        <meta property="og:type" content="article" />
        {data.og_image_url && <meta property="og:image" content={data.og_image_url} />}
      </Helmet>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-10 md:py-16">
        <nav className="flex items-center gap-1 text-xs text-muted-foreground mb-6" aria-label="Breadcrumb">
          <Link to="/" className="hover:text-foreground">Home</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground">{data.title}</span>
        </nav>

        <header className="border-b border-border pb-6">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{data.title}</h1>
          <p className="text-sm text-muted-foreground mt-2">Last updated: {updated}</p>
        </header>

        <article
          className="prose prose-neutral dark:prose-invert max-w-none mt-8
            prose-headings:font-semibold prose-h2:mt-8 prose-h2:text-2xl
            prose-h3:mt-6 prose-h3:text-xl
            prose-p:leading-relaxed prose-li:leading-relaxed
            prose-a:text-primary prose-a:no-underline hover:prose-a:underline
            prose-table:border prose-th:border prose-td:border prose-th:p-2 prose-td:p-2
            prose-img:rounded-lg"
          dangerouslySetInnerHTML={{ __html: data.content }}
        />
      </section>
    </>
  );
}
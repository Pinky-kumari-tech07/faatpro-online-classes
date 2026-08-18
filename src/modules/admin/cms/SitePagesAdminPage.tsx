import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, History, Save, Send, Eye, RotateCcw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { sitePagesService, SitePage, SitePageVersion } from "@/services/supabase/sitePagesService";
import { useAuth } from "@/shared/hooks/useAuth";
import RichTextEditor from "./RichTextEditor";
import { cn } from "@/lib/utils";

const ORDER = [
  "privacy-policy",
  "terms-and-conditions",
  "return-refund-policy",
  "code-of-conduct",
];

export default function SitePagesAdminPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [activeSlug, setActiveSlug] = useState<string>(ORDER[0]);
  const [draft, setDraft] = useState<Partial<SitePage>>({});
  const [previewOpen, setPreviewOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const { data: pages = [], isLoading } = useQuery({
    queryKey: ["site-pages-admin"],
    queryFn: () => sitePagesService.listAll(),
  });

  const sortedPages = useMemo(() => {
    return [...pages].sort(
      (a, b) => (ORDER.indexOf(a.slug) + 100) - (ORDER.indexOf(b.slug) + 100),
    );
  }, [pages]);

  const active = useMemo(
    () => sortedPages.find((p) => p.slug === activeSlug) ?? sortedPages[0],
    [sortedPages, activeSlug],
  );

  useEffect(() => {
    if (active) setDraft(active);
  }, [active?.id]);

  const { data: versions = [] } = useQuery({
    queryKey: ["site-page-versions", active?.id],
    queryFn: () => sitePagesService.listVersions(active!.id),
    enabled: !!active && historyOpen,
  });

  const save = useMutation({
    mutationFn: async (status?: "draft" | "published") => {
      if (!active) throw new Error("no page");
      return sitePagesService.update(
        active.id,
        {
          title: draft.title ?? active.title,
          content: draft.content ?? active.content,
          meta_title: draft.meta_title ?? active.meta_title,
          meta_description: draft.meta_description ?? active.meta_description,
          og_image_url: draft.og_image_url ?? active.og_image_url,
          status: status ?? active.status,
        },
        user?.id ?? null,
      );
    },
    onSuccess: (_, status) => {
      toast.success(status === "published" ? "Page published" : "Saved");
      qc.invalidateQueries({ queryKey: ["site-pages-admin"] });
      qc.invalidateQueries({ queryKey: ["site-pages-footer"] });
      qc.invalidateQueries({ queryKey: ["site-page", activeSlug] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to save"),
  });

  const restore = useMutation({
    mutationFn: (v: SitePageVersion) =>
      sitePagesService.restoreVersion(v, user?.id ?? null),
    onSuccess: () => {
      toast.success("Version restored as draft");
      qc.invalidateQueries({ queryKey: ["site-pages-admin"] });
      qc.invalidateQueries({ queryKey: ["site-page-versions", active?.id] });
      setHistoryOpen(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to restore"),
  });

  if (isLoading || !active) {
    return (
      <div className="p-8 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  const dirty =
    draft.title !== active.title ||
    draft.content !== active.content ||
    draft.meta_title !== active.meta_title ||
    draft.meta_description !== active.meta_description ||
    draft.og_image_url !== active.og_image_url;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" /> Content Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage public-facing legal & policy pages. Changes are version-controlled.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setPreviewOpen(true)}>
            <Eye className="h-4 w-4 mr-2" /> Preview
          </Button>
          <Button variant="outline" onClick={() => setHistoryOpen(true)}>
            <History className="h-4 w-4 mr-2" /> History
          </Button>
          <Button variant="outline" disabled={!dirty || save.isPending} onClick={() => save.mutate("draft")}>
            <Save className="h-4 w-4 mr-2" /> Save Draft
          </Button>
          <Button disabled={save.isPending} onClick={() => save.mutate("published")}>
            <Send className="h-4 w-4 mr-2" /> Publish
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[260px_1fr] gap-6">
        <aside className="space-y-1">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-2 pb-2">
            CMS Pages
          </div>
          {sortedPages.map((p) => (
            <button
              key={p.id}
              onClick={() => setActiveSlug(p.slug)}
              className={cn(
                "w-full text-left px-3 py-2 rounded-lg flex items-center justify-between gap-2 text-sm",
                p.slug === activeSlug
                  ? "bg-primary-soft text-primary font-medium"
                  : "hover:bg-muted text-foreground",
              )}
            >
              <span className="truncate">{p.title}</span>
              <Badge variant={p.status === "published" ? "default" : "secondary"} className="text-[10px]">
                {p.status}
              </Badge>
            </button>
          ))}
        </aside>

        <section>
          <Tabs defaultValue="content">
            <TabsList>
              <TabsTrigger value="content">Content</TabsTrigger>
              <TabsTrigger value="seo">SEO</TabsTrigger>
            </TabsList>

            <TabsContent value="content" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="title">Page title</Label>
                <Input
                  id="title"
                  value={draft.title ?? ""}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Slug</Label>
                <Input value={active.slug} disabled />
                <p className="text-xs text-muted-foreground">
                  Public URL: <code>/{active.slug}</code>
                </p>
              </div>
              <div className="space-y-2">
                <Label>Body</Label>
                <RichTextEditor
                  value={draft.content ?? ""}
                  onChange={(html) => setDraft((d) => ({ ...d, content: html }))}
                />
              </div>
            </TabsContent>

            <TabsContent value="seo" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="meta_title">Meta title</Label>
                <Input
                  id="meta_title"
                  value={draft.meta_title ?? ""}
                  onChange={(e) => setDraft({ ...draft, meta_title: e.target.value })}
                  placeholder="Shown in search results — keep under 60 characters"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="meta_description">Meta description</Label>
                <Textarea
                  id="meta_description"
                  rows={3}
                  value={draft.meta_description ?? ""}
                  onChange={(e) => setDraft({ ...draft, meta_description: e.target.value })}
                  placeholder="Short summary — keep under 160 characters"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="og_image_url">Open Graph image URL</Label>
                <Input
                  id="og_image_url"
                  value={draft.og_image_url ?? ""}
                  onChange={(e) => setDraft({ ...draft, og_image_url: e.target.value })}
                  placeholder="https://…"
                />
              </div>
            </TabsContent>
          </Tabs>
        </section>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft.title}</DialogTitle>
          </DialogHeader>
          <article
            className="prose prose-neutral dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: draft.content ?? "" }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Version history — {active.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {versions.length === 0 && (
              <p className="text-sm text-muted-foreground">No versions yet.</p>
            )}
            {versions.map((v) => (
              <div key={v.id} className="flex items-center justify-between border border-border rounded-lg p-3">
                <div>
                  <div className="text-sm font-medium">
                    Version {v.version_number}{" "}
                    <Badge variant="secondary" className="ml-2 text-[10px]">{v.status}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(v.created_at).toLocaleString()}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => restore.mutate(v)} disabled={restore.isPending}>
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Restore
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
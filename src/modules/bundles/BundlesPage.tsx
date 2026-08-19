import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, MoreHorizontal, PackageOpen, Trash2, Edit, Eye, BarChart3, BookOpen } from "lucide-react";
import { useWorkspace } from "@/shared/hooks/useWorkspace";
import PageHeader from "@/modules/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "@/components/ui/use-toast";
import { listBundles, deleteBundle, updateBundle } from "./bundlesService";

export default function BundlesPage() {
  const { membership } = useWorkspace();
  const wsId = membership?.workspace.id;
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [toDelete, setToDelete] = useState<string | null>(null);

  const { data: bundles = [], isLoading } = useQuery({
    queryKey: ["bundles", wsId],
    queryFn: () => listBundles(wsId!),
    enabled: !!wsId,
  });

  const filtered = useMemo(() => {
    return bundles.filter((b) =>
      (status === "all" || b.status === status) &&
      b.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [bundles, search, status]);

  const del = useMutation({
    mutationFn: (id: string) => deleteBundle(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bundles", wsId] });
      toast({ title: "Bundle deleted" });
      setToDelete(null);
    },
    onError: (e: any) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  const togglePublish = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "draft" | "published" }) =>
      updateBundle(id, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bundles", wsId] });
      toast({ title: "Status updated" });
    },
  });

  return (
    <div className="container mx-auto py-6 space-y-6">
      <PageHeader
        title="Course Bundles"
        description="Group multiple courses into a single package."
        actions={
          <Button onClick={() => navigate("/app/bundles/new")}>
            <Plus className="h-4 w-4 mr-2" /> New bundle
          </Button>
        }
      />

      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Search bundles..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="private">Private</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bundle</TableHead>
              <TableHead>Courses</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-12">
                <PackageOpen className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                <div className="font-medium">No bundles yet</div>
                <div className="text-sm text-muted-foreground mb-3">Create your first course bundle.</div>
                <Button size="sm" onClick={() => navigate("/app/bundles/new")}>
                  <Plus className="h-4 w-4 mr-2" /> New bundle
                </Button>
              </TableCell></TableRow>
            ) : filtered.map((b) => (
              <TableRow key={b.id} className="cursor-pointer" onClick={() => navigate(`/app/bundles/${b.id}`)}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded bg-muted flex items-center justify-center overflow-hidden shrink-0">
                      {b.thumbnail_url ? <img src={b.thumbnail_url} className="h-full w-full object-cover" /> : <PackageOpen className="h-5 w-5 text-muted-foreground" />}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{b.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{b.short_description}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell><BundleCourseCount bundleId={b.id} /></TableCell>
                <TableCell>
                  {b.regular_price > 0
                    ? <div>
                        <span className="font-medium">{b.currency} {b.sale_price ?? b.regular_price}</span>
                        {b.sale_price ? <span className="ml-2 text-xs line-through text-muted-foreground">{b.regular_price}</span> : null}
                      </div>
                    : <Badge variant="secondary">Free</Badge>}
                </TableCell>
                <TableCell>
                  <Badge variant={b.status === "published" ? "default" : "secondary"} className="capitalize">{b.status}</Badge>
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => navigate(`/app/bundles/${b.id}`)}><Eye className="h-4 w-4 mr-2" />View</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate(`/app/bundles/${b.id}/edit`)}><Edit className="h-4 w-4 mr-2" />Edit</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => togglePublish.mutate({ id: b.id, status: b.status === "published" ? "draft" : "published" })}>
                        <BarChart3 className="h-4 w-4 mr-2" />{b.status === "published" ? "Unpublish" : "Publish"}
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => setToDelete(b.id)}><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this bundle?</AlertDialogTitle>
            <AlertDialogDescription>Existing student enrollments are kept; only the bundle is removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => toDelete && del.mutate(toDelete)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function BundleCourseCount({ bundleId }: { bundleId: string }) {
  const { data } = useQuery({
    queryKey: ["bundle-course-count", bundleId],
    queryFn: async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { count } = await supabase.from("bundle_courses").select("id", { count: "exact", head: true }).eq("bundle_id", bundleId);
      return count ?? 0;
    },
  });
  return <div className="flex items-center gap-1.5"><BookOpen className="h-3.5 w-3.5 text-muted-foreground" />{data ?? 0}</div>;
}

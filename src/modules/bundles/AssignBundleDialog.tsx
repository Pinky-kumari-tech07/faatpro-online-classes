import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWorkspace } from "@/shared/hooks/useWorkspace";
import { listBundles, bulkEnrollStudentsInBundle } from "./bundlesService";
import { toast } from "@/components/ui/use-toast";
import { Search, PackageOpen, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  studentIds: string[];
  onAssigned?: () => void;
}

export default function AssignBundleDialog({ open, onOpenChange, studentIds, onAssigned }: Props) {
  const { membership } = useWorkspace();
  const wsId = membership?.workspace.id;
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const { data: bundles = [], isLoading } = useQuery({
    queryKey: ["bundles", wsId],
    queryFn: () => listBundles(wsId!),
    enabled: !!wsId && open,
  });

  const filtered = bundles.filter((b) => b.name.toLowerCase().includes(search.toLowerCase()));

  const assign = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Pick a bundle");
      return bulkEnrollStudentsInBundle(studentIds, selected);
    },
    onSuccess: (n) => {
      toast({ title: "Bundle assigned", description: `Enrolled ${studentIds.length} student${studentIds.length>1?"s":""}.` });
      qc.invalidateQueries({ queryKey: ["bundle-students"] });
      qc.invalidateQueries({ queryKey: ["my-bundles"] });
      onAssigned?.();
      onOpenChange(false);
      setSelected(null);
      setSearch("");
    },
    onError: (e: any) => toast({ title: "Assign failed", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Assign bundle</DialogTitle>
          <DialogDescription>
            {studentIds.length} student{studentIds.length === 1 ? "" : "s"} will be enrolled in every course of the selected bundle.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Search bundles..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="max-h-72 overflow-y-auto space-y-1 border rounded-md p-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin mr-2" />Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">No bundles found.</div>
            ) : (
              filtered.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setSelected(b.id)}
                  className={cn(
                    "w-full flex items-center gap-3 p-2 rounded text-left hover:bg-muted/60 transition-colors",
                    selected === b.id && "bg-primary/10 ring-1 ring-primary"
                  )}
                >
                  <div className="h-10 w-10 rounded bg-muted flex items-center justify-center overflow-hidden">
                    {b.thumbnail_url ? <img src={b.thumbnail_url} className="h-full w-full object-cover" /> : <PackageOpen className="h-5 w-5 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{b.name}</div>
                    <div className="text-xs text-muted-foreground capitalize">{b.status}</div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => assign.mutate()} disabled={!selected || assign.isPending}>
            {assign.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Assign bundle
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

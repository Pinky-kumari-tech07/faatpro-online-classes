import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Video, Plus, ExternalLink, Search, Globe, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWorkspace } from "@/shared/hooks/useWorkspace";
import { useAuth } from "@/shared/hooks/useAuth";
import { liveClassService } from "@/services/supabase";
import { normalizeMeetingUrl } from "@/lib/meetingUrl";
import { toast } from "@/components/ui/use-toast";
import LiveClassDialog from "./LiveClassDialog";
import type { LiveClassStatus } from "@/types";

const statusColor: Record<LiveClassStatus, string> = {
  scheduled: "bg-primary-soft text-primary",
  live: "bg-success/15 text-success",
  completed: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/10 text-destructive",
};

export default function LiveClassesPage() {
  const { membership, primaryRole } = useWorkspace();
  const { user } = useAuth();
  const qc = useQueryClient();
  const wsId = membership!.workspace.id;
  const isStudent = primaryRole === "student";
  const isInstructor = primaryRole === "instructor";
  const canManage = ["organization_admin", "staff", "super_admin", "instructor"].includes(primaryRole ?? "");

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<LiveClassStatus | "all">("all");
  const [searchParams, setSearchParams] = useSearchParams();
  const [courseId, setCourseId] = useState<string | undefined>(searchParams.get("course") ?? undefined);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  useEffect(() => {
    const c = searchParams.get("course") ?? undefined;
    if (c !== courseId) setCourseId(c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const { data, error } = useQuery({
    queryKey: ["live-classes", wsId, search, status, courseId, isStudent && user?.id, isInstructor],
    queryFn: () =>
      // Instructors can own courses that live in another workspace, so we do
      // not scope their list by workspace — RLS restricts rows to their own
      // courses anyway.
      liveClassService.list(isStudent || isInstructor ? null : wsId, {
        search: search || undefined,
        status,
        courseId,
        studentId: isStudent ? user?.id : undefined,
      }),
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => liveClassService.cancel(id),
    onSuccess: () => {
      toast({ title: "Class cancelled" });
      qc.invalidateQueries({ queryKey: ["live-classes", wsId] });
    },
  });

  return (
    <div className="space-y-6 max-w-7xl">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Live classes</h1>
          <p className="text-muted-foreground mt-1">
            {isStudent ? "Upcoming sessions from your enrolled courses." : "Schedule and manage live sessions."}
          </p>
        </div>
        {canManage && (
          <Button onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Schedule class
          </Button>
        )}
      </header>

      <Card className="p-4 border-border shadow-none">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search class title…" className="pl-9" />
          </div>
          <Select value={status} onValueChange={(v) => setStatus(v as any)}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="live">Live</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="border-border shadow-none">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Class</TableHead>
              <TableHead>Course</TableHead>
            <TableHead>Instructor</TableHead>
              <TableHead>Starts</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.rows ?? []).map((lc: any) => {
              const now = Date.now();
              const starts = new Date(lc.starts_at).getTime();
              const ends = lc.ends_at ? new Date(lc.ends_at).getTime() : starts + 60 * 60 * 1000;
              let effectiveStatus: LiveClassStatus = lc.status;
              if (lc.status !== "cancelled") {
                if (now >= ends) effectiveStatus = "completed";
                else if (now >= starts) effectiveStatus = "live";
                else effectiveStatus = "scheduled";
              }
              const isJoinable = effectiveStatus === "live" || (effectiveStatus === "scheduled" && starts - now <= 15 * 60 * 1000);
              return (
              <TableRow key={lc.id}>
                <TableCell>
                  <div className="font-medium flex items-center gap-2">
                    {lc.title}
                    {lc.is_public
                      ? <Badge variant="secondary" className="gap-1"><Globe className="h-3 w-3" />Public</Badge>
                      : <Badge variant="outline" className="gap-1"><Lock className="h-3 w-3" />Private</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground capitalize">{lc.provider.replace("_", " ")}</div>
                </TableCell>
                <TableCell className="text-sm">{lc.courses?.title ?? "—"}</TableCell>
                <TableCell className="text-sm">{lc.instructor?.full_name ?? "—"}</TableCell>
                <TableCell className="text-sm">
                  {new Date(lc.starts_at).toLocaleString()}
                  <div className="text-xs text-muted-foreground">{lc.timezone}</div>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className={statusColor[effectiveStatus]}>{effectiveStatus}</Badge>
                </TableCell>
                <TableCell className="text-right space-x-2">
                  {lc.meeting_url && isJoinable && (
                    <Button size="sm" variant="outline" asChild onClick={() => liveClassService.recordJoin(lc.id).catch(() => {})}>
                      <a href={normalizeMeetingUrl(lc.meeting_url)} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3 w-3 mr-1" /> Join
                      </a>
                    </Button>
                  )}
                  {canManage && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => { setEditing(lc); setOpen(true); }}>Edit</Button>
                      {effectiveStatus === "scheduled" && (
                        <Button size="sm" variant="ghost" onClick={() => cancelMut.mutate(lc.id)}>Cancel</Button>
                      )}
                    </>
                  )}
                </TableCell>
              </TableRow>
              );
            })}
            {(data?.rows.length ?? 0) === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  <Video className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  No live classes yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {canManage && (
        <LiveClassDialog open={open} onOpenChange={setOpen} initial={editing} workspaceId={wsId} />
      )}
    </div>
  );
}
import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useWorkspace } from "@/shared/hooks/useWorkspace";
import { useAuth } from "@/shared/hooks/useAuth";
import { notificationService } from "@/services/supabase";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

export default function NotificationBell() {
  const { membership } = useWorkspace();
  const { user } = useAuth();
  const qc = useQueryClient();
  const wsId = membership?.workspace.id;

  const { data: count = 0 } = useQuery({
    queryKey: ["notif-count", wsId, user?.id],
    queryFn: () => notificationService.unreadCount(wsId!, user!.id),
    enabled: !!wsId && !!user,
    refetchInterval: 30_000,
  });
  const { data: items = [] } = useQuery({
    queryKey: ["notif-list", wsId, user?.id],
    queryFn: () => notificationService.list(wsId!, user!.id),
    enabled: !!wsId && !!user,
  });

  const markAll = useMutation({
    mutationFn: () => notificationService.markAllRead(wsId!, user!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notif-count"] });
      qc.invalidateQueries({ queryKey: ["notif-list"] });
    },
  });

  useEffect(() => {
    if (!wsId || !user) return;
    const channel = supabase
      .channel(`notif-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `profile_id=eq.${user.id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["notif-count"] });
          qc.invalidateQueries({ queryKey: ["notif-list"] });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [wsId, user, qc]);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold grid place-items-center">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[380px] sm:max-w-md">
        <SheetHeader className="flex-row items-center justify-between">
          <SheetTitle>Notifications</SheetTitle>
          <Button variant="ghost" size="sm" onClick={() => markAll.mutate()} disabled={count === 0}>
            <CheckCheck className="h-3 w-3 mr-1" /> Mark all read
          </Button>
        </SheetHeader>
        <div className="mt-4 space-y-1 -mx-2 overflow-y-auto h-[calc(100vh-100px)]">
          {items.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-12">No notifications yet.</div>
          )}
          {items.map((n) => (
            <div key={n.id} className={`px-3 py-2.5 rounded-lg ${n.read_at ? "" : "bg-primary-soft/50"}`}>
              <p className="text-sm font-medium">{n.title}</p>
              {n.body && <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>}
              <p className="text-[11px] text-muted-foreground mt-1">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</p>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
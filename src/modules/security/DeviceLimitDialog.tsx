import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { listMySessions, revokeSession } from "@/services/supabase/sessionService";
import { authService } from "@/services/supabase";
import { useLocation, useNavigate } from "react-router-dom";
import { Loader2, Monitor, Smartphone, Tablet, MapPin } from "lucide-react";
import { useState } from "react";
import { toast } from "@/components/ui/use-toast";

function deviceIcon(t?: string | null) {
  if (t === "mobile") return Smartphone;
  if (t === "tablet") return Tablet;
  return Monitor;
}

export function DeviceLimitDialog({
  open,
  max,
  onRetry,
  onCancel,
}: {
  open: boolean;
  max: number;
  onRetry: () => Promise<void> | void;
  onCancel: () => void;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [busy, setBusy] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    enabled: open,
    queryKey: ["my-sessions"],
    queryFn: listMySessions,
  });

  const active = (data ?? []).filter((s: any) => s.is_active);

  const handleRevoke = async (id: string) => {
    setBusy(id);
    try {
      await revokeSession(id);
      await qc.invalidateQueries({ queryKey: ["my-sessions"] });
      await onRetry();
    } catch (e: any) {
      toast({ title: "Couldn't sign out device", description: e?.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const cancelLogin = async () => {
    onCancel();
    await authService.signOut();
    const next = encodeURIComponent(location.pathname + location.search + location.hash);
    navigate(`/auth/login?next=${next}`, { replace: true });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) cancelLogin(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Maximum device limit reached</DialogTitle>
          <DialogDescription>
            You're signed in on {max} {max === 1 ? "device" : "devices"} already. Sign out one to continue here.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-[55vh] overflow-y-auto -mx-1 px-1">
          {isLoading ? (
            <div className="grid place-items-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : active.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No active devices found.</p>
          ) : active.map((s: any) => {
            const Icon = deviceIcon(s.device_type);
            return (
              <div key={s.id} className="flex items-center gap-3 rounded-xl border border-border/60 p-3">
                <div className="h-10 w-10 rounded-lg bg-muted grid place-items-center">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{s.device_name ?? "Unknown device"}</p>
                  <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                    {s.location && (<><MapPin className="h-3 w-3" /> {s.location} · </>)}
                    Active {new Date(s.last_active).toLocaleString()}
                  </p>
                </div>
                <Button size="sm" variant="outline" disabled={busy === s.id} onClick={() => handleRevoke(s.id)}>
                  {busy === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Sign out"}
                </Button>
              </div>
            );
          })}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={cancelLogin}>Cancel login</Button>
          <Button onClick={() => onRetry()}>Try again</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
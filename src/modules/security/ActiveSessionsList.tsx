import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Monitor, Smartphone, Tablet, MapPin, LogOut } from "lucide-react";
import { listMySessions, revokeSession, revokeAllSessions, getOrCreateDeviceToken } from "@/services/supabase/sessionService";
import { useAuth } from "@/shared/hooks/useAuth";
import { useWorkspace } from "@/shared/hooks/useWorkspace";
import { toast } from "@/components/ui/use-toast";
import { useState } from "react";

function deviceIcon(t?: string | null) {
  if (t === "mobile") return Smartphone;
  if (t === "tablet") return Tablet;
  return Monitor;
}

export function ActiveSessionsList() {
  const { user } = useAuth();
  const { membership } = useWorkspace();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const currentToken = getOrCreateDeviceToken();

  const { data, isLoading } = useQuery({
    queryKey: ["my-sessions"],
    queryFn: listMySessions,
  });

  const sessions = data ?? [];
  const active = sessions.filter((s: any) => s.is_active);
  const recent = sessions.filter((s: any) => !s.is_active).slice(0, 5);

  const revoke = async (id: string) => {
    setBusy(id);
    try {
      await revokeSession(id);
      await qc.invalidateQueries({ queryKey: ["my-sessions"] });
      toast({ title: "Device signed out" });
    } catch (e: any) {
      toast({ title: "Failed", description: e?.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const revokeAll = async () => {
    if (!user) return;
    if (!confirm("Sign out of all other devices?")) return;
    setBusy("all");
    try {
      // revoke all then re-register current device
      const others = active.filter((s: any) => s.session_token !== currentToken);
      for (const s of others) await revokeSession(s.id);
      await qc.invalidateQueries({ queryKey: ["my-sessions"] });
      toast({ title: "Other devices signed out" });
    } catch (e: any) {
      toast({ title: "Failed", description: e?.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Active devices</h3>
          <p className="text-xs text-muted-foreground">{active.length} active {active.length === 1 ? "device" : "devices"}</p>
        </div>
        {active.length > 1 && (
          <Button variant="outline" size="sm" onClick={revokeAll} disabled={busy === "all"}>
            <LogOut className="h-3.5 w-3.5 mr-1.5" /> Sign out others
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : active.length === 0 ? (
        <p className="text-sm text-muted-foreground">No active sessions.</p>
      ) : (
        <div className="space-y-2">
          {active.map((s: any) => {
            const Icon = deviceIcon(s.device_type);
            const isCurrent = s.session_token === currentToken;
            return (
              <Card key={s.id} className="p-3 sm:p-4 rounded-xl border-border/60 flex items-center gap-3">
                <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium truncate">{s.device_name ?? "Unknown device"}</p>
                    {isCurrent && <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-[10px]">This device</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                    {s.location && (<><MapPin className="h-3 w-3" /> {s.location}</>)}
                    {s.ip_address && <span className="ml-1">· {s.ip_address}</span>}
                  </p>
                  <p className="text-[11px] text-muted-foreground/80 mt-0.5">
                    Signed in {new Date(s.login_time).toLocaleString()} · Last active {new Date(s.last_active).toLocaleString()}
                  </p>
                </div>
                {!isCurrent && (
                  <Button size="sm" variant="ghost" disabled={busy === s.id} onClick={() => revoke(s.id)}>
                    {busy === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign out"}
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {recent.length > 0 && (
        <div className="pt-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Recent activity</h4>
          <div className="space-y-1.5">
            {recent.map((s: any) => (
              <div key={s.id} className="text-xs text-muted-foreground flex items-center justify-between rounded-lg border border-border/40 px-3 py-2">
                <span className="truncate">{s.device_name} · {s.location ?? s.ip_address ?? "—"}</span>
                <span>{new Date(s.revoked_at ?? s.last_active).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
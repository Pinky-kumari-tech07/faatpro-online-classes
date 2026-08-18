import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useWorkspace } from "@/shared/hooks/useWorkspace";
import { getSecuritySettings, upsertSecuritySettings, revokeSession, revokeAllSessions } from "@/services/supabase/sessionService";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { Loader2, Shield, Monitor, Smartphone, Tablet, MapPin, LogOut, AlertTriangle } from "lucide-react";

function deviceIcon(t?: string | null) {
  if (t === "mobile") return Smartphone;
  if (t === "tablet") return Tablet;
  return Monitor;
}

export default function DeviceLoginControlPage() {
  const { membership } = useWorkspace();
  const workspaceId = membership?.workspace.id ?? null;
  const qc = useQueryClient();

  const settingsQ = useQuery({
    enabled: !!workspaceId,
    queryKey: ["security-settings", workspaceId],
    queryFn: () => getSecuritySettings(workspaceId!),
  });

  const [form, setForm] = useState({
    max_devices: 3,
    session_expiry_days: 30,
    allow_multi_device: true,
    auto_logout_oldest: true,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settingsQ.data) {
      setForm({
        max_devices: settingsQ.data.max_devices ?? 3,
        session_expiry_days: settingsQ.data.session_expiry_days ?? 30,
        allow_multi_device: settingsQ.data.allow_multi_device ?? true,
        auto_logout_oldest: settingsQ.data.auto_logout_oldest ?? true,
      });
    }
  }, [settingsQ.data]);

  const sessionsQ = useQuery({
    enabled: !!workspaceId,
    queryKey: ["ws-sessions", workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_sessions")
        .select("*, profiles:user_id(full_name,email,avatar_url)")
        .eq("workspace_id", workspaceId!)
        .order("last_active", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const save = async () => {
    if (!workspaceId) return;
    setSaving(true);
    try {
      await upsertSecuritySettings({ workspace_id: workspaceId, ...form });
      toast({ title: "Security settings saved" });
      qc.invalidateQueries({ queryKey: ["security-settings", workspaceId] });
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const forceLogout = async (userId: string) => {
    if (!workspaceId) return;
    if (!confirm("Force logout all devices for this user?")) return;
    try {
      const n = await revokeAllSessions(userId, workspaceId);
      toast({ title: `Signed out ${n} session${n === 1 ? "" : "s"}` });
      qc.invalidateQueries({ queryKey: ["ws-sessions", workspaceId] });
    } catch (e: any) {
      toast({ title: "Failed", description: e?.message, variant: "destructive" });
    }
  };

  const revokeOne = async (id: string) => {
    try {
      await revokeSession(id);
      qc.invalidateQueries({ queryKey: ["ws-sessions", workspaceId] });
      toast({ title: "Device signed out" });
    } catch (e: any) {
      toast({ title: "Failed", description: e?.message, variant: "destructive" });
    }
  };

  const sessions = sessionsQ.data ?? [];
  const activeSessions = sessions.filter((s: any) => s.is_active);
  const uniqueUsers = new Set(activeSessions.map((s: any) => s.user_id)).size;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center">
          <Shield className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Device Login Control</h1>
          <p className="text-sm text-muted-foreground">Manage device limits and monitor user sessions across your workspace.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Active sessions" value={activeSessions.length} />
        <StatCard label="Online users" value={uniqueUsers} />
        <StatCard label="Device limit" value={form.allow_multi_device ? form.max_devices : 1} />
        <StatCard label="Session expiry" value={`${form.session_expiry_days}d`} />
      </div>

      <Tabs defaultValue="settings">
        <TabsList>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="monitor">Active Sessions</TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="mt-5">
          <Card className="p-6 rounded-2xl border-border/60">
            {settingsQ.isLoading ? (
              <div className="grid place-items-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Maximum devices per user</Label>
                  <Select value={String(form.max_devices)} onValueChange={(v) => setForm({ ...form, max_devices: Number(v) })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 device</SelectItem>
                      <SelectItem value="2">2 devices</SelectItem>
                      <SelectItem value="3">3 devices</SelectItem>
                      <SelectItem value="5">5 devices</SelectItem>
                      <SelectItem value="999">Unlimited</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Session expiry (days)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    value={form.session_expiry_days}
                    onChange={(e) => setForm({ ...form, session_expiry_days: Number(e.target.value) || 30 })}
                  />
                </div>
                <ToggleRow
                  label="Allow multiple devices"
                  desc="Users can be signed in on more than one device at once."
                  checked={form.allow_multi_device}
                  onChange={(v) => setForm({ ...form, allow_multi_device: v })}
                />
                <ToggleRow
                  label="Auto logout oldest device"
                  desc="When the limit is reached, sign out the oldest session automatically."
                  checked={form.auto_logout_oldest}
                  onChange={(v) => setForm({ ...form, auto_logout_oldest: v })}
                />
                <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
                  <Button onClick={save} disabled={saving}>
                    {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving</> : "Save settings"}
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="monitor" className="mt-5 space-y-3">
          {sessionsQ.isLoading ? (
            <div className="grid place-items-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : activeSessions.length === 0 ? (
            <Card className="p-8 rounded-2xl border-dashed text-center text-sm text-muted-foreground">
              No active sessions right now.
            </Card>
          ) : (
            activeSessions.map((s: any) => {
              const Icon = deviceIcon(s.device_type);
              const prof = s.profiles ?? {};
              return (
                <Card key={s.id} className="p-4 rounded-2xl border-border/60 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold truncate">{prof.full_name || prof.email || "Unknown user"}</p>
                      <Badge variant="secondary" className="text-[10px]">{s.device_name ?? "Device"}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                      {s.location && (<><MapPin className="h-3 w-3" /> {s.location}</>)}
                      {s.ip_address && <span className="ml-1">· {s.ip_address}</span>}
                    </p>
                    <p className="text-[11px] text-muted-foreground/80">
                      Active {new Date(s.last_active).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <Button size="sm" variant="outline" onClick={() => revokeOne(s.id)}>
                      Sign out
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => forceLogout(s.user_id)} title="Force logout all devices for this user">
                      <LogOut className="h-3.5 w-3.5 mr-1" /> All devices
                    </Button>
                  </div>
                </Card>
              );
            })
          )}

          <Card className="p-4 rounded-2xl border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900/50 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            <p className="text-xs text-amber-800 dark:text-amber-200">
              Suspicious activity: users with more sessions than the configured limit are highlighted automatically when over the threshold.
            </p>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: any }) {
  return (
    <Card className="p-4 rounded-2xl border-border/60">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </Card>
  );
}

function ToggleRow({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-border/60 bg-muted/20 p-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
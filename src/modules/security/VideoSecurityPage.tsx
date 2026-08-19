import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { ShieldCheck, Save, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/shared/hooks/useWorkspace";

type Settings = {
  disable_downloads: boolean;
  signed_urls: boolean;
  dynamic_watermark: boolean;
  hls_streaming: boolean;
  session_validation: boolean;
  device_limit: boolean;
  concurrent_login_protection: boolean;
  screen_record_deterrence: boolean;
  youtube_nocookie: boolean;
};

const DEFAULTS: Settings = {
  disable_downloads: true,
  signed_urls: false,
  dynamic_watermark: true,
  hls_streaming: false,
  session_validation: true,
  device_limit: true,
  concurrent_login_protection: true,
  screen_record_deterrence: true,
  youtube_nocookie: true,
};

const TOGGLES: { key: keyof Settings; title: string; desc: string }[] = [
  { key: "disable_downloads", title: "Disable Downloads", desc: "Hide native download/playback-rate controls and block right-click on videos." },
  { key: "signed_urls", title: "Signed URLs", desc: "Serve videos via short-lived signed URLs (requires CloudFront key pair)." },
  { key: "dynamic_watermark", title: "Dynamic Watermark", desc: "Overlay viewer's name + timestamp; reposition every 10 seconds." },
  { key: "hls_streaming", title: "HLS Streaming", desc: "Stream as .m3u8 + .ts segments instead of MP4 (requires transcoding pipeline)." },
  { key: "session_validation", title: "Session Validation", desc: "Verify active enrollment and auth on every playback request." },
  { key: "device_limit", title: "Device Limit", desc: "Restrict simultaneous devices per student." },
  { key: "concurrent_login_protection", title: "Concurrent Login Protection", desc: "Block more than one active session for the same account." },
  { key: "screen_record_deterrence", title: "Screen Recording Deterrence", desc: "Detect PrintScreen / display capture and warn + log the attempt." },
  { key: "youtube_nocookie", title: "YouTube Privacy Mode", desc: "Embed YouTube via youtube-nocookie.com with modest branding and no related videos." },
];

export default function VideoSecurityPage() {
  const { membership } = useWorkspace() as any;
  const wsId: string | undefined = membership?.workspace_id;
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    if (!wsId) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("video_security_settings")
        .select("*")
        .eq("workspace_id", wsId)
        .maybeSingle();
      if (data) setSettings({ ...DEFAULTS, ...(data as any) });
      const { data: logRows } = await supabase
        .from("video_access_logs")
        .select("id,event_type,user_id,lesson_id,course_id,created_at,details")
        .eq("workspace_id", wsId)
        .order("created_at", { ascending: false })
        .limit(100);
      setLogs(logRows ?? []);
      setLoading(false);
    })();
  }, [wsId]);

  const update = (key: keyof Settings, value: boolean) =>
    setSettings((s) => ({ ...s, [key]: value }));

  const save = async () => {
    if (!wsId) return;
    setSaving(true);
    const { error } = await supabase
      .from("video_security_settings")
      .upsert({ workspace_id: wsId, ...settings } as any, { onConflict: "workspace_id" });
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Video security settings saved");
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" /> Video Security
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Control how course videos are protected against downloading, sharing, and screen recording.
          </p>
        </div>
        <Button onClick={save} disabled={saving || loading}>
          <Save className="h-4 w-4 mr-2" /> {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>

      <Tabs defaultValue="settings">
        <TabsList>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="logs"><History className="h-3.5 w-3.5 mr-1.5" /> Access Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {TOGGLES.map((t) => (
              <Card key={t.key}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>{t.title}</span>
                    <Switch
                      checked={settings[t.key]}
                      onCheckedChange={(v) => update(t.key, v)}
                      disabled={loading}
                    />
                  </CardTitle>
                  <CardDescription className="text-xs">{t.desc}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="logs" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent video events</CardTitle>
              <CardDescription className="text-xs">
                Last 100 events: video starts/completions and suspicious activity.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Lesson</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">No events yet.</TableCell></TableRow>
                  ) : logs.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="text-xs">{new Date(l.created_at).toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant={l.event_type.includes("attempt") || l.event_type.includes("blocked") ? "destructive" : "secondary"}>
                          {l.event_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-mono">{(l.user_id ?? "").slice(0, 8)}</TableCell>
                      <TableCell className="text-xs font-mono">{(l.lesson_id ?? "").slice(0, 8)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
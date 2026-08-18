import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Shield, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/shared/hooks/useWorkspace";
import { useQueryClient } from "@tanstack/react-query";
import { DEFAULT_CONTENT_PROTECTION, type ContentProtectionSettings } from "@/shared/hooks/useContentProtection";

const TOGGLES: { key: keyof ContentProtectionSettings; title: string; desc: string }[] = [
  { key: "disable_right_click", title: "Disable right click", desc: "Block browser context menu on protected pages." },
  { key: "disable_keyboard_shortcuts", title: "Block keyboard shortcuts", desc: "Disable F12, Ctrl/Cmd+Shift+I/J/C, Ctrl+U, Ctrl+S, Ctrl+P." },
  { key: "disable_copy", title: "Disable copy", desc: "Block copy/cut on premium lesson content." },
  { key: "disable_text_selection", title: "Disable text selection", desc: "Prevent selecting text inside premium content (forms still work)." },
  { key: "disable_image_drag", title: "Disable image / video drag", desc: "Prevent drag-and-drop of images and videos." },
  { key: "disable_print", title: "Disable print", desc: "Block Ctrl/Cmd+P and hide page when printing." },
  { key: "devtools_detection", title: "DevTools detection", desc: "Blur premium content while browser dev tools are open." },
  { key: "dynamic_watermark", title: "Dynamic watermark", desc: "Overlay student name, email and timestamp on premium pages." },
  { key: "video_watermark", title: "Video watermark", desc: "Overlay moving watermark on video players." },
  { key: "pdf_protection", title: "PDF protection", desc: "Force PDFs to open in the secure viewer (no download / print / copy)." },
  { key: "screenshot_deterrence", title: "Screenshot deterrence", desc: "Show warnings and log screen-capture attempts." },
  { key: "apply_on_public_site", title: "Apply on public website", desc: "Also enforce these rules on the marketing site (not just /app)." },
];

export default function ContentProtectionPage() {
  const { membership } = useWorkspace();
  const workspaceId = membership?.workspace?.id;
  const [settings, setSettings] = useState<ContentProtectionSettings>(DEFAULT_CONTENT_PROTECTION);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();

  useEffect(() => {
    if (!workspaceId) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("content_protection_settings" as any)
        .select("*")
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      if (data) setSettings({ ...DEFAULT_CONTENT_PROTECTION, ...(data as any) });
      setLoading(false);
    })();
  }, [workspaceId]);

  const save = async () => {
    if (!workspaceId) return;
    setSaving(true);
    const payload = { workspace_id: workspaceId, ...settings } as any;
    const { error } = await supabase
      .from("content_protection_settings" as any)
      .upsert(payload, { onConflict: "workspace_id" });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Content protection settings saved");
    qc.invalidateQueries({ queryKey: ["content-protection-settings"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Shield className="h-5 w-5" /> Content protection</h1>
          <p className="text-sm text-muted-foreground">Global rules applied across the LMS — courses, lessons, PDFs, quizzes and live classes.</p>
        </div>
        <Button onClick={save} disabled={saving || loading}>
          <Save className="h-4 w-4 mr-2" /> {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Protection toggles</CardTitle>
          <CardDescription>Changes take effect immediately for new page loads.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {TOGGLES.map((t) => (
            <div key={t.key} className="flex items-start justify-between rounded-lg border p-4 gap-4">
              <div className="space-y-1">
                <Label htmlFor={t.key} className="text-base">{t.title}</Label>
                <p className="text-sm text-muted-foreground">{t.desc}</p>
              </div>
              <Switch
                id={t.key as string}
                checked={Boolean(settings[t.key])}
                onCheckedChange={(v) => setSettings((s) => ({ ...s, [t.key]: v }))}
              />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
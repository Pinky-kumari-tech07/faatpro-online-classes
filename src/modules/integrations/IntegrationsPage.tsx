import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plug, Video, CreditCard, KeyRound, Mail, Copy, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import PageHeader from "@/modules/shared/PageHeader";
import { useWorkspace } from "@/shared/hooks/useWorkspace";
import { integrationService } from "./integrationService";
import type { IntegrationProvider, WorkspaceIntegration } from "./types";

type IntegrationDef = {
  provider: IntegrationProvider;
  name: string;
  category: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
};

const DEFS: IntegrationDef[] = [
  { provider: "razorpay", name: "Razorpay", category: "Payments", description: "Accept course payments, subscriptions, and invoices in India.", icon: CreditCard },
];

function statusLabel(provider: IntegrationProvider, i?: WorkspaceIntegration): { label: string; tone: "default" | "secondary" | "outline" } {
  if (!i) return { label: "Not connected", tone: "secondary" };
  if (provider === "razorpay" && i.enabled) {
    return { label: i.mode === "live" ? "Live mode" : "Test mode", tone: "default" };
  }
  if (i.enabled) return { label: "Connected", tone: "default" };
  return { label: "Not connected", tone: "secondary" };
}

export default function IntegrationsPage() {
  const { membership, hasAnyRole } = useWorkspace();
  const wsId = membership!.workspace.id;
  const canManage = hasAnyRole(["organization_admin", "super_admin"]);

  const { data: rows } = useQuery({
    queryKey: ["workspace-integrations", wsId],
    queryFn: () => integrationService.list(wsId),
  });

  const byProvider = useMemo(() => {
    const m = new Map<IntegrationProvider, WorkspaceIntegration>();
    (rows ?? []).forEach((r) => m.set(r.provider, r));
    return m;
  }, [rows]);

  const [open, setOpen] = useState<IntegrationProvider | null>(null);

  return (
    <div className="space-y-6 max-w-6xl">
      <PageHeader title="Integrations" description="Connect the tools your academy uses for live classes, payments, authentication, and email." />
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {DEFS.map((d) => {
          const existing = byProvider.get(d.provider);
          const s = statusLabel(d.provider, existing);
          const Icon = d.icon;
          return (
            <Card key={d.provider} className="p-5 border-border shadow-none flex flex-col">
              <div className="flex items-start justify-between mb-2">
                <div className="font-semibold flex items-center gap-2"><Icon className="h-4 w-4 text-primary" /> {d.name}</div>
                <Badge variant={s.tone}>{s.label}</Badge>
              </div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{d.category}</p>
              <p className="text-sm text-muted-foreground mb-4 flex-1">{d.description}</p>
              <Button
                size="sm"
                variant="outline"
                disabled={!canManage}
                onClick={() => setOpen(d.provider)}
              >
                {existing ? "Edit configuration" : "Configure now"}
              </Button>
            </Card>
          );
        })}
      </div>

      {open && (
        <ConfigureDialog
          provider={open}
          def={DEFS.find((d) => d.provider === open)!}
          existing={byProvider.get(open)}
          workspaceId={wsId}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}

/* ============ Configure Dialog ============ */

function ConfigureDialog({
  provider,
  def,
  existing,
  workspaceId,
  onClose,
}: {
  provider: IntegrationProvider;
  def: IntegrationDef;
  existing?: WorkspaceIntegration;
  workspaceId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();

  const defaults: Record<IntegrationProvider, any> = {
    google_meet: { enabled: false, calendar_email: "", link_mode: "manual", default_duration: 60 },
    zoom: { enabled: false, account_email: "", client_id: "", client_secret: "", default_duration: 60, recording_enabled: false },
    razorpay: { enabled: false, mode: "test", key_id: "", key_secret: "", webhook_secret: "", currency: "INR", gst_enabled: false },
    google_oauth: { enabled: false, client_id: "", client_secret: "", allowed_domains: "", auto_create_profile: true, default_role: "student" },
    email_smtp: { enabled: false, host: "", port: 587, encryption: "tls", username: "", password: "", from_email: "", from_name: "", reply_to: "", test_to: "" },
  };

  const initial = {
    ...defaults[provider],
    ...(existing ? integrationService.maskedConfig(existing) : {}),
    enabled: existing?.enabled ?? defaults[provider].enabled,
    ...(provider === "razorpay" ? { mode: existing?.mode ?? "test" } : {}),
  };

  const [form, setForm] = useState<any>(initial);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: async () => {
      const { enabled, mode, ...rest } = form;
      return integrationService.upsert(
        workspaceId,
        provider,
        def.category,
        !!enabled,
        provider === "razorpay" ? mode : null,
        rest,
        existing,
      );
    },
    onSuccess: () => {
      toast({ title: `${def.name} saved` });
      qc.invalidateQueries({ queryKey: ["workspace-integrations", workspaceId] });
      onClose();
    },
    onError: (e: any) => toast({ title: "Save failed", description: e?.message ?? "Unknown error", variant: "destructive" }),
  });

  const validate = (): string | null => {
    if (provider === "zoom" && form.enabled) {
      if (!form.account_email || !form.client_id) return "Account email and Client ID are required.";
    }
    if (provider === "razorpay" && form.enabled) {
      if (!form.key_id) return "Razorpay Key ID is required.";
    }
    if (provider === "google_oauth" && form.enabled) {
      if (!form.client_id) return "Google OAuth Client ID is required.";
    }
    if (provider === "email_smtp" && form.enabled) {
      if (!form.host || !form.from_email) return "SMTP host and From email are required.";
    }
    return null;
  };

  const onSave = () => {
    const err = validate();
    if (err) { toast({ title: "Check required fields", description: err, variant: "destructive" }); return; }
    setSaving(true);
    save.mutate(undefined, { onSettled: () => setSaving(false) });
  };

  const sendTest = async () => {
    if (!form.test_to) { toast({ title: "Enter a test recipient email", variant: "destructive" }); return; }
    setTesting(true);
    try {
      // Save first so the edge function reads the latest config
      const err = validate();
      if (err) throw new Error(err);
      await save.mutateAsync();
      await integrationService.sendTestEmail(workspaceId, form.test_to);
      toast({ title: "Test email sent", description: `Check ${form.test_to}` });
    } catch (e: any) {
      toast({ title: "Test email failed", description: e?.message ?? "Unknown error", variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configure {def.name}</DialogTitle>
          <DialogDescription>{def.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Row label="Enabled" hint="Turn this integration on or off for your workspace.">
            <Switch checked={!!form.enabled} onCheckedChange={(v) => set("enabled", v)} />
          </Row>

          {provider === "google_meet" && (
            <>
              <Field label="Google Calendar email"><Input value={form.calendar_email} onChange={(e) => set("calendar_email", e.target.value)} placeholder="you@example.com" /></Field>
              <Field label="Meeting link mode">
                <Select value={form.link_mode} onValueChange={(v) => set("link_mode", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual link</SelectItem>
                    <SelectItem value="generated">Generated later</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Default meeting duration (minutes)"><Input type="number" value={form.default_duration} onChange={(e) => set("default_duration", Number(e.target.value))} /></Field>
            </>
          )}

          {provider === "zoom" && (
            <>
              <Field label="Zoom account email"><Input value={form.account_email} onChange={(e) => set("account_email", e.target.value)} /></Field>
              <Field label="Client ID"><Input value={form.client_id} onChange={(e) => set("client_id", e.target.value)} /></Field>
              <Field label="Client Secret"><Input type="password" value={form.client_secret} onChange={(e) => set("client_secret", e.target.value)} /></Field>
              <Field label="Default meeting duration (minutes)"><Input type="number" value={form.default_duration} onChange={(e) => set("default_duration", Number(e.target.value))} /></Field>
              <Row label="Recording enabled"><Switch checked={!!form.recording_enabled} onCheckedChange={(v) => set("recording_enabled", v)} /></Row>
            </>
          )}

          {provider === "razorpay" && (
            <>
              <Field label="Mode">
                <Select value={form.mode} onValueChange={(v) => set("mode", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="test">Test</SelectItem>
                    <SelectItem value="live">Live</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Razorpay Key ID"><Input value={form.key_id} onChange={(e) => set("key_id", e.target.value)} /></Field>
              <Field label="Razorpay Key Secret"><Input type="password" value={form.key_secret} onChange={(e) => set("key_secret", e.target.value)} /></Field>
              <Field label="Webhook secret"><Input type="password" value={form.webhook_secret} onChange={(e) => set("webhook_secret", e.target.value)} /></Field>
              <Field label="Default currency"><Input value={form.currency} onChange={(e) => set("currency", e.target.value.toUpperCase())} /></Field>
              <Row label="GST enabled"><Switch checked={!!form.gst_enabled} onCheckedChange={(v) => set("gst_enabled", v)} /></Row>
            </>
          )}

          {provider === "google_oauth" && (
            <>
              <Field label="Google OAuth Client ID"><Input value={form.client_id} onChange={(e) => set("client_id", e.target.value)} /></Field>
              <Field label="Google OAuth Client Secret"><Input type="password" value={form.client_secret} onChange={(e) => set("client_secret", e.target.value)} /></Field>
              <CopyField label="Authorized redirect URL" value={`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/callback`} hint="Paste this into the Google Cloud Console > OAuth Client > Authorized redirect URIs." />
              <Field label="Allowed domains (comma separated, optional)"><Input value={form.allowed_domains} onChange={(e) => set("allowed_domains", e.target.value)} placeholder="example.com, acme.org" /></Field>
              <Row label="Auto-create profile"><Switch checked={!!form.auto_create_profile} onCheckedChange={(v) => set("auto_create_profile", v)} /></Row>
              <Field label="Default role for new Google users">
                <Select value={form.default_role} onValueChange={(v) => set("default_role", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student">Student</SelectItem>
                    <SelectItem value="instructor">Instructor</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <p className="text-xs text-muted-foreground bg-muted/40 rounded-md p-3">
                Note: Google OAuth provider credentials also need to be enabled in your backend authentication provider settings. Saving here stores your preferred client config and default role for new Google users.
              </p>
            </>
          )}

          {provider === "email_smtp" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="SMTP host"><Input value={form.host} onChange={(e) => set("host", e.target.value)} placeholder="smtp.example.com" /></Field>
                <Field label="SMTP port"><Input type="number" value={form.port} onChange={(e) => set("port", Number(e.target.value))} /></Field>
              </div>
              <Field label="Encryption">
                <Select value={form.encryption} onValueChange={(v) => set("encryption", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tls">TLS</SelectItem>
                    <SelectItem value="ssl">SSL</SelectItem>
                    <SelectItem value="none">None</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="SMTP username"><Input value={form.username} onChange={(e) => set("username", e.target.value)} /></Field>
                <Field label="SMTP password"><Input type="password" value={form.password} onChange={(e) => set("password", e.target.value)} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="From email"><Input value={form.from_email} onChange={(e) => set("from_email", e.target.value)} /></Field>
                <Field label="From name"><Input value={form.from_name} onChange={(e) => set("from_name", e.target.value)} /></Field>
              </div>
              <Field label="Reply-to email (optional)"><Input value={form.reply_to} onChange={(e) => set("reply_to", e.target.value)} /></Field>
              <Field label="Test recipient email"><Input value={form.test_to} onChange={(e) => set("test_to", e.target.value)} /></Field>
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          {provider === "email_smtp" && (
            <Button variant="outline" onClick={sendTest} disabled={testing || saving}>{testing ? "Sending…" : "Send test email"}</Button>
          )}
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={onSave} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border p-3">
      <div>
        <Label className="cursor-default">{label}</Label>
        {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function CopyField({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input readOnly value={value} className="font-mono text-xs" />
        <Button type="button" variant="outline" size="icon" onClick={() => {
          navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
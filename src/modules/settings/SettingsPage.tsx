import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useWorkspace } from "@/shared/hooks/useWorkspace";
import { settingsService } from "@/services/supabase";
import { toast } from "@/components/ui/use-toast";
import type { AppRole } from "@/types";

const ROLES: AppRole[] = ["organization_admin", "instructor", "student", "staff", "parent"];

export default function SettingsPage() {
  const { membership, hasAnyRole } = useWorkspace();
  const ws = membership!.workspace;
  const wsId = ws.id;
  const canAdmin = hasAnyRole(["organization_admin", "super_admin"]);
  const qc = useQueryClient();

  const { data: settings } = useQuery({ queryKey: ["ws-settings", wsId], queryFn: () => settingsService.getSettings(wsId) });
  const { data: members } = useQuery({ queryKey: ["ws-members", wsId], queryFn: () => settingsService.listMembers(wsId) });

  const [wsForm, setWsForm] = useState({ name: ws.name, slug: ws.slug, tagline: ws.tagline ?? "" });
  const [sForm, setSForm] = useState<any>({});

  useEffect(() => { setWsForm({ name: ws.name, slug: ws.slug, tagline: ws.tagline ?? "" }); }, [ws]);
  useEffect(() => { if (settings) setSForm(settings); }, [settings]);

  const saveWs = useMutation({
    mutationFn: () => settingsService.updateWorkspace(wsId, wsForm),
    onSuccess: () => { toast({ title: "Workspace saved" }); qc.invalidateQueries({ queryKey: ["memberships"] }); },
  });
  const saveSettings = useMutation({
    mutationFn: (patch: any) => settingsService.upsertSettings(wsId, patch),
    onSuccess: () => { toast({ title: "Settings saved" }); qc.invalidateQueries({ queryKey: ["ws-settings", wsId] }); },
  });
  const changeRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: AppRole }) => settingsService.updateMemberRole(id, role),
    onSuccess: () => { toast({ title: "Role updated" }); qc.invalidateQueries({ queryKey: ["ws-members", wsId] }); },
  });

  return (
    <div className="space-y-6 max-w-5xl">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your workspace, branding, members, and integrations.</p>
      </header>

      <Tabs defaultValue="workspace">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="workspace">Workspace</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="members">Members & Roles</TabsTrigger>
          <TabsTrigger value="learning">Learning</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
        </TabsList>

        <TabsContent value="workspace" className="mt-4">
          <Card className="p-6 space-y-4 border-border shadow-none">
            <div><Label>Name</Label><Input value={wsForm.name} onChange={(e) => setWsForm({ ...wsForm, name: e.target.value })} disabled={!canAdmin} /></div>
            <div><Label>Slug</Label><Input value={wsForm.slug} onChange={(e) => setWsForm({ ...wsForm, slug: e.target.value })} disabled={!canAdmin} /></div>
            <div><Label>Tagline</Label><Input value={wsForm.tagline ?? ""} onChange={(e) => setWsForm({ ...wsForm, tagline: e.target.value })} disabled={!canAdmin} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Contact email</Label><Input value={sForm.contact_email ?? ""} onChange={(e) => setSForm({ ...sForm, contact_email: e.target.value })} disabled={!canAdmin} /></div>
              <div><Label>Timezone</Label><Input value={sForm.timezone ?? ""} onChange={(e) => setSForm({ ...sForm, timezone: e.target.value })} disabled={!canAdmin} /></div>
            </div>
            {canAdmin && <div className="flex justify-end gap-2">
              <Button onClick={() => { saveWs.mutate(); saveSettings.mutate({ contact_email: sForm.contact_email, timezone: sForm.timezone }); }}>Save</Button>
            </div>}
          </Card>
        </TabsContent>

        <TabsContent value="branding" className="mt-4">
          <Card className="p-6 space-y-4 border-border shadow-none">
            <div><Label>Logo URL</Label><Input value={sForm.logo_url ?? ""} onChange={(e) => setSForm({ ...sForm, logo_url: e.target.value })} disabled={!canAdmin} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Primary color</Label><Input value={sForm.primary_color ?? ""} onChange={(e) => setSForm({ ...sForm, primary_color: e.target.value })} disabled={!canAdmin} /></div>
              <div><Label>Accent color</Label><Input value={sForm.accent_color ?? ""} onChange={(e) => setSForm({ ...sForm, accent_color: e.target.value })} disabled={!canAdmin} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Certificate signature name</Label><Input value={sForm.certificate_signature_name ?? ""} onChange={(e) => setSForm({ ...sForm, certificate_signature_name: e.target.value })} disabled={!canAdmin} /></div>
              <div><Label>Signature image URL</Label><Input value={sForm.certificate_signature_url ?? ""} onChange={(e) => setSForm({ ...sForm, certificate_signature_url: e.target.value })} disabled={!canAdmin} /></div>
            </div>
            {canAdmin && <div className="flex justify-end"><Button onClick={() => saveSettings.mutate(sForm)}>Save branding</Button></div>}
          </Card>
        </TabsContent>

        <TabsContent value="members" className="mt-4">
          <Card className="border-border shadow-none">
            <div className="p-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{members?.length ?? 0} members</p>
              {canAdmin && <Button variant="outline" disabled>Invite (coming soon)</Button>}
            </div>
            <Table>
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {(members ?? []).map((m: any) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.profiles?.full_name ?? m.profile_id.slice(0, 8)}</TableCell>
                    <TableCell>
                      {canAdmin ? (
                        <Select value={m.role} onValueChange={(v) => changeRole.mutate({ id: m.id, role: v as AppRole })}>
                          <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
                          <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r.replace("_", " ")}</SelectItem>)}</SelectContent>
                        </Select>
                      ) : <span className="capitalize">{m.role.replace("_", " ")}</span>}
                    </TableCell>
                    <TableCell><span className="capitalize">{m.status}</span></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="learning" className="mt-4">
          <Card className="p-6 space-y-4 border-border shadow-none">
            <div>
              <Label>Default course visibility</Label>
              <Select value={sForm.default_course_visibility ?? "private"} onValueChange={(v) => setSForm({ ...sForm, default_course_visibility: v })} disabled={!canAdmin}>
                <SelectTrigger className="w-60"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="private">Private</SelectItem><SelectItem value="public">Public</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <div><Label>Auto-issue certificates</Label><p className="text-xs text-muted-foreground">When students complete a course.</p></div>
              <Switch checked={!!sForm.auto_issue_certificates} onCheckedChange={(v) => setSForm({ ...sForm, auto_issue_certificates: v })} disabled={!canAdmin} />
            </div>
            <div><Label>Completion threshold (%)</Label><Input type="number" value={sForm.completion_threshold ?? 80} onChange={(e) => setSForm({ ...sForm, completion_threshold: Number(e.target.value) })} disabled={!canAdmin} className="w-40" /></div>
            {canAdmin && <div className="flex justify-end"><Button onClick={() => saveSettings.mutate(sForm)}>Save</Button></div>}
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="mt-4">
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { name: "Zoom", desc: "Live class hosting" },
              { name: "Google Meet", desc: "Live class hosting" },
              { name: "Jitsi", desc: "Open-source video" },
              { name: "Razorpay", desc: "Payments — India" },
              { name: "WhatsApp", desc: "Notification channel" },
            ].map((i) => (
              <Card key={i.name} className="p-5 border-border shadow-none flex items-center justify-between">
                <div><h4 className="font-semibold">{i.name}</h4><p className="text-xs text-muted-foreground">{i.desc}</p></div>
                <Button variant="outline" size="sm" disabled>Connect later</Button>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="billing" className="mt-4">
          <Card className="p-12 border-dashed bg-surface-muted text-center shadow-none">
            <h3 className="font-semibold">Payments coming soon</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              Subscription and payment processing aren't enabled yet. The data model is ready for Razorpay.
            </p>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
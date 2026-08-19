import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/shared/hooks/useWorkspace";
import PageHeader from "@/modules/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/use-toast";
import { loadOrCreateSettings } from "./attendanceService";

export default function AttendanceSettingsPage() {
  const { membership } = useWorkspace();
  const wsId = membership!.workspace.id;
  const { data } = useQuery({ queryKey: ["att-settings", wsId], queryFn: () => loadOrCreateSettings(wsId) });

  const [form, setForm] = useState({
    minimum_attendance_percentage: 75,
    attendance_lock_hours: 24,
    late_after_minutes: 10,
    auto_attendance_enabled: false,
    qr_enabled: false,
    otp_enabled: false,
    geo_enabled: false,
  });

  useEffect(() => {
    if (data) setForm((f) => ({ ...f, ...data }));
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = {
          minimum_attendance_percentage: Number(form.minimum_attendance_percentage) || 75,
          attendance_lock_hours: Number(form.attendance_lock_hours) || 24,
          late_after_minutes: Number(form.late_after_minutes) || 10,
          auto_attendance_enabled: form.auto_attendance_enabled,
          qr_enabled: form.qr_enabled,
          otp_enabled: form.otp_enabled,
          geo_enabled: form.geo_enabled,
      };
      const { error } = await (supabase.from("attendance_settings") as any)
        .update(payload)
        .eq("workspace_id", wsId);
      if (error) throw error;
    },
    onSuccess: () => toast({ title: "Settings saved" }),
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader title="Attendance settings" description="Configure workspace-wide attendance policies and self check-in methods."
        actions={<Button onClick={() => save.mutate()} disabled={save.isPending}><Save className="h-4 w-4 mr-1.5" />Save changes</Button>} />

      <Card className="p-5 border-border shadow-none space-y-4">
        <div className="font-semibold">Policies</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label>Minimum attendance %</Label>
            <Input type="number" min={0} max={100} value={form.minimum_attendance_percentage}
              onChange={(e) => setForm({ ...form, minimum_attendance_percentage: Number(e.target.value) })} />
            <p className="text-[11px] text-muted-foreground">Threshold used for reports and certificate rules.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Lock after (hours)</Label>
            <Input type="number" min={1} value={form.attendance_lock_hours}
              onChange={(e) => setForm({ ...form, attendance_lock_hours: Number(e.target.value) })} />
            <p className="text-[11px] text-muted-foreground">Instructor edit window after submission.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Late after (minutes)</Label>
            <Input type="number" min={0} value={form.late_after_minutes}
              onChange={(e) => setForm({ ...form, late_after_minutes: Number(e.target.value) })} />
          </div>
        </div>
      </Card>

      <Card className="p-5 border-border shadow-none space-y-4">
        <div className="font-semibold">Automation & self check-in</div>
        {[
          ["auto_attendance_enabled", "Auto attendance for live classes", "Mark attendance based on join duration."],
          ["qr_enabled", "QR code check-in", "Students scan a QR to check themselves in."],
          ["otp_enabled", "OTP check-in", "One-time code shared in class."],
          ["geo_enabled", "Geo-fenced check-in", "Only allow check-ins from campus location."],
        ].map(([k, label, hint]) => (
          <div key={k as string} className="flex items-start justify-between gap-4 border border-border rounded-lg p-3">
            <div>
              <div className="text-sm font-medium">{label}</div>
              <div className="text-xs text-muted-foreground">{hint}</div>
            </div>
            <Switch checked={(form as any)[k as string]} onCheckedChange={(v) => setForm({ ...form, [k as string]: v })} />
          </div>
        ))}
      </Card>
    </div>
  );
}
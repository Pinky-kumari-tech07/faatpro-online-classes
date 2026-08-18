import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { REVENUE_TYPE_LABELS, type RevenueType, type SettlementFrequency } from "@/services/supabase/revenueService";
import { Wallet } from "lucide-react";

const FREQ: { v: SettlementFrequency; label: string }[] = [
  { v: "instant", label: "Instant" },
  { v: "weekly", label: "Weekly" },
  { v: "monthly", label: "Monthly" },
  { v: "quarterly", label: "Quarterly" },
  { v: "manual", label: "Manual" },
  { v: "one_time", label: "One-time" },
];

export default function RevenueModelSection({
  value, onChange, currency = "INR",
}: {
  value: any;
  onChange: (patch: any) => void;
  currency?: string;
}) {
  const model: RevenueType = value?.revenue_model ?? "revenue_share";
  const set = (patch: any) => onChange(patch);

  return (
    <Card className="p-5 space-y-4 border-border">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <Wallet className="h-4 w-4" />
        </div>
        <div>
          <h3 className="font-semibold">Revenue model</h3>
          <p className="text-xs text-muted-foreground">Sets how the instructor is paid for enrolments in this course.</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Revenue type</Label>
          <Select value={model} onValueChange={(v) => {
            const patch: any = { revenue_model: v as RevenueType };
            if (v === "revenue_share") { patch.revenue_platform_pct = 50; patch.revenue_instructor_pct = 50; }
            onChange(patch);
          }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(REVENUE_TYPE_LABELS).map(([k, l]) => (
                <SelectItem key={k} value={k}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Settlement frequency</Label>
          <Select value={value?.settlement_frequency ?? "monthly"}
            onValueChange={(v) => set({ settlement_frequency: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {FREQ.map((f) => <SelectItem key={f.v} value={f.v}>{f.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {(model === "revenue_share" || model === "custom_share") && (
          <>
            <div className="space-y-1.5">
              <Label>Platform %</Label>
              <Input type="number" min={0} max={100} value={value?.revenue_platform_pct ?? 50}
                onChange={(e) => {
                  const p = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                  set({ revenue_platform_pct: p, revenue_instructor_pct: Number((100 - p).toFixed(2)) });
                }} />
            </div>
            <div className="space-y-1.5">
              <Label>Instructor %</Label>
              <Input type="number" min={0} max={100} value={value?.revenue_instructor_pct ?? 50}
                onChange={(e) => {
                  const p = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                  set({ revenue_instructor_pct: p, revenue_platform_pct: Number((100 - p).toFixed(2)) });
                }} />
            </div>
          </>
        )}

        {model === "instructor_fixed" && (
          <div className="space-y-1.5">
            <Label>Instructor fixed amount ({currency})</Label>
            <Input type="number" min={0} value={value?.revenue_fixed_amount ?? ""}
              onChange={(e) => set({ revenue_fixed_amount: Number(e.target.value) || 0 })} />
            <p className="text-xs text-muted-foreground">Paid per successful enrolment, capped by course net revenue.</p>
          </div>
        )}

        {model === "per_student_fixed" && (
          <div className="space-y-1.5">
            <Label>Per student amount ({currency})</Label>
            <Input type="number" min={0} value={value?.revenue_per_student_amount ?? ""}
              onChange={(e) => set({ revenue_per_student_amount: Number(e.target.value) || 0 })} />
          </div>
        )}

        {model === "one_time_contract" && (
          <div className="space-y-1.5 md:col-span-2">
            <Label>One-time contract amount ({currency})</Label>
            <Input type="number" min={0} value={value?.revenue_one_time_amount ?? ""}
              onChange={(e) => set({ revenue_one_time_amount: Number(e.target.value) || 0 })} />
            <p className="text-xs text-muted-foreground">
              Instructor is paid this lump sum once. Every enrolment after payment generates ₹0 (still logged).
            </p>
          </div>
        )}

        <div className="space-y-1.5">
          <Label>Minimum settlement ({currency})</Label>
          <Input type="number" min={0} value={value?.revenue_min_settlement ?? 0}
            onChange={(e) => set({ revenue_min_settlement: Number(e.target.value) || 0 })} />
        </div>
        <div className="space-y-1.5">
          <Label>Maximum settlement ({currency}) — optional</Label>
          <Input type="number" min={0} value={value?.revenue_max_settlement ?? ""}
            onChange={(e) => set({ revenue_max_settlement: e.target.value ? Number(e.target.value) : null })} />
        </div>
      </div>
    </Card>
  );
}
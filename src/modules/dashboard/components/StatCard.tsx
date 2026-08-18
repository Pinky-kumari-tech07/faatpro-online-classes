import { Card } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";

export default function StatCard({
  label, value, icon: Icon, hint,
}: { label: string; value: string | number; icon: LucideIcon; hint?: string }) {
  return (
    <Card className="p-5 border-border shadow-none hover:shadow-soft transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</div>
          <div className="text-3xl font-bold mt-2">{value}</div>
          {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
        </div>
        <div className="h-10 w-10 rounded-xl bg-primary-soft text-primary grid place-items-center">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}
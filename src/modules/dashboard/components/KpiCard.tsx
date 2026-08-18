import { Card } from "@/components/ui/card";
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export default function KpiCard({
  label, value, icon: Icon, hint, trend, to, accent = "primary",
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  hint?: string;
  trend?: { value: number; label?: string; direction?: "up" | "down" };
  to?: string;
  accent?: "primary" | "accent" | "success" | "warning";
}) {
  const accentBg = {
    primary: "bg-primary-soft text-primary",
    accent: "bg-accent/10 text-accent",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
  }[accent];

  return (
    <Card className="p-5 border-border shadow-none hover:shadow-soft transition-shadow flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</div>
          <div className="text-3xl font-bold mt-2 truncate">{value}</div>
        </div>
        <div className={cn("h-10 w-10 rounded-xl grid place-items-center flex-shrink-0", accentBg)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 min-w-0">
          {trend && (
            <span className={cn(
              "inline-flex items-center gap-0.5 font-medium",
              trend.direction === "down" ? "text-destructive" : "text-success"
            )}>
              {trend.direction === "down" ? <ArrowDownRight className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
              {trend.value}
            </span>
          )}
          {hint && <span className="text-muted-foreground truncate">{hint}</span>}
        </div>
        {to && (
          <Link to={to} className="text-primary font-medium hover:underline whitespace-nowrap">
            View →
          </Link>
        )}
      </div>
    </Card>
  );
}
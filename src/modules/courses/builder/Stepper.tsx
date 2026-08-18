import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type StepKey = "basics" | "curriculum" | "additional";

const STEPS: { key: StepKey; label: string; idx: number }[] = [
  { key: "basics", label: "Basics", idx: 1 },
  { key: "curriculum", label: "Curriculum", idx: 2 },
  { key: "additional", label: "Additional", idx: 3 },
];

export default function Stepper({
  current,
  onChange,
}: {
  current: StepKey;
  onChange: (s: StepKey) => void;
}) {
  const currentIdx = STEPS.find((s) => s.key === current)?.idx ?? 1;
  return (
    <div className="flex items-center gap-2 sm:gap-4">
      {STEPS.map((s, i) => {
        const isDone = s.idx < currentIdx;
        const isActive = s.key === current;
        return (
          <div key={s.key} className="flex items-center gap-2 sm:gap-4">
            <button
              type="button"
              onClick={() => onChange(s.key)}
              className={cn(
                "flex items-center gap-2 rounded-full pl-1 pr-3 py-1 text-sm transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : isDone
                    ? "text-foreground hover:bg-muted"
                    : "text-muted-foreground hover:bg-muted",
              )}
            >
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold",
                  isActive
                    ? "bg-primary-foreground text-primary border-primary-foreground"
                    : isDone
                      ? "bg-success/20 text-success border-success/40"
                      : "border-border",
                )}
              >
                {isDone ? <Check className="h-3 w-3" /> : s.idx}
              </span>
              <span className="font-medium">{s.label}</span>
            </button>
            {i < STEPS.length - 1 && <div className="h-px w-6 sm:w-12 bg-border" />}
          </div>
        );
      })}
    </div>
  );
}
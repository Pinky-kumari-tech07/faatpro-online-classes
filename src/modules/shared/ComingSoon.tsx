import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Sparkles, CheckCircle2, type LucideIcon } from "lucide-react";

export interface ComingSoonProps {
  title: string;
  description: string;
  icon: LucideIcon;
  features: string[];
  progress?: number;
  eta?: string;
  ctaLabel?: string;
  onCta?: () => void;
}

export default function ComingSoon({
  title,
  description,
  icon: Icon,
  features,
  progress = 35,
  eta = "Next release",
  ctaLabel = "Notify me when ready",
  onCta,
}: ComingSoonProps) {
  return (
    <div className="max-w-5xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        <Card className="relative overflow-hidden border-border/70 shadow-sm">
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.06] pointer-events-none"
            style={{ background: "var(--gradient-brand)" }}
          />
          <div
            aria-hidden
            className="absolute -top-24 -right-24 h-72 w-72 rounded-full blur-3xl opacity-30"
            style={{ background: "var(--gradient-brand)" }}
          />

          <div className="relative p-8 md:p-12 grid md:grid-cols-[1.4fr_1fr] gap-10 items-center">
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="rounded-full font-medium">
                  <Sparkles className="h-3 w-3 mr-1" /> In development
                </Badge>
                <Badge variant="outline" className="rounded-full text-muted-foreground">
                  ETA · {eta}
                </Badge>
              </div>

              <div className="space-y-3">
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{title}</h1>
                <p className="text-muted-foreground text-base md:text-lg leading-relaxed max-w-xl">
                  {description}
                </p>
              </div>

              <div className="space-y-2 max-w-sm">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Build progress</span>
                  <span className="font-medium text-foreground">{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>

              <div className="flex flex-wrap gap-3">
                <Button onClick={onCta} className="rounded-xl">
                  {ctaLabel} <ArrowRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" className="rounded-xl">
                  View roadmap
                </Button>
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15, duration: 0.5, ease: "easeOut" }}
              className="relative"
            >
              <div className="relative mx-auto h-56 w-56 md:h-64 md:w-64">
                <div
                  className="absolute inset-0 rounded-3xl"
                  style={{ background: "var(--gradient-brand)", opacity: 0.12 }}
                />
                <div className="absolute inset-4 rounded-3xl bg-card border border-border/60 shadow-lg grid place-items-center">
                  <Icon className="h-20 w-20 text-primary" strokeWidth={1.4} />
                </div>
                <motion.div
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute -top-3 -right-3 h-12 w-12 rounded-2xl bg-card border border-border/60 shadow-md grid place-items-center"
                >
                  <Sparkles className="h-5 w-5 text-accent" />
                </motion.div>
              </div>
            </motion.div>
          </div>
        </Card>

        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {features.map((f, i) => (
            <motion.div
              key={f}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i + 0.2, duration: 0.3 }}
            >
              <Card className="p-4 flex items-start gap-3 border-border/70 shadow-none hover:shadow-sm transition-shadow">
                <div className="h-9 w-9 rounded-xl bg-primary-soft text-primary grid place-items-center shrink-0">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div className="text-sm leading-relaxed pt-1">{f}</div>
              </Card>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
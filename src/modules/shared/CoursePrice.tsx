import { Badge } from "@/components/ui/badge";
import { coursePricingService } from "@/services/supabase/coursePricingService";
import { cn } from "@/lib/utils";

export default function CoursePrice({ course, size = "md", className }: { course: any; size?: "sm" | "md" | "lg"; className?: string }) {
  if (!course) return null;
  const isFree = course.pricing_type === "free" || Number(course.price_amount ?? 0) === 0;
  if (isFree) {
    return <span className={cn("inline-flex items-center font-semibold text-success", size === "lg" ? "text-2xl" : "text-sm", className)}>Free</span>;
  }
  const active = coursePricingService.isDiscountActive(course);
  const base = Number(course.price_amount ?? 0);
  const final = coursePricingService.priceAfterDiscount(course);
  const currency = course.currency ?? "INR";
  const badge = coursePricingService.discountBadge(course);

  const finalCls = size === "lg" ? "text-3xl font-bold" : size === "sm" ? "text-sm font-semibold" : "text-base font-semibold";
  const baseCls = size === "lg" ? "text-base" : "text-xs";

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <span className={finalCls}>{coursePricingService.formatPrice(final, currency)}</span>
      {active && final < base && (
        <>
          <span className={cn("text-muted-foreground line-through", baseCls)}>{coursePricingService.formatPrice(base, currency)}</span>
          {badge && <Badge variant="secondary" className="bg-success/15 text-success border-success/20">{badge}</Badge>}
        </>
      )}
    </div>
  );
}
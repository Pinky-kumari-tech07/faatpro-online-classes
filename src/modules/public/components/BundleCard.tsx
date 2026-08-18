import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PackageOpen, BookOpen, Layers, ArrowRight } from "lucide-react";

function fmt(amount: number, currency = "INR") {
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `₹${amount}`;
  }
}

export default function BundleCard({ bundle }: { bundle: any }) {
  const courseCount = Array.isArray(bundle.bundle_courses)
    ? (bundle.bundle_courses[0]?.count ?? bundle.bundle_courses.length ?? 0)
    : (bundle.course_count ?? 0);
  const regular = Number(bundle.regular_price ?? 0);
  const sale = bundle.sale_price != null ? Number(bundle.sale_price) : null;
  const finalPrice = sale != null && sale < regular ? sale : regular;
  const savings = sale != null && sale < regular && regular > 0
    ? Math.round(((regular - sale) / regular) * 100)
    : null;
  const currency = bundle.currency ?? "INR";

  return (
    <Link to={`/bundles/${bundle.slug}`} className="group block h-full">
      <Card className="overflow-hidden h-full flex flex-col border-2 border-primary/30 hover:border-primary transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-xl relative">
        <div className="aspect-video bg-gradient-to-br from-primary/20 via-primary/10 to-accent/20 relative overflow-hidden">
          {bundle.thumbnail_url ? (
            <img src={bundle.thumbnail_url} alt={bundle.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-primary">
              <Layers className="h-12 w-12" />
            </div>
          )}
          <Badge className="absolute top-3 left-3 bg-primary text-primary-foreground border-transparent shadow-sm">
            <PackageOpen className="h-3 w-3 mr-1" /> Bundle
          </Badge>
          {savings !== null && (
            <Badge className="absolute top-3 right-3 bg-destructive text-destructive-foreground border-transparent shadow-sm">
              Save {savings}%
            </Badge>
          )}
        </div>
        <div className="p-4 flex-1 flex flex-col">
          <h3 className="font-semibold leading-snug line-clamp-2 group-hover:text-primary">{bundle.name}</h3>
          {bundle.short_description && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{bundle.short_description}</p>
          )}
          <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" /> Includes {courseCount} {courseCount === 1 ? "course" : "courses"}</span>
          </div>
          <div className="mt-auto pt-4 flex items-end justify-between">
            <div>
              <div className="text-lg font-bold">{fmt(finalPrice, currency)}</div>
              {sale != null && sale < regular && (
                <div className="text-xs text-muted-foreground line-through">{fmt(regular, currency)}</div>
              )}
            </div>
            <div className="inline-flex items-center gap-1 text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
              View bundle <ArrowRight className="h-3.5 w-3.5" />
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}
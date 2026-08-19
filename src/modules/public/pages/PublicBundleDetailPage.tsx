import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, Clock, GraduationCap, Layers, ListChecks, PackageOpen, ShoppingCart, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { publicCourseService } from "../services/publicCourseService";
import { useAuth } from "@/shared/hooks/useAuth";
import { savePostLoginRedirect } from "@/lib/authRedirect";

function fmt(amount: number, currency = "INR") {
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `₹${amount}`;
  }
}

function durationLabel(mins: number) {
  if (!mins) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

export default function PublicBundleDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["public-bundle", slug],
    queryFn: () => publicCourseService.getBundleBySlug(slug!),
    enabled: !!slug,
  });

  if (isLoading) {
    return <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 text-muted-foreground">Loading bundle…</div>;
  }
  if (!data) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="text-center text-muted-foreground">Bundle not found.</div>
        <div className="text-center mt-4"><Button asChild variant="outline"><Link to="/courses">Browse catalog</Link></Button></div>
      </div>
    );
  }

  const { bundle, courses, stats } = data;
  const regular = Number(bundle.regular_price ?? 0);
  const sale = bundle.sale_price != null ? Number(bundle.sale_price) : null;
  const finalPrice = sale != null && sale < regular ? sale : regular;
  const savings = sale != null && sale < regular && regular > 0
    ? Math.round(((regular - sale) / regular) * 100)
    : null;
  const courseTotalRetail = courses.reduce((s: number, c: any) => s + Number(c?.courses?.price_amount ?? 0), 0);
  const valueSavings = courseTotalRetail > finalPrice ? courseTotalRetail - finalPrice : 0;

  const handleEnroll = () => {
    // Guest-friendly: paid bundles go through the shared Cart → Checkout flow
    // so the item persists across sign-in like Udemy's cart.
    if (!user) {
      const nextPath = `/bundles/${bundle.slug}`;
      savePostLoginRedirect(nextPath);
      navigate(`/auth/login?next=${encodeURIComponent(nextPath)}`);
      return;
    }
    navigate(`/checkout?bundle=${bundle.id}`);
  };

  return (
    <div className="bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <Button asChild variant="ghost" size="sm" className="mb-4">
          <Link to="/courses"><ArrowLeft className="h-4 w-4 mr-2" /> Back to catalog</Link>
        </Button>

        <div className="grid lg:grid-cols-[1fr,360px] gap-8">
          <div>
            <Badge className="bg-primary text-primary-foreground border-transparent mb-3">
              <PackageOpen className="h-3.5 w-3.5 mr-1" /> Course Bundle
            </Badge>
            <h1 className="text-3xl sm:text-4xl font-bold leading-tight">{bundle.name}</h1>
            {bundle.short_description && (
              <p className="text-muted-foreground mt-3 text-lg">{bundle.short_description}</p>
            )}

            <div className="mt-6 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-background border"><Layers className="h-3.5 w-3.5" /> {courses.length} courses</span>
              <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-background border"><BookOpen className="h-3.5 w-3.5" /> {stats.lessons} lessons</span>
              <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-background border"><ListChecks className="h-3.5 w-3.5" /> {stats.quizzes} quizzes</span>
              <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-background border"><GraduationCap className="h-3.5 w-3.5" /> {stats.assignments} assignments</span>
              <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-background border"><Clock className="h-3.5 w-3.5" /> {durationLabel(stats.durationMinutes)} total</span>
            </div>

            {bundle.description && (
              <Card className="mt-6 p-5">
                <div className="font-semibold mb-2">About this bundle</div>
                <div className="prose prose-sm max-w-none text-muted-foreground" dangerouslySetInnerHTML={{ __html: bundle.description }} />
              </Card>
            )}

            <div className="mt-8">
              <h2 className="text-xl font-semibold mb-4">Included courses ({courses.length})</h2>
              <div className="space-y-3">
                {courses.map((row: any) => {
                  const c = row.courses;
                  if (!c) return null;
                  return (
                    <Link key={row.course_id} to={`/courses/${c.slug}`} className="block">
                      <Card className="p-4 flex gap-4 hover:border-primary transition-colors">
                        <div className="w-32 aspect-video rounded-md bg-muted overflow-hidden shrink-0">
                          {c.thumbnail_url ? (
                            <img src={c.thumbnail_url} alt={c.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full grid place-items-center"><BookOpen className="h-6 w-6 text-muted-foreground" /></div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold line-clamp-1">{c.title}</div>
                          {c.summary && <div className="text-sm text-muted-foreground line-clamp-2 mt-1">{c.summary}</div>}
                          <div className="text-xs text-muted-foreground mt-2 flex items-center gap-2">
                            <Users className="h-3.5 w-3.5" />
                            {c.profiles?.full_name ?? "Instructor"}
                          </div>
                        </div>
                        {c.price_amount != null && (
                          <div className="text-sm text-muted-foreground self-center shrink-0">
                            {fmt(Number(c.price_amount), c.currency ?? "INR")}
                          </div>
                        )}
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>

          <Card className="p-0 overflow-hidden h-fit lg:sticky lg:top-20">
            <div className="aspect-video bg-gradient-to-br from-primary/20 to-accent/20 overflow-hidden">
              {bundle.thumbnail_url ? (
                <img src={bundle.thumbnail_url} alt={bundle.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full grid place-items-center"><Layers className="h-12 w-12 text-primary" /></div>
              )}
            </div>
            <div className="p-5 space-y-4">
              <div>
                <div className="flex items-end gap-2">
                  <span className="text-3xl font-bold">{fmt(finalPrice, bundle.currency ?? "INR")}</span>
                  {sale != null && sale < regular && (
                    <span className="text-base text-muted-foreground line-through">{fmt(regular, bundle.currency ?? "INR")}</span>
                  )}
                </div>
                {savings !== null && (
                  <Badge className="mt-2 bg-success/15 text-success border-success/30">Save {savings}% on bundle</Badge>
                )}
                {valueSavings > 0 && (
                  <div className="text-xs text-muted-foreground mt-2">
                    Total course value {fmt(courseTotalRetail, bundle.currency ?? "INR")} — you save {fmt(valueSavings, bundle.currency ?? "INR")}.
                  </div>
                )}
              </div>
              <Button size="lg" className="w-full" onClick={handleEnroll}>
                <ShoppingCart className="h-4 w-4 mr-2" /> Enroll in bundle
              </Button>
              <ul className="text-sm text-muted-foreground space-y-1.5">
                <li className="flex items-center gap-2"><BookOpen className="h-4 w-4" /> {courses.length} full courses</li>
                <li className="flex items-center gap-2"><Clock className="h-4 w-4" /> {durationLabel(stats.durationMinutes)} of content</li>
                <li className="flex items-center gap-2"><GraduationCap className="h-4 w-4" /> Certificate on completion</li>
              </ul>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
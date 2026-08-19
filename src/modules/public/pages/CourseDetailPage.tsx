import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, Clock, PlayCircle, Award, CheckCircle2, FileText, Video, Timer, GraduationCap, ListChecks, Users, Globe, BarChart3, CalendarDays, Download, Star, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { publicCourseService } from "../services/publicCourseService";
import { useAuth } from "@/shared/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { coursePricingService, couponService, enrollmentService } from "@/services/supabase/coursePricingService";
import CoursePrice from "@/modules/shared/CoursePrice";
import { toast } from "@/components/ui/use-toast";
import { useCoursesRealtime } from "@/shared/hooks/useCoursesRealtime";
import { Link as RLink } from "react-router-dom";
import { PackageOpen, Share2, Facebook, Linkedin, Twitter, ChevronRight, ShieldCheck, RefreshCw, Smartphone, Infinity as InfinityIcon, Link2 } from "lucide-react";
import { sanitizeRichHtml } from "@/lib/sanitizeHtml";
import { Helmet } from "react-helmet-async";
import { useCart } from "@/modules/commerce/useCart";
import { savePostLoginRedirect } from "@/lib/authRedirect";

const typeIcon = (t: string) => t === "video" ? Video : t === "pdf" ? FileText : PlayCircle;

function looksLikeHtml(s?: string | null) {
  if (!s) return false;
  return /<\/?[a-z][\s\S]*>/i.test(s);
}

function formatLevel(course: any): string | null {
  const v = course?.level ?? course?.difficulty;
  if (!v) return null;
  const map: Record<string, string> = {
    all_levels: "All levels", beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced",
  };
  return map[v] ?? String(v).replace(/_/g, " ");
}

function formatLanguages(course: any): string | null {
  if (Array.isArray(course?.languages) && course.languages.length) return course.languages.join(", ");
  if (course?.language) return course.language;
  return null;
}

function formatDuration(mins: number): string {
  if (!mins || mins <= 0) return "";
  const h = Math.floor(mins / 60); const m = mins % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

function formatAccessDuration(course: any): string {
  const type = course?.access_duration_type;
  if (!type || type === "lifetime") return "Full lifetime access";
  if (type === "custom" && course?.enrollment_end_at) {
    return `Access until ${new Date(course.enrollment_end_at).toLocaleDateString()}`;
  }
  const days = Number(course?.access_duration);
  if (Number.isFinite(days) && days > 0) {
    if (days % 365 === 0) return `${days / 365} year${days === 365 ? "" : "s"} access`;
    if (days % 30 === 0) return `${days / 30} month${days === 30 ? "" : "s"} access`;
    return `${days} day${days === 1 ? "" : "s"} access`;
  }
  return "Full lifetime access";
}

function useCountdown(endsAt: string | null | undefined) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!endsAt) return;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [endsAt]);
  return useMemo(() => {
    if (!endsAt) return null;
    const diff = new Date(endsAt).getTime() - Date.now();
    if (diff <= 0) return { expired: true, days: 0, hours: 0, minutes: 0, seconds: 0 };
    const days = Math.floor(diff / (24 * 3600 * 1000));
    const hours = Math.floor((diff % (24 * 3600 * 1000)) / (3600 * 1000));
    const minutes = Math.floor((diff % (3600 * 1000)) / (60 * 1000));
    const seconds = Math.floor((diff % (60 * 1000)) / 1000);
    return { expired: false, days, hours, minutes, seconds };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endsAt, /* re-eval each tick */ Math.floor(Date.now() / 1000)]);
}

export default function PublicCourseDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [couponCode, setCouponCode] = useState("");
  const [coupon, setCoupon] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const cart = useCart();

  // Live updates: any admin/instructor edit to course / curriculum / quizzes
  // / assignments will refresh this view instantly.
  useCoursesRealtime([["public-course", slug ?? ""], ["public-courses"], ["public-featured-courses"]]);

  const { data, isLoading } = useQuery({
    queryKey: ["public-course", slug],
    queryFn: () => publicCourseService.getCourseBySlug(slug!),
    enabled: !!slug,
    staleTime: 30_000,
  });

  const { data: enrollment } = useQuery({
    queryKey: ["public-enrollment", user?.id, data?.course.id],
    enabled: !!user && !!data?.course.id,
    queryFn: async () => {
      const { data: e } = await supabase
        .from("enrollments")
        .select("id, status, access_expires_at")
        .eq("student_id", user!.id)
        .eq("course_id", data!.course.id)
        .maybeSingle();
      if (!e) return null;
      const expired = e.status === "expired" || (e.access_expires_at && new Date(e.access_expires_at as string).getTime() < Date.now());
      return expired ? null : e;
    },
  });

  const course: any = (data as any)?.course;
  const countdown = useCountdown(course?.discount_ends_at);

  // Auto-enroll after login: if a guest clicked "Enroll for free" and was
  // sent through auth, we return to /courses/:slug?enroll=1 and complete
  // the free enrollment in one shot.
  useEffect(() => {
    if (!user || !course) return;
    const wantsEnroll = new URLSearchParams(window.location.search).get("enroll") === "1";
    const isFreeNow = course.pricing_type === "free" || Number(course.price_amount ?? 0) === 0;
    if (!isFreeNow || !wantsEnroll) return;
    if (enrollment) {
      navigate(`/learn/${course.id}`, { replace: true });
      return;
    }
    (async () => {
      try {
        await enrollmentService.enrollFreeCourse({ workspaceId: course.workspace_id, studentId: user.id, courseId: course.id });
        toast({ title: "Enrolled!" });
        navigate(`/learn/${course.id}`, { replace: true });
      } catch (e: any) {
        toast({ title: "Couldn't auto-enroll", description: e.message, variant: "destructive" });
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, course?.id, enrollment?.id]);

  useEffect(() => {
    if (!user || !course || enrollment) return;
    const wantsCheckout = new URLSearchParams(window.location.search).get("checkout") === "1";
    const isFreeNow = course.pricing_type === "free" || Number(course.price_amount ?? 0) === 0;
    if (!wantsCheckout || isFreeNow) return;
    if (!cart.has("course", course.id)) {
      cart.add({
        productType: "course",
        productId: course.id,
        slug: course.slug,
        title: course.title,
        thumbnail: course?.thumbnail_url || course?.og_image_url,
        price: coursePricingService.getPriceBreakdown(course, coupon).total,
        originalPrice: Number(course.price_amount ?? 0),
        currency: coursePricingService.getPriceBreakdown(course, coupon).currency,
        workspaceId: course.workspace_id,
      });
    }
    navigate("/cart", { replace: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, course?.id, enrollment?.id]);

  const { data: relatedBundles = [] } = useQuery({
    queryKey: ["course-bundles-upsell", course?.id],
    queryFn: () => publicCourseService.listBundlesContainingCourse(course!.id),
    enabled: !!course?.id,
  });

  if (isLoading) return <div className="max-w-5xl mx-auto px-4 py-16 text-muted-foreground">Loading course…</div>;
  if (!data) return (
    <div className="max-w-3xl mx-auto px-4 py-20 text-center">
      <h1 className="text-2xl font-bold">Course not found</h1>
      <Button asChild className="mt-6"><Link to="/courses"><ArrowLeft className="h-4 w-4" />Back to catalog</Link></Button>
    </div>
  );

  const { sections, lessons, stats } = data as any;
  const previewLessons = lessons.filter((l: any) => l.is_preview);
  const totalMinutes = course?.total_duration_minutes && course.total_duration_minutes > 0
    ? course.total_duration_minutes
    : (stats?.durationMinutes ?? Math.round(lessons.reduce((s: number, l: any) => s + (l.duration_seconds ?? 0), 0) / 60));
  const isFree = course.pricing_type === "free" || Number(course.price_amount ?? 0) === 0;
  const breakdown = coursePricingService.getPriceBreakdown(course, coupon);
  const saleActive = coursePricingService.isDiscountActive(course);
  const accessLabel = formatAccessDuration(course);
  const discountPct = coursePricingService.discountBadge(course);
  const levelLabel = formatLevel(course);
  const langLabel = formatLanguages(course);
  const updatedLabel = course?.updated_at ? new Date(course.updated_at).toLocaleDateString(undefined, { month: "short", year: "numeric" }) : null;
  const learn = Array.isArray(course?.learning_outcomes) ? course.learning_outcomes.filter(Boolean) : [];
  const reqs = Array.isArray(course?.requirements) ? course.requirements.filter(Boolean) : [];
  const audience = Array.isArray(course?.target_audience) ? course.target_audience.filter(Boolean) : [];
  const materials = Array.isArray(course?.materials_included) ? course.materials_included.filter(Boolean) : [];
  const thumb = course?.thumbnail_url || course?.og_image_url;
  const descHtml = course?.description ?? "";
  const renderHtml = looksLikeHtml(descHtml);
  const safeHtml = renderHtml ? sanitizeRichHtml(descHtml) : "";
  const shareUrl = typeof window !== "undefined" ? window.location.href : `https://faatpro.com/courses/${course?.slug ?? ""}`;
  const shareText = encodeURIComponent(course?.title ?? "");
  const encUrl = encodeURIComponent(shareUrl);
  const copyShareLink = async () => {
    try { await navigator.clipboard.writeText(shareUrl); toast({ title: "Link copied" }); } catch {}
  };

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    try {
      const res = await couponService.validateCoupon(couponCode.trim(), course.id, course.workspace_id, { productType: "course", product: course });
      if (!res.valid) { toast({ title: res.reason ?? "Invalid coupon", description: `Code: ${couponCode.trim().toUpperCase()}`, variant: "destructive" }); setCoupon(null); return; }
      setCoupon(res.coupon);
      toast({ title: "Coupon applied" });
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  };

  const handleEnroll = async () => {
    if (!user) {
      // Free enrollment requires an account — preserve destination and
      // add an intent so we auto-enroll/checkout after login.
      const nextPath = `${window.location.pathname}${isFree ? "?enroll=1" : "?checkout=1"}`;
      savePostLoginRedirect(nextPath);
      if (!isFree && !cart.has("course", course.id)) {
        cart.add({
          productType: "course",
          productId: course.id,
          slug: course.slug,
          title: course.title,
          thumbnail: thumb,
          price: breakdown.total,
          originalPrice: Number(course.price_amount ?? 0),
          currency: breakdown.currency,
          workspaceId: course.workspace_id,
        });
      }
      navigate(`/auth/login?next=${encodeURIComponent(nextPath)}`);
      return;
    }
    if (user && enrollment) { navigate(`/learn/${data!.course.id}`); return; }
    setBusy(true);
    try {
      // Always enroll under the course owner's workspace so the instructor
      // sees this student in their roster (not the student's own workspace).
      const wsId = course.workspace_id;
      if (isFree && user) {
        await enrollmentService.enrollFreeCourse({ workspaceId: wsId, studentId: user.id, courseId: course.id });
        toast({ title: "Enrolled!" });
        navigate(`/learn/${course.id}`);
      } else {
        // Paid course → always go through the existing Cart → Checkout flow.
        // Guests can build a cart and are prompted to sign in at checkout.
        if (!cart.has("course", course.id)) {
          cart.add({
            productType: "course",
            productId: course.id,
            slug: course.slug,
            title: course.title,
            thumbnail: thumb,
            price: breakdown.total,
            originalPrice: Number(course.price_amount ?? 0),
            currency: breakdown.currency,
            workspaceId: course.workspace_id,
          });
        }
        navigate("/cart");
      }
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
    finally { setBusy(false); }
  };

  // Single CTA: enrolled users continue learning, everyone else enrolls
  // (handleEnroll routes guests through auth and paid courses to checkout).
  const ctaLabel = user && enrollment ? "Continue learning" : "Enroll Now";
  return (
    <div>
      <Helmet>
        <title>{`${course.title} — FAATPRO`}</title>
        <meta name="description" content={(course.summary ?? "").slice(0, 160)} />
        <link rel="canonical" href={`https://faatpro.com/courses/${course.slug}`} />
        <meta property="og:title" content={course.title} />
        <meta property="og:description" content={(course.summary ?? "").slice(0, 160)} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`https://faatpro.com/courses/${course.slug}`} />
        {thumb && <meta property="og:image" content={thumb} />}
        <meta name="twitter:card" content="summary_large_image" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Course",
          name: course.title,
          description: course.summary ?? "",
          provider: { "@type": "Organization", name: "FAATPRO", sameAs: "https://faatpro.com" },
          ...(thumb ? { image: thumb } : {}),
        })}</script>
      </Helmet>

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="max-w-7xl mx-auto px-4 sm:px-6 pt-4 text-xs text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1">
          <li><Link to="/" className="hover:text-foreground">Home</Link></li>
          <li><ChevronRight className="h-3 w-3" /></li>
          <li><Link to="/courses" className="hover:text-foreground">Courses</Link></li>
          {course.category && (<><li><ChevronRight className="h-3 w-3" /></li><li className="text-foreground">{course.category}</li></>)}
        </ol>
      </nav>

      {/* HERO */}
      <section className="bg-surface-muted border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 pb-8 lg:pt-8 lg:pb-10 grid lg:grid-cols-[1fr_360px] gap-8">
          <div>
            <Link to="/courses" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><ArrowLeft className="h-3 w-3" /> Back to catalog</Link>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {course.is_best_seller && <Badge className="bg-warning text-warning-foreground">Bestseller</Badge>}
              {course.is_new && <Badge variant="secondary">New</Badge>}
              {course.is_trending && <Badge variant="secondary">Trending</Badge>}
              {course.category && <Badge variant="outline">{course.category}</Badge>}
              {course.subcategory && <Badge variant="outline">{course.subcategory}</Badge>}
            </div>

            <h1 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">{course.title}</h1>
            {course.summary && <p className="mt-2 text-muted-foreground text-base sm:text-lg">{course.summary}</p>}

            {/* Stats / meta row */}
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              {(stats?.students ?? 0) > 0 && (
                <span className="inline-flex items-center gap-1.5 text-muted-foreground"><Users className="h-4 w-4" /> {stats.students.toLocaleString()} students</span>
              )}
              {levelLabel && (
                <span className="inline-flex items-center gap-1.5 text-muted-foreground"><BarChart3 className="h-4 w-4" /> {levelLabel}</span>
              )}
              {langLabel && (
                <span className="inline-flex items-center gap-1.5 text-muted-foreground"><Globe className="h-4 w-4" /> {langLabel}</span>
              )}
              {updatedLabel && (
                <span className="inline-flex items-center gap-1.5 text-muted-foreground"><CalendarDays className="h-4 w-4" /> Updated {updatedLabel}</span>
              )}
            </div>

            <div className="mt-3 text-sm text-muted-foreground">
              Created by <span className="text-foreground font-medium">{course.profiles?.full_name ?? "FAATPRO Instructor"}</span>
            </div>

            {/* Curriculum quick stats */}
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-background border border-border"><BookOpen className="h-3.5 w-3.5" /> {stats?.lessons ?? lessons.length} lessons</span>
              {(stats?.modules ?? 0) > 0 && (
                <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-background border border-border">{stats.modules} modules</span>
              )}
              {(stats?.quizzes ?? 0) > 0 && (
                <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-background border border-border"><ListChecks className="h-3.5 w-3.5" /> {stats.quizzes} quizzes</span>
              )}
              {(stats?.assignments ?? 0) > 0 && (
                <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-background border border-border"><GraduationCap className="h-3.5 w-3.5" /> {stats.assignments} assignments</span>
              )}
              {totalMinutes > 0 && (
                <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-background border border-border"><Clock className="h-3.5 w-3.5" /> {formatDuration(totalMinutes)} total</span>
              )}
            </div>

            {/* Highlights (above the fold) */}
            <Card className="mt-6 p-4 border-border bg-background">
              <div className="font-semibold text-sm mb-2">What you'll learn</div>
              {learn.length > 0 ? (
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  {learn.map((item: string, i: number) => (
                    <li key={i} className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" /><span>{item}</span></li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No learning outcomes added yet.</p>
              )}
            </Card>

            {relatedBundles.length > 0 && (
              <div className="mt-4 space-y-3">
                {relatedBundles.map((b: any) => {
                  const reg = Number(b.regular_price ?? 0);
                  const sale = b.sale_price != null ? Number(b.sale_price) : null;
                  const save = sale != null && sale < reg && reg > 0 ? Math.round(((reg - sale) / reg) * 100) : null;
                  return (
                    <RLink key={b.id} to={`/bundles/${b.slug}`} className="block">
                      <Card className="p-4 flex items-center gap-4 border-2 border-primary/30 bg-primary/5 hover:border-primary transition-colors">
                        <div className="h-12 w-12 rounded-md bg-primary/10 grid place-items-center text-primary shrink-0">
                          <PackageOpen className="h-6 w-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-muted-foreground">Part of a bundle</div>
                          <div className="font-semibold">
                            Upgrade to <span className="text-primary">{b.name}</span>
                            {save !== null && <> and save {save}%.</>}
                          </div>
                        </div>
                        <Button size="sm">View bundle</Button>
                      </Card>
                    </RLink>
                  );
                })}
              </div>
            )}
          </div>

          {/* SIDEBAR */}
          <Card className="p-0 border-border shadow-soft h-fit overflow-hidden lg:sticky lg:top-20">
            <div className="aspect-video bg-muted overflow-hidden relative">
              {thumb ? (
                <img src={thumb} alt={course.title} className="w-full h-full object-cover" loading="lazy" />
              ) : (
                <div className="w-full h-full bg-gradient-brand grid place-items-center">
                  <BookOpen className="h-10 w-10 text-primary-foreground/80" />
                </div>
              )}
              {discountPct && saleActive && (
                <div className="absolute top-2 left-2 bg-destructive text-destructive-foreground text-xs font-bold px-2 py-1 rounded">{discountPct}</div>
              )}
            </div>

            <div className="p-5">
              <CoursePrice course={course} size="lg" />
              {!isFree && course.gst_rate > 0 && (
                <div className="text-xs text-muted-foreground mt-1">{course.tax_inclusive ? "Inclusive of" : "+"} {course.gst_rate}% GST</div>
              )}

              {saleActive && countdown && !countdown.expired && (
                <div className="mt-3 flex items-center gap-2 rounded-md bg-destructive/10 text-destructive px-3 py-2 text-xs font-semibold">
                  <Timer className="h-4 w-4" />
                  <span>
                    Offer ends in{" "}
                    {countdown.days > 0 && <>{countdown.days}d </>}
                    {String(countdown.hours).padStart(2, "0")}h{" "}
                    {String(countdown.minutes).padStart(2, "0")}m{" "}
                    {String(countdown.seconds).padStart(2, "0")}s
                  </span>
                </div>
              )}

              <Button size="lg" className="w-full mt-4" disabled={busy} onClick={handleEnroll}>{ctaLabel}</Button>

              {!isFree && course.allow_coupons !== false && user && !enrollment && (
                <div className="mt-3">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Tag className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <Input placeholder="Coupon code" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} className="h-9 pl-8" />
                    </div>
                    <Button variant="outline" size="sm" onClick={applyCoupon}>Apply</Button>
                  </div>
                </div>
              )}

              {!isFree && (coupon || breakdown.tax > 0) && (
                <div className="mt-3 text-xs space-y-1 text-muted-foreground">
                  {coupon && <div className="flex justify-between"><span>Coupon ({coupon.code})</span><span>-{coursePricingService.formatPrice(breakdown.coupon, breakdown.currency)}</span></div>}
                  {breakdown.tax > 0 && <div className="flex justify-between"><span>GST</span><span>{coursePricingService.formatPrice(breakdown.tax, breakdown.currency)}</span></div>}
                  <div className="flex justify-between font-semibold text-foreground pt-1 border-t border-border">
                    <span>Total</span><span>{coursePricingService.formatPrice(breakdown.total, breakdown.currency)}</span>
                  </div>
                </div>
              )}

              <div className="mt-5 pt-4 border-t border-border">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">This course includes</div>
                <ul className="space-y-1.5 text-sm">
                  {totalMinutes > 0 && (
                    <li className="flex items-center gap-2"><Video className="h-4 w-4 text-muted-foreground" /> {formatDuration(totalMinutes)} of content</li>
                  )}
                  <li className="flex items-center gap-2"><BookOpen className="h-4 w-4 text-muted-foreground" /> {stats?.lessons ?? lessons.length} lessons</li>
                  {(stats?.quizzes ?? 0) > 0 && (
                    <li className="flex items-center gap-2"><ListChecks className="h-4 w-4 text-muted-foreground" /> {stats.quizzes} quizzes</li>
                  )}
                  {(stats?.assignments ?? 0) > 0 && (
                    <li className="flex items-center gap-2"><GraduationCap className="h-4 w-4 text-muted-foreground" /> {stats.assignments} assignments</li>
                  )}
                  {materials.length > 0 && (
                    <li className="flex items-center gap-2"><Download className="h-4 w-4 text-muted-foreground" /> {materials.length} downloadable resources</li>
                  )}
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" /> {accessLabel}</li>
                  {course.enable_certificates !== false && (
                    <li className="flex items-center gap-2"><Award className="h-4 w-4 text-primary" /> Certificate of completion</li>
                  )}
                </ul>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* CONTENT */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-8 lg:py-10 grid lg:grid-cols-[1fr_360px] gap-10">
        <div className="space-y-8">
          <div>
            <h2 className="text-2xl font-bold">About this course</h2>
            {renderHtml ? (
              <div
                className="mt-3 prose prose-sm sm:prose-base max-w-none text-foreground prose-headings:text-foreground prose-strong:text-foreground prose-a:text-primary"
                dangerouslySetInnerHTML={{ __html: safeHtml }}
              />
            ) : (
              <p className="mt-3 text-muted-foreground whitespace-pre-line">{descHtml || course.summary || "A premium mentor-led course."}</p>
            )}
          </div>

          <div>
            <h2 className="text-2xl font-bold mb-4">Curriculum</h2>
            <Card className="border-border divide-y divide-border">
              {sections.length === 0 ? (
                lessons.map((l: any) => {
                  const Icon = typeIcon(l.lesson_type);
                  return (
                    <div key={l.id} className="p-4 flex items-center gap-3">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1 text-sm">{l.title}</div>
                      {l.is_preview && <Badge variant="secondary">Preview</Badge>}
                    </div>
                  );
                })
              ) : sections.map((s: any) => (
                <div key={s.id} className="p-4">
                  <div className="font-semibold">{s.title}</div>
                  <div className="mt-2 space-y-2">
                    {lessons.filter((l: any) => l.section_id === s.id).map((l: any) => {
                      const Icon = typeIcon(l.lesson_type);
                      return (
                        <div key={l.id} className="flex items-center gap-3 text-sm">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <div className="flex-1">{l.title}</div>
                          {l.is_preview && <Link to={`/lessons/${l.id}/preview`} className="text-xs text-primary hover:underline">Preview</Link>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </Card>
          </div>

          {previewLessons.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold mb-4">Free preview lessons</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {previewLessons.map((l: any) => (
                  <Link key={l.id} to={`/lessons/${l.id}/preview`}>
                    <Card className="p-4 border-border hover:shadow-soft transition-all flex items-center gap-3">
                      <PlayCircle className="h-5 w-5 text-primary" />
                      <div className="flex-1">
                        <div className="font-medium text-sm">{l.title}</div>
                        <div className="text-xs text-muted-foreground">{l.lesson_type} · preview</div>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        <aside className="space-y-4">
          {/* Share */}
          <Card className="p-5 border-border">
            <div className="font-semibold mb-3 flex items-center gap-2"><Share2 className="h-4 w-4" /> Share this course</div>
            <div className="flex flex-wrap gap-2">
              <a target="_blank" rel="noreferrer" href={`https://www.facebook.com/sharer/sharer.php?u=${encUrl}`} className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted"><Facebook className="h-3.5 w-3.5" /> Facebook</a>
              <a target="_blank" rel="noreferrer" href={`https://www.linkedin.com/sharing/share-offsite/?url=${encUrl}`} className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted"><Linkedin className="h-3.5 w-3.5" /> LinkedIn</a>
              <a target="_blank" rel="noreferrer" href={`https://twitter.com/intent/tweet?url=${encUrl}&text=${shareText}`} className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted"><Twitter className="h-3.5 w-3.5" /> Twitter</a>
              <a target="_blank" rel="noreferrer" href={`https://wa.me/?text=${shareText}%20${encUrl}`} className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted">WhatsApp</a>
              <button onClick={copyShareLink} className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted"><Link2 className="h-3.5 w-3.5" /> Copy link</button>
            </div>
          </Card>

          {/* Trust */}
          <Card className="p-5 border-border">
            <div className="font-semibold mb-3">Why enroll with us</div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-success" /> Secure payment (GST invoice)</li>
              <li className="flex items-center gap-2"><RefreshCw className="h-4 w-4 text-success" /> 7-day money-back guarantee</li>
              <li className="flex items-center gap-2"><InfinityIcon className="h-4 w-4 text-success" /> {accessLabel}</li>
              <li className="flex items-center gap-2"><Smartphone className="h-4 w-4 text-success" /> Mobile & desktop access</li>
              {course.enable_certificates !== false && (
                <li className="flex items-center gap-2"><Award className="h-4 w-4 text-primary" /> Certificate of completion</li>
              )}
            </ul>
          </Card>

          {reqs.length > 0 && (
            <Card className="p-5 border-border">
              <div className="font-semibold mb-3">Requirements</div>
              <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-5">
                {reqs.map((r: string, i: number) => <li key={i}>{r}</li>)}
              </ul>
            </Card>
          )}
          {audience.length > 0 && (
            <Card className="p-5 border-border">
              <div className="font-semibold mb-3">Who this course is for</div>
              <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-5">
                {audience.map((r: string, i: number) => <li key={i}>{r}</li>)}
              </ul>
            </Card>
          )}
          {materials.length > 0 && (
            <Card className="p-5 border-border">
              <div className="font-semibold mb-3">Materials included</div>
              <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-5">
                {materials.map((r: string, i: number) => <li key={i}>{r}</li>)}
              </ul>
            </Card>
          )}
        </aside>
      </section>

      {/* Sticky mobile CTA */}
      <div className="lg:hidden sticky bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur border-t border-border p-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <CoursePrice course={course} size="sm" />
        </div>
        <Button size="lg" disabled={busy} onClick={handleEnroll}>{ctaLabel}</Button>
      </div>
    </div>
  );
}
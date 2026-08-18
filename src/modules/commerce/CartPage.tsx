import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ShoppingCart, Trash2, ArrowLeft, PackageOpen, BookOpen, Lock, ShieldCheck, Award } from "lucide-react";
import { useCart } from "./useCart";
import { useAuth } from "@/shared/hooks/useAuth";
import { paymentService, coursePricingService } from "@/services/supabase/coursePricingService";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { savePostLoginRedirect } from "@/lib/authRedirect";

const fmt = (n: number, c: string) => coursePricingService.formatPrice(n, c);

export default function CartPage() {
  const { items, remove, count } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const currency = items[0]?.currency ?? "INR";
  const subtotal = items.reduce((s, i) => s + Number(i.price ?? 0), 0);
  const savings = items.reduce((s, i) => s + Math.max(0, Number(i.originalPrice ?? i.price) - Number(i.price)), 0);

  const checkoutItem = async (item: any) => {
    if (!user) {
      // Preserve cart destination — guest cart persists in localStorage,
      // so after login the user lands back on the cart to finish checkout.
      savePostLoginRedirect("/cart");
      navigate(`/auth/login?next=${encodeURIComponent("/cart")}`);
      return;
    }
    setBusyKey(item.key);
    try {
      if (item.productType === "bundle") {
        // Bundles use their own detail page purchase flow
        navigate(`/bundles/${item.slug}`);
        return;
      }
      // Prevent purchasing a course the student already owns (direct enrollment
      // or via a previously purchased bundle that created per-course enrollments).
      const { data: existing } = await supabase
        .from("enrollments")
        .select("id, status, access_expires_at")
        .eq("student_id", user.id)
        .eq("course_id", item.productId)
        .maybeSingle();
      const stillValid = existing && existing.status !== "expired" && (
        !existing.access_expires_at || new Date(existing.access_expires_at as string).getTime() > Date.now()
      );
      if (stillValid) {
        toast({ title: "You already own this course", description: "Opening your course player." });
        remove(item.key);
        navigate(`/learn/${item.productId}`);
        return;
      }
      const { data: course } = await supabase.from("courses").select("*").eq("id", item.productId).maybeSingle();
      if (!course) throw new Error("Course not available");
      // The course may have been unpublished or removed after it was added to the cart.
      if ((course as any).deleted_at || !["published", "approved"].includes(String((course as any).status))) {
        toast({
          title: "Course unavailable",
          description: "This course is no longer available for purchase and has been removed from your cart.",
          variant: "destructive",
        });
        remove(item.key);
        return;
      }
      const payment = await paymentService.createCoursePaymentIntent({
        workspaceId: course.workspace_id, studentId: user.id, courseId: course.id, course, coupon: null,
      });
      navigate(`/checkout/${payment.id}?from=cart`);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 lg:py-12">
      <Helmet>
        <title>Your Cart — FAATPRO</title>
        <meta name="description" content="Review the courses and bundles in your FAATPRO cart before checkout." />
      </Helmet>
      <Link to="/courses" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        <ArrowLeft className="h-3 w-3" /> Continue shopping
      </Link>
      <h1 className="text-3xl font-bold mt-3 flex items-center gap-2">
        <ShoppingCart className="h-7 w-7" /> Shopping cart
      </h1>
      <p className="text-muted-foreground mt-1">{count} item{count === 1 ? "" : "s"} in cart</p>

      {items.length === 0 ? (
        <Card className="mt-8 p-12 text-center border-border">
          <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground" />
          <div className="mt-4 font-semibold text-lg">Your cart is empty</div>
          <p className="text-muted-foreground mt-1">Explore our catalog to add courses and bundles.</p>
          <Button asChild className="mt-6"><Link to="/courses">Browse courses</Link></Button>
        </Card>
      ) : (
        <div className="mt-8 grid lg:grid-cols-[1fr_360px] gap-8">
          <div className="space-y-3">
            {items.map((item) => {
              const orig = Number(item.originalPrice ?? item.price);
              const showOrig = orig > item.price;
              return (
                <Card key={item.key} className="p-4 border-border flex gap-4 items-start">
                  <Link to={item.productType === "bundle" ? `/bundles/${item.slug}` : `/courses/${item.slug}`} className="shrink-0">
                    <div className="h-20 w-32 rounded-md bg-muted overflow-hidden">
                      {item.thumbnail ? (
                        <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full grid place-items-center bg-gradient-brand">
                          {item.productType === "bundle" ? <PackageOpen className="h-6 w-6 text-white" /> : <BookOpen className="h-6 w-6 text-white" />}
                        </div>
                      )}
                    </div>
                  </Link>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">{item.productType === "bundle" ? "Bundle" : "Course"}</div>
                    <Link to={item.productType === "bundle" ? `/bundles/${item.slug}` : `/courses/${item.slug}`} className="font-semibold hover:text-primary line-clamp-2">
                      {item.title}
                    </Link>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-lg font-bold">{fmt(item.price, item.currency)}</span>
                      {showOrig && <span className="text-sm text-muted-foreground line-through">{fmt(orig, item.currency)}</span>}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 items-end">
                    <Button size="sm" onClick={() => checkoutItem(item)} disabled={busyKey === item.key}>
                      {busyKey === item.key ? "…" : "Buy now"}
                    </Button>
                    <button onClick={() => remove(item.key)} className="text-xs text-muted-foreground hover:text-destructive inline-flex items-center gap-1">
                      <Trash2 className="h-3 w-3" /> Remove
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>

          <aside className="space-y-4 lg:sticky lg:top-20 h-fit">
            <Card className="p-5 border-border">
              <div className="font-semibold mb-4">Order summary</div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{fmt(subtotal, currency)}</span></div>
                {savings > 0 && (
                  <div className="flex justify-between text-success"><span>You save</span><span>-{fmt(savings, currency)}</span></div>
                )}
                <div className="text-xs text-muted-foreground pt-1">Coupons &amp; GST applied at checkout.</div>
                <div className="flex justify-between font-bold text-lg pt-3 border-t border-border">
                  <span>Estimated total</span><span>{fmt(subtotal, currency)}</span>
                </div>
              </div>
              <Button className="w-full mt-5" size="lg" onClick={() => items[0] && checkoutItem(items[0])}>
                <Lock className="h-4 w-4 mr-2" /> Proceed to checkout
              </Button>
              {items.length > 1 && (
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  You&apos;ll be guided through each item.
                </p>
              )}
            </Card>

            <Card className="p-5 border-border">
              <div className="font-semibold mb-3 text-sm">Buy with confidence</div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-success" /> Secure payment (GST invoice)</li>
                <li className="flex items-center gap-2"><Award className="h-4 w-4 text-primary" /> Certificate on completion</li>
                <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-success" /> 7-day money-back guarantee</li>
              </ul>
            </Card>
          </aside>
        </div>
      )}
    </div>
  );
}
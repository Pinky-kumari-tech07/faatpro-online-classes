import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Lock, ShieldCheck, Pencil, Tag, CreditCard, Landmark, Clock } from "lucide-react";
import { paymentService, coursePricingService, couponService } from "@/services/supabase/coursePricingService";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/shared/hooks/useAuth";
import BillingAddressForm, { BillingAddress, EMPTY_BILLING, isBillingValid } from "@/modules/finance/BillingAddressForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { savePostLoginRedirect } from "@/lib/authRedirect";

declare global {
  interface Window {
    Razorpay?: any;
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export default function CheckoutPage() {
  const { paymentId } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth() as any;
  const [paying, setPaying] = useState(false);
  const [billingOpen, setBillingOpen] = useState(false);
  const [billing, setBilling] = useState<BillingAddress>(EMPTY_BILLING);
  const [billingLoaded, setBillingLoaded] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [coupon, setCoupon] = useState<any | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"razorpay" | "offline">("razorpay");

  useEffect(() => {
    loadRazorpayScript();
  }, []);

  useEffect(() => {
    (async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from("profiles")
        .select("billing_full_name, billing_address, billing_city, billing_state, billing_country, billing_pin, billing_phone, billing_gstin, full_name, phone")
        .eq("id", user.id)
        .maybeSingle();
      if (data) {
        setBilling({
          billing_full_name: data.billing_full_name || data.full_name || "",
          billing_address: data.billing_address || "",
          billing_city: data.billing_city || "",
          billing_state: data.billing_state || "",
          billing_country: data.billing_country || "India",
          billing_pin: data.billing_pin || "",
          billing_phone: data.billing_phone || data.phone || "",
          billing_gstin: data.billing_gstin || "",
        });
        if (!isBillingValid(data as any)) setBillingOpen(true);
      } else {
        setBillingOpen(true);
      }
      setBillingLoaded(true);
    })();
  }, [user?.id]);

  const saveBilling = async () => {
    if (!isBillingValid(billing)) {
      toast({ title: "Complete required fields", description: "Name, address, city, state, country and PIN are required.", variant: "destructive" });
      return false;
    }
    if (!user?.id) return false;
    const { error } = await supabase.from("profiles").update(billing as any).eq("id", user.id);
    if (error) {
      toast({ title: "Couldn't save billing details", description: error.message, variant: "destructive" });
      return false;
    }
    setBillingOpen(false);
    return true;
  };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["payment", paymentId, user?.id],
    queryFn: () => paymentService.getPayment(paymentId!),
    enabled: !!paymentId && !!user?.id && !authLoading,
    retry: 1,
  });

  useEffect(() => {
    if ((data as any)?.provider === "offline") setPaymentMethod("offline");
    if ((data as any)?.provider === "razorpay") setPaymentMethod("razorpay");
  }, [(data as any)?.provider]);

  useEffect(() => {
    if (authLoading || user) return;
    const redirect = typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : `/checkout/${paymentId ?? ""}`;
    savePostLoginRedirect(redirect);
  }, [authLoading, user, paymentId]);

  if (authLoading || isLoading) return <div className="max-w-2xl mx-auto px-4 py-16 text-muted-foreground">Loading checkout…</div>;
  if (!user) {
    const redirect = typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : `/checkout/${paymentId ?? ""}`;
    return (
      <div className="max-w-2xl mx-auto px-4 py-16">
        <Card className="p-6 border-border text-center">
          <Lock className="h-8 w-8 mx-auto text-primary mb-3" />
          <h1 className="text-xl font-semibold">Login required for checkout</h1>
          <p className="text-sm text-muted-foreground mt-2">Please login to continue with Razorpay or offline payment.</p>
          <Button asChild className="mt-5"><Link to={`/auth/login?next=${encodeURIComponent(redirect)}`}>Login to continue</Link></Button>
        </Card>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16">
        <Card className="p-6 border-border text-center">
          <Lock className="h-8 w-8 mx-auto text-destructive mb-3" />
          <h1 className="text-xl font-semibold">Checkout unavailable</h1>
          <p className="text-sm text-muted-foreground mt-2">
            {error
              ? `We couldn't load this checkout: ${(error as any).message ?? "unknown error"}`
              : "This payment link is invalid, has expired, or belongs to a different account."}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Signed in as <span className="font-medium">{user?.email}</span>. If this checkout was started from another account, please sign in with that account.
          </p>
          <div className="flex gap-2 justify-center mt-5">
            <Button asChild variant="outline"><Link to="/courses">Browse courses</Link></Button>
            <Button onClick={() => refetch()}>Retry</Button>
          </div>
        </Card>
      </div>
    );
  }

  const currency = data.currency ?? "INR";
  const fmt = (n: any) => coursePricingService.formatPrice(Number(n ?? 0), currency);
  const course: any = (data as any).courses;

  const applyCoupon = async () => {
    if (!couponCode.trim() || !course) return;
    setApplyingCoupon(true);
    try {
      const res = await couponService.validateCoupon(couponCode.trim(), course.id, course.workspace_id, { productType: "course", product: course });
      if (!res.valid) {
        toast({ title: res.reason ?? "Invalid coupon", description: `Code: ${couponCode.trim().toUpperCase()}`, variant: "destructive" });
        setCoupon(null);
        return;
      }
      const { error } = await supabase.rpc("update_checkout_coupon", { _payment_id: data.id, _coupon_code: res.coupon.code });
      if (error) throw error;
      setCoupon(res.coupon);
      toast({ title: "Coupon applied", description: `${res.coupon.code} — total updated` });
      await refetch();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setApplyingCoupon(false);
    }
  };

  const removeCoupon = async () => {
    if (!course) return;
    const { error } = await supabase.rpc("update_checkout_coupon", { _payment_id: data.id, _coupon_code: null });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setCoupon(null);
    setCouponCode("");
    toast({ title: "Coupon removed" });
    await refetch();
  };

  const payWithRazorpay = async () => {
    if (paying) return;
    if (!isBillingValid(billing)) {
      setBillingOpen(true);
      toast({ title: "Billing details required", description: "Please complete your billing address to generate a GST invoice." });
      return;
    }
    setPaying(true);
    try {
      const ready = await loadRazorpayScript();
      if (!ready || !window.Razorpay) throw new Error("Could not load Razorpay. Please retry.");

      const { data: order, error: orderErr } = await supabase.functions.invoke(
        "razorpay-create-order",
        { body: { paymentId: data.id } },
      );
      if (orderErr) throw new Error(orderErr.message ?? "Could not start payment");
      if (!order?.orderId) throw new Error(order?.error ?? "Could not start payment");

      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: course?.title ?? "Course enrollment",
        description: course?.summary ?? "Secure payment via Razorpay",
        order_id: order.orderId,
        prefill: {
          email: user?.email ?? "",
          name: user?.user_metadata?.full_name ?? "",
        },
        theme: { color: "#6366f1" },
        handler: async (response: any) => {
          try {
            const { data: verifyData, error: verifyErr } = await supabase.functions.invoke(
              "razorpay-verify-payment",
              {
                body: {
                  paymentId: data.id,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                },
              },
            );
            if (verifyErr || !verifyData?.ok) {
              throw new Error(verifyErr?.message ?? verifyData?.error ?? "Verification failed");
            }
            toast({ title: "Payment successful", description: "Enrollment activated." });
            navigate(course?.id ? `/learn/${course.id}` : "/app/dashboard");
          } catch (e: any) {
            toast({ title: "Verification failed", description: e.message, variant: "destructive" });
          }
        },
        modal: {
          ondismiss: () => setPaying(false),
        },
      });
      rzp.on("payment.failed", (resp: any) => {
        toast({
          title: "Payment failed",
          description: resp?.error?.description ?? "Please try again.",
          variant: "destructive",
        });
        setPaying(false);
      });
      rzp.open();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
      setPaying(false);
    }
  };

  const requestOfflinePayment = async () => {
    if (paying) return;
    if (!isBillingValid(billing)) {
      setBillingOpen(true);
      toast({ title: "Billing details required", description: "Please complete your billing address to generate a GST invoice." });
      return;
    }
    setPaying(true);
    try {
      const { error } = await supabase.rpc("request_offline_payment", { _payment_id: data.id });
      if (error) throw error;
      toast({ title: "Offline payment selected", description: "Your request is pending admin confirmation." });
      await refetch();
    } catch (e: any) {
      toast({ title: "Could not select offline payment", description: e.message, variant: "destructive" });
    } finally {
      setPaying(false);
    }
  };

  const completePayment = () => {
    if (paymentMethod === "offline") return requestOfflinePayment();
    return payWithRazorpay();
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <Link to={course?.slug ? `/courses/${course.slug}` : "/courses"} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        <ArrowLeft className="h-3 w-3" /> Back
      </Link>
      <h1 className="text-3xl font-bold mt-3">Checkout</h1>
      <p className="text-muted-foreground mt-1">Review your order before completing payment.</p>

      <Card className="mt-6 p-6 border-border">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-semibold text-lg">{course?.title ?? "Course"}</div>
            <div className="text-sm text-muted-foreground">{course?.summary ?? ""}</div>
          </div>
          <Badge variant="secondary" className="capitalize">{data.status}</Badge>
        </div>
        <div className="mt-6 space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Base price</span><span>{fmt(data.base_price)}</span></div>
          {Number(data.discount_amount) > 0 && (
            <div className="flex justify-between text-success"><span>Discount{data.coupon_code ? ` (${data.coupon_code})` : ""}</span><span>-{fmt(data.discount_amount)}</span></div>
          )}
          {Number(data.tax_amount) > 0 && (
            <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span>{fmt(data.tax_amount)}</span></div>
          )}
          <div className="flex justify-between font-bold text-lg pt-3 border-t border-border">
            <span>Total</span><span>{fmt(data.total_amount ?? data.amount)}</span>
          </div>
        </div>

        {data.status === "pending" && course && course.allow_coupons !== false && (
          <div className="mt-6 rounded-md border border-border p-4">
            <div className="text-sm font-semibold mb-2 flex items-center gap-2"><Tag className="h-4 w-4" /> Have a coupon?</div>
            {data.coupon_code ? (
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Badge className="mr-2">{data.coupon_code}</Badge>
                  <span className="text-xs text-success">Coupon applied</span>
                </div>
                <Button size="sm" variant="ghost" onClick={removeCoupon}>Remove</Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input placeholder="Enter coupon code" value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} className="uppercase" />
                <Button variant="outline" size="sm" onClick={applyCoupon} disabled={applyingCoupon || !couponCode.trim()}>
                  {applyingCoupon ? "…" : "Apply"}
                </Button>
              </div>
            )}
          </div>
        )}

        <div className="mt-6 rounded-md border border-border p-4">
          <div className="text-sm font-semibold mb-3">Payment method</div>
          <div className="grid gap-3">
            <button
              type="button"
              onClick={() => setPaymentMethod("razorpay")}
              className={`text-left rounded-md border p-4 transition-colors ${paymentMethod === "razorpay" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"}`}
            >
              <div className="flex items-start gap-3">
                <CreditCard className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <div className="font-medium">Direct payment via Razorpay</div>
                  <div className="text-xs text-muted-foreground mt-1">UPI, cards, net banking, and wallets. Enrollment activates automatically after payment.</div>
                </div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod("offline")}
              className={`text-left rounded-md border p-4 transition-colors ${paymentMethod === "offline" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"}`}
            >
              <div className="flex items-start gap-3">
                <Landmark className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <div className="font-medium">Offline payment</div>
                  <div className="text-xs text-muted-foreground mt-1">Pay by bank transfer, cash, or UPI outside checkout. Admin will approve and activate enrollment.</div>
                </div>
              </div>
            </button>
          </div>
        </div>

        {data.provider === "offline" && data.status === "pending" && (
          <div className="mt-4 rounded-md bg-warning/10 border border-warning/20 p-4 text-sm text-warning flex gap-3">
            <Clock className="h-4 w-4 mt-0.5 shrink-0" />
            <div>Your offline payment request is pending admin confirmation.</div>
          </div>
        )}

        {paymentMethod === "razorpay" && (
          <div className="mt-4 rounded-md bg-muted/40 border border-border p-4 text-sm text-muted-foreground flex gap-3">
            <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
            <div>Secured by <span className="font-medium text-foreground">Razorpay</span>.</div>
          </div>
        )}

        <div className="mt-6 rounded-md border border-border p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm">
              <div className="font-semibold mb-0.5">Billing details (for GST invoice)</div>
              {isBillingValid(billing) ? (
                <div className="text-muted-foreground text-xs leading-5">
                  <div>{billing.billing_full_name}</div>
                  <div>{billing.billing_address}</div>
                  <div>{[billing.billing_city, billing.billing_state, billing.billing_pin].filter(Boolean).join(", ")}, {billing.billing_country}</div>
                  {billing.billing_gstin && <div>GSTIN: {billing.billing_gstin}</div>}
                </div>
              ) : (
                <div className="text-destructive text-xs">Required to generate your GST invoice</div>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => setBillingOpen(true)}>
              <Pencil className="h-3 w-3 mr-1" /> {isBillingValid(billing) ? "Edit" : "Add"}
            </Button>
          </div>
        </div>

        {data.status === "pending" ? (
          <Button className="w-full mt-6 h-12 text-base" onClick={completePayment} disabled={paying || !billingLoaded || !isBillingValid(billing)}>
            {paymentMethod === "offline" ? <Landmark className="h-4 w-4 mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
            {paying
              ? paymentMethod === "offline" ? "Saving request…" : "Opening Razorpay…"
              : paymentMethod === "offline" ? "Request offline payment approval" : `Pay ${fmt(data.total_amount ?? data.amount)} with Razorpay`}
          </Button>
        ) : (
          <div className="mt-6 text-sm text-success font-medium">Payment completed.</div>
        )}
        <Button variant="outline" className="w-full mt-2" onClick={() => refetch()}>Refresh status</Button>
      </Card>

      <Dialog open={billingOpen} onOpenChange={setBillingOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Billing address</DialogTitle>
          </DialogHeader>
          <BillingAddressForm value={billing} onChange={setBilling} />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setBillingOpen(false)}>Cancel</Button>
            <Button onClick={saveBilling}>Save & Continue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
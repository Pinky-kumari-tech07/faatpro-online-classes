import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: authErr } = await supabase.auth.getClaims(token);
    if (authErr || !claims?.claims) return json({ error: "Unauthorized" }, 401);
    const userId = claims.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const paymentId = body?.paymentId as string | undefined;
    if (!paymentId || typeof paymentId !== "string") {
      return json({ error: "paymentId is required" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: payment, error: pErr } = await admin
      .from("payments")
      .select("*, courses(*)")
      .eq("id", paymentId)
      .maybeSingle();
    if (pErr || !payment) return json({ error: "Payment not found" }, 404);
    if (payment.student_id !== userId) return json({ error: "Forbidden" }, 403);
    if (payment.status === "succeeded") return json({ error: "Payment already completed" }, 400);

    // Server-side price recomputation (trust DB, not client)
    const course: any = payment.courses;
    if (!course) return json({ error: "Course not found" }, 404);

    // Re-validate availability at payment time: the course may have been
    // unpublished, archived or deleted after it was added to the cart.
    if (course.deleted_at || !["published", "approved"].includes(String(course.status))) {
      return json({ error: "This course is no longer available for purchase." }, 409);
    }

    // Re-validate enrollment: never take money for a course the student already owns.
    const { data: existingEnrollment } = await admin
      .from("enrollments")
      .select("id, status")
      .eq("student_id", payment.student_id)
      .eq("course_id", payment.course_id)
      .maybeSingle();
    if (existingEnrollment && existingEnrollment.status !== "expired") {
      return json({ error: "You are already enrolled in this course." }, 409);
    }

    const base = Number(course.price_amount ?? 0);
    let afterDiscount = base;
    const hasSale = course.sale_price && Number(course.sale_price) > 0;
    const now = Date.now();
    const within =
      (!course.discount_starts_at || new Date(course.discount_starts_at).getTime() <= now) &&
      (!course.discount_ends_at || new Date(course.discount_ends_at).getTime() >= now);
    if (within) {
      if (hasSale) afterDiscount = Number(course.sale_price);
      else if (course.discount_type === "percentage" && course.discount_value)
        afterDiscount = Math.max(0, base - (base * Number(course.discount_value)) / 100);
      else if (course.discount_type === "fixed" && course.discount_value)
        afterDiscount = Math.max(0, base - Number(course.discount_value));
    }
    // Subtract coupon discount already stored on the payment row (validated at creation)
    const couponDiscount = Math.max(0, Number(payment.discount_amount ?? 0) - (base - afterDiscount));
    const subtotal = Math.max(0, afterDiscount - couponDiscount);
    let tax = 0;
    if (course.gst_rate && Number(course.gst_rate) > 0) {
      if (course.tax_inclusive) tax = subtotal - subtotal / (1 + Number(course.gst_rate) / 100);
      else tax = (subtotal * Number(course.gst_rate)) / 100;
    }
    const total = course.tax_inclusive ? subtotal : subtotal + tax;
    const currency = (payment.currency ?? course.currency ?? "INR") as string;
    const amountInPaise = Math.round(total * 100);
    if (amountInPaise <= 0) return json({ error: "Invalid amount" }, 400);

    const keyId = Deno.env.get("RAZORPAY_KEY_ID");
    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!keyId || !keySecret) return json({ error: "Razorpay not configured" }, 500);

    // Reuse the existing order only when it still matches the authoritative amount,
    // otherwise the gateway would charge a stale price.
    let orderId = payment.razorpay_order_id as string | null;
    if (orderId && Math.round(Number(payment.total_amount ?? payment.amount ?? 0) * 100) !== amountInPaise) {
      orderId = null;
    }
    if (!orderId) {
      const auth = btoa(`${keyId}:${keySecret}`);
      const resp = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: amountInPaise,
          currency,
          receipt: `pay_${payment.id.slice(0, 30)}`,
          notes: {
            payment_id: payment.id,
            student_id: payment.student_id,
            course_id: payment.course_id,
            workspace_id: payment.workspace_id,
          },
        }),
      });
      const orderJson = await resp.json();
      if (!resp.ok) {
        console.error("razorpay order create failed", orderJson);
        return json({ error: orderJson?.error?.description ?? "Failed to create order" }, 502);
      }
      orderId = orderJson.id as string;

      await admin
        .from("payments")
        .update({
          razorpay_order_id: orderId,
          provider: "razorpay",
          total_amount: total,
          amount: total,
          tax_amount: tax,
          currency,
        })
        .eq("id", payment.id);
    }

    return json({
      orderId,
      keyId,
      amount: amountInPaise,
      currency,
      paymentId: payment.id,
    });
  } catch (e) {
    console.error("create-order error", e);
    return json({ error: (e as Error).message ?? "Server error" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
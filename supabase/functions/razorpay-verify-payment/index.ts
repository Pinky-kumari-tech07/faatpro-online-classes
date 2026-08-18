import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createHmac } from "node:crypto";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

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
    const { paymentId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = body ?? {};
    if (!paymentId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return json({ error: "Missing fields" }, 400);
    }

    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!keySecret) return json({ error: "Razorpay not configured" }, 500);

    const expected = createHmac("sha256", keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");
    if (expected !== razorpay_signature) {
      return json({ error: "Invalid signature" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: payment, error: pErr } = await admin
      .from("payments")
      .select("*")
      .eq("id", paymentId)
      .maybeSingle();
    if (pErr || !payment) return json({ error: "Payment not found" }, 404);
    if (payment.student_id !== userId) return json({ error: "Forbidden" }, 403);
    if (payment.razorpay_order_id && payment.razorpay_order_id !== razorpay_order_id) {
      return json({ error: "Order mismatch" }, 400);
    }
    // Idempotent: a double submission / refresh must not re-run enrollment work.
    if (payment.status === "succeeded" && payment.razorpay_payment_id === razorpay_payment_id) {
      return json({ ok: true, alreadyProcessed: true });
    }

    await admin
      .from("payments")
      .update({
        status: "succeeded",
        provider: "razorpay",
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        external_payment_id: razorpay_payment_id,
      })
      .eq("id", paymentId);

    // Activate enrollment
    if (payment.course_id && payment.student_id) {
      // Make sure the student is a member of the course's workspace so the instructor sees them
      await admin.from("workspace_members").upsert(
        { workspace_id: payment.workspace_id, profile_id: payment.student_id, role: "student", status: "active" },
        { onConflict: "workspace_id,profile_id,role" }
      );
      const { data: existing } = await admin
        .from("enrollments")
        .select("id")
        .eq("student_id", payment.student_id)
        .eq("course_id", payment.course_id)
        .maybeSingle();
      if (!existing) {
        await admin.from("enrollments").insert({
          workspace_id: payment.workspace_id,
          student_id: payment.student_id,
          course_id: payment.course_id,
          status: "active",
        });
      } else {
        await admin.from("enrollments").update({ status: "active" }).eq("id", existing.id);
      }
    }

    return json({ ok: true });
  } catch (e) {
    console.error("verify error", e);
    return json({ error: (e as Error).message ?? "Server error" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
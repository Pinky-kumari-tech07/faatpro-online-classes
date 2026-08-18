import { supabase } from "@/integrations/supabase/client";

export type Course = any;
export type Coupon = any;

const SYMBOL: Record<string, string> = { INR: "₹", USD: "$", EUR: "€", GBP: "£" };

const BUSINESS_TIME_ZONE = "Asia/Kolkata";

function businessDateKey(value: Date | string | null | undefined = new Date()) {
  const date = value instanceof Date ? value : value ? new Date(value) : new Date();
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export const coursePricingService = {
  formatPrice(amount: number | null | undefined, currency = "INR"): string {
    const n = Number(amount ?? 0);
    const sym = SYMBOL[currency] ?? `${currency} `;
    return `${sym}${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
  },

  isDiscountActive(course: Course): boolean {
    if (!course || course.pricing_type !== "paid") return false;
    const now = Date.now();
    if (course.discount_starts_at && new Date(course.discount_starts_at).getTime() > now) return false;
    if (course.discount_ends_at && new Date(course.discount_ends_at).getTime() < now) return false;
    if (course.sale_price && Number(course.sale_price) > 0) return true;
    if (course.discount_type && course.discount_type !== "none" && Number(course.discount_value) > 0) return true;
    return false;
  },

  // Returns the price after course-level discount (before coupon/tax)
  priceAfterDiscount(course: Course): number {
    const base = Number(course?.price_amount ?? 0);
    if (!coursePricingService.isDiscountActive(course)) return base;
    if (course.sale_price && Number(course.sale_price) > 0) return Number(course.sale_price);
    if (course.discount_type === "percentage") return Math.max(0, base - (base * Number(course.discount_value)) / 100);
    if (course.discount_type === "fixed") return Math.max(0, base - Number(course.discount_value));
    return base;
  },

  discountBadge(course: Course): string | null {
    if (!coursePricingService.isDiscountActive(course)) return null;
    const base = Number(course.price_amount ?? 0);
    const final = coursePricingService.priceAfterDiscount(course);
    if (final >= base || base <= 0) return null;
    // Always compute the displayed % from the actual prices so the card,
    // detail page and checkout show the same value (truncated, not rounded
    // up — matches how Udemy / typical LMS show e.g. 18% for 18.33%).
    const pct = Math.floor(((base - final) / base) * 100);
    if (pct <= 0) return null;
    return `${pct}% OFF`;
  },

  /** Milliseconds remaining on the active sale, or null when no countdown applies. */
  saleMsRemaining(course: Course): number | null {
    if (!coursePricingService.isDiscountActive(course)) return null;
    if (!course?.discount_ends_at) return null;
    const diff = new Date(course.discount_ends_at).getTime() - Date.now();
    return diff > 0 ? diff : 0;
  },

  getPriceBreakdown(course: Course, coupon?: Coupon | null) {
    const isFree = !course || course.pricing_type === "free";
    if (isFree) return { isFree: true, base: 0, discount: 0, coupon: 0, tax: 0, total: 0, currency: course?.currency ?? "INR" };
    const base = Number(course.price_amount ?? 0);
    const afterDiscount = coursePricingService.priceAfterDiscount(course);
    const discount = Math.max(0, base - afterDiscount);
    let couponAmt = 0;
    if (coupon && course.allow_coupons !== false) {
      if (coupon.discount_type === "percentage" || coupon.discount_type === "percent") couponAmt = (afterDiscount * Number(coupon.discount_value)) / 100;
      else if (coupon.discount_type === "fixed") couponAmt = Number(coupon.discount_value);
      else if (coupon.discount_type === "free") couponAmt = afterDiscount;
      couponAmt = Math.min(couponAmt, afterDiscount);
    }
    const subtotal = Math.max(0, afterDiscount - couponAmt);
    let tax = 0;
    if (course.gst_rate && Number(course.gst_rate) > 0) {
      if (course.tax_inclusive) tax = subtotal - subtotal / (1 + Number(course.gst_rate) / 100);
      else tax = (subtotal * Number(course.gst_rate)) / 100;
    }
    const total = course.tax_inclusive ? subtotal : subtotal + tax;
    return { isFree: false, base, discount, coupon: couponAmt, tax, total, currency: course.currency ?? "INR" };
  },

  async calculateFinalPrice(course: Course, coupon?: Coupon | null) {
    return coursePricingService.getPriceBreakdown(course, coupon);
  },
};

export const couponService = {
  async validateCoupon(
    code: string,
    productId: string,
    workspaceId: string,
    context?: { productType?: "course" | "bundle"; product?: any },
  ) {
    const { data: rows, error } = await supabase.rpc("lookup_active_coupon", {
      _workspace_id: workspaceId,
      _code: code,
    });
    if (error) throw error;
    const data = Array.isArray(rows) ? rows[0] : rows;
    if (!data) return { valid: false, reason: "Coupon not found", coupon: null as any };
    // Compare by India business date, not UTC timestamp. Date inputs are campaign
    // days, so a July 2 coupon must work for all of July 2 in India.
    const todayKey = businessDateKey();
    if (data.starts_at) {
      if (businessDateKey(data.starts_at) > todayKey) return { valid: false, reason: "Coupon not yet active", coupon: null };
    }
    if (data.ends_at) {
      if (businessDateKey(data.ends_at) < todayKey) return { valid: false, reason: "Coupon expired", coupon: null };
    }
    if (data.max_redemptions && (data as any).redeemed_count >= data.max_redemptions) return { valid: false, reason: "Coupon limit reached", coupon: null };
    const applies = (data as any).applies_to ?? "all_courses";
    if (applies === "specific_courses") {
      const rawScope = (data as any).course_ids as any;
      const scope = Array.isArray(rawScope)
        ? { courses: rawScope, bundles: [], categories: [] }
        : {
          courses: Array.isArray(rawScope?.courses) ? rawScope.courses : [],
          bundles: Array.isArray(rawScope?.bundles) ? rawScope.bundles : [],
          categories: Array.isArray(rawScope?.categories) ? rawScope.categories : [],
        };
      const productType = context?.productType ?? "course";
      let product = context?.product ?? null;
      if (!product) {
        if (productType === "bundle") {
          const { data: bundle, error: bundleError } = await supabase
            .from("course_bundles")
            .select("id, category")
            .eq("id", productId)
            .maybeSingle();
          if (bundleError) throw bundleError;
          product = bundle;
        } else {
          const { data: course, error: courseError } = await supabase
            .from("courses")
            .select("id, category, subcategory, child_category")
            .eq("id", productId)
            .maybeSingle();
          if (courseError) throw courseError;
          product = course;
        }
      }
      const categoryNames = [product?.category, product?.subcategory, product?.child_category].filter(Boolean).map(String);
      const matchesProduct = productType === "bundle" ? scope.bundles.includes(productId) : scope.courses.includes(productId);
      const matchesCategory = categoryNames.some((name) => scope.categories.includes(name));
      if (!matchesProduct && !matchesCategory) {
        return { valid: false, reason: `Coupon not valid for this ${productType}`, coupon: null };
      }
    }
    return { valid: true, reason: null, coupon: data };
  },
};

export const paymentService = {
  async createCoursePaymentIntent(payload: {
    workspaceId: string;
    studentId: string;
    courseId: string;
    course: any;
    coupon?: any | null;
    provider?: string;
  }) {
    const b = coursePricingService.getPriceBreakdown(payload.course, payload.coupon);
    // Preflight: block duplicate purchases. DB has partial unique indexes as
    // the final authority; this check surfaces a friendly error before we
    // create a pending payment row.
    const { data: existingEnrollment } = await supabase
      .from("enrollments")
      .select("id, status")
      .eq("student_id", payload.studentId)
      .eq("course_id", payload.courseId)
      .maybeSingle();
    if (existingEnrollment && existingEnrollment.status !== "expired") {
      throw new Error("You are already enrolled in this course.");
    }
    const { data: existingPaid } = await supabase
      .from("payments")
      .select("id")
      .eq("workspace_id", payload.workspaceId)
      .eq("student_id", payload.studentId)
      .eq("course_id", payload.courseId)
      .eq("status", "succeeded")
      .limit(1)
      .maybeSingle();
    if (existingPaid) {
      throw new Error("You have already paid for this course.");
    }
    const { data, error } = await supabase
      .from("payments")
      .insert({
        workspace_id: payload.workspaceId,
        student_id: payload.studentId,
        course_id: payload.courseId,
        provider: payload.provider ?? "razorpay",
        amount: b.total,
        currency: b.currency,
        status: "pending",
        base_price: b.base,
        discount_amount: b.discount + b.coupon,
        coupon_code: payload.coupon?.code ?? null,
        tax_amount: b.tax,
        total_amount: b.total,
      } as any)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  },

  async getPayment(id: string) {
    const { data, error } = await supabase.from("payments").select("*, courses(*)").eq("id", id).maybeSingle();
    if (error) throw error;
    return data;
  },

  async markPaymentPaid(id: string) {
    const ALLOWED = ["pending", "succeeded", "failed", "refunded"] as const;
    const target = "succeeded";
    if (!ALLOWED.includes(target as any)) {
      console.error("[payments.markPaid] invalid status", { attempted: target, allowed: ALLOWED });
      throw new Error(`Invalid payment status "${target}". Allowed: ${ALLOWED.join(", ")}`);
    }
    const { data: p, error: e1 } = await supabase.from("payments").update({ status: target as any }).eq("id", id).select("*").single();
    if (e1) {
      console.error("[payments.markPaid] update failed", { attempted: target, allowed: ALLOWED, error: e1 });
      throw e1;
    }
    if (p?.course_id && p.student_id) {
      await enrollmentService.activateEnrollmentAfterPayment({
        workspaceId: p.workspace_id, studentId: p.student_id, courseId: p.course_id,
      });
    }
    return p;
  },
};

export const enrollmentService = {
  async enrollFreeCourse(payload: { workspaceId: string; studentId: string; courseId: string }) {
    const { data: existing } = await supabase.from("enrollments").select("id").eq("student_id", payload.studentId).eq("course_id", payload.courseId).maybeSingle();
    if (existing) return existing;
    // Ensure the student is also a member of the course's workspace so they appear in the instructor's Students list.
    await supabase.from("workspace_members").upsert(
      { workspace_id: payload.workspaceId, profile_id: payload.studentId, role: "student" as any, status: "active" as any },
      { onConflict: "workspace_id,profile_id,role" }
    );
    const { data, error } = await supabase.from("enrollments").insert({
      workspace_id: payload.workspaceId, student_id: payload.studentId, course_id: payload.courseId, status: "active" as any,
    }).select("*").single();
    if (error) throw error;
    return data;
  },

  async activateEnrollmentAfterPayment(payload: { workspaceId: string; studentId: string; courseId: string }) {
    return enrollmentService.enrollFreeCourse(payload);
  },
};
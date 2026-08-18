# E-commerce Purchase Flow for Courses & Bundles

Turn the current "Enroll now" flow into a proper storefront: Course/Bundle Detail → Cart → Checkout (with coupons) → Payment → Auto‑enroll → Invoice → Thank you. Reuses existing `coupons`, `invoices`, `enrollments`, `student_bundles`, `enroll_student_in_bundle` — no destructive schema changes.

## 1. Backend (single migration)

Additions only — existing tables untouched:

- `carts` (user_id unique, workspace_id) + `cart_items` (cart_id, product_type `course|bundle`, product_id, unit_price, added_at). RLS: owner only.
- `orders` (order_number auto, user_id, workspace_id, subtotal, discount, tax, total, currency, status `pending|paid|failed|refunded`, coupon_id, billing snapshot jsonb, gateway, gateway_ref, invoice_id). Sequence trigger for order_number (FAAT-ORD-YYYY-000001).
- `order_items` (order_id, product_type, product_id, title snapshot, unit_price, quantity=1, line_total).
- `coupon_redemptions` (coupon_id, user_id, order_id) — enforces per-user limits.
- RPCs:
  - `public.validate_coupon(code, user_id, cart jsonb)` → returns `{ valid, discount, reason, coupon }`. Checks active, expiry, max usage, per-user limit, min order, product/bundle scope.
  - `public.checkout_create_order(cart jsonb, coupon_code, billing jsonb)` → creates order + items in `pending`.
  - `public.checkout_complete_order(order_id, gateway_ref)` → marks paid, enrolls student in each course/bundle (uses `enroll_student_in_bundle` + inserts into `enrollments`), increments coupon usage, writes `coupon_redemptions`, generates invoice row (reuses existing invoice trigger/sequence), returns `{ order, invoice }`.
- GRANTs + RLS per project convention (authenticated CRUD own rows; admins via `has_role`).

## 2. Services (frontend)

`src/modules/commerce/`:
- `cartService.ts` — get/add/remove/clear, merges guest localStorage cart on login.
- `couponService.ts` — `validate(code, cart)` via RPC.
- `orderService.ts` — create/complete order, list my orders, admin list.
- `useCart.tsx` (Zustand or context) — global cart state, badge count in header.

## 3. Pages / routes

- `/courses/:slug` (redesign `CourseDetailPage.tsx`):
  - Sticky purchase card: price, original price, savings %, offer badge, **Buy Now**, **Add to Cart**, Wishlist, Share, trust badges (secure/lifetime/certificate/refund), countdown for limited offers.
  - Mobile sticky bottom bar with price + Buy Now / Add to Cart.
  - Sections: Frequently Bought Together, Upgrade to Bundle (if course belongs to a bundle), Related Courses, Reviews / social proof.
  - Move coupon UI OUT of detail page → into checkout.
- `/cart` (new `CartPage.tsx`) — line items, remove/quantity(=1), subtotal, GST estimate, coupon hint, "Proceed to Checkout" / "Continue Shopping".
- `/checkout` (rebuild) — Billing form (reuse `BillingAddressForm`), order summary, **Coupon input with live validation**, GST breakdown, payment method, T&C, "Complete Purchase". Buy Now passes `?buyNow=<type>:<id>` to skip cart.
- `/orders/thank-you/:orderId` — success + invoice download + "Go to My Courses".
- Student dashboard `/app/orders` — order history + invoice download.
- Admin `/app/marketing/coupons` — CRUD for coupons (code, type %/flat/free, value, expiry, max usage, per-user limit, min order, scope: all/course/bundle). Reuses existing `coupons` table.
- Admin `/app/orders` — orders list with customer, product, coupon, payment, GST, invoice, refund, enrollment status.

## 4. Navigation & header

- Cart icon with item count in public site header.
- Route registrations in `App.tsx`, admin sidebar entry for Marketing → Coupons and Orders.

## 5. Non‑goals for this pass

- No new payment gateway integration — keep the current provider hook; `checkout_complete_order` is called on the existing success callback.
- No wishlist persistence beyond localStorage (button present).
- Reviews section uses existing rating data only.

## Technical notes

- Guest cart in `localStorage['faatpro_cart']`; merged into `carts` on login via `cartService.mergeGuestCart()`.
- Coupon validation runs on Apply and again server-side inside `checkout_create_order` (source of truth).
- Price snapshotting: `order_items.unit_price` frozen at order creation to protect against course price changes.
- Bundle enrollment reuses `enroll_student_in_bundle`; course enrollment inserts into `enrollments` with `source='purchase'`.
- Invoice generation reuses existing `invoices` + sequence trigger; order stores `invoice_id`.
- SEO/Helmet on detail page kept; JSON-LD `Product` + `Offer` added.

Approve to proceed — I will start with the migration, then services, then pages in that order.

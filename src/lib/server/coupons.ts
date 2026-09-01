import type { PoolClient } from "pg";
import { getPool } from "./db";

/**
 * Coupon validation + redemption (plan.md §37). `validateCoupon` is the one
 * place a code is checked and a discount is computed — routes never trust a
 * client-supplied discount (§27). The redemption row is written inside the
 * booking transaction.
 */

export interface CouponApplication {
  couponId: number;
  code: string;
  discountType: "percent" | "flat";
  /** Discount computed for the subtotal passed to validateCoupon. */
  discountAmount: number;
}

export type CouponResult =
  | { ok: true; coupon: CouponApplication }
  | { ok: false; reason: string };

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

/**
 * @param userId  omit / null to skip the per-user limit (e.g. a public quote
 *                preview); the real limit is enforced at booking time.
 */
export async function validateCoupon(
  rawCode: string,
  subtotal: number,
  userId?: string | null,
): Promise<CouponResult> {
  const code = (rawCode ?? "").trim().toUpperCase();
  if (!code) return { ok: false, reason: "Enter a discount code." };

  const pool = getPool();
  const c = (
    await pool.query(
      `SELECT coupon_id, code, discount_type, discount_value, max_discount,
              min_booking_amount, usage_limit, per_user_limit, starts_at, expires_at
         FROM coupons
        WHERE upper(code) = $1 AND is_deleted = false AND is_active = true`,
      [code],
    )
  ).rows[0];
  if (!c) return { ok: false, reason: "That code isn't valid." };

  const now = new Date();
  if (c.starts_at && new Date(c.starts_at) > now) {
    return { ok: false, reason: "This code isn't active yet." };
  }
  if (c.expires_at && new Date(c.expires_at) < now) {
    return { ok: false, reason: "This code has expired." };
  }
  if (subtotal < Number(c.min_booking_amount)) {
    return {
      ok: false,
      reason: `Spend at least ${inr(Number(c.min_booking_amount))} to use this code.`,
    };
  }

  if (c.usage_limit != null) {
    const total = (
      await pool.query(
        "SELECT count(*)::int AS n FROM coupon_redemptions WHERE coupon_id = $1",
        [c.coupon_id],
      )
    ).rows[0].n as number;
    if (total >= c.usage_limit) {
      return { ok: false, reason: "This code has been fully redeemed." };
    }
  }

  if (userId) {
    const mine = (
      await pool.query(
        "SELECT count(*)::int AS n FROM coupon_redemptions WHERE coupon_id = $1 AND user_id = $2",
        [c.coupon_id, userId],
      )
    ).rows[0].n as number;
    if (mine >= c.per_user_limit) {
      return { ok: false, reason: "You've already used this code." };
    }
  }

  let discount =
    c.discount_type === "percent"
      ? subtotal * (Number(c.discount_value) / 100)
      : Number(c.discount_value);
  if (c.max_discount != null) discount = Math.min(discount, Number(c.max_discount));
  discount = round2(Math.min(Math.max(discount, 0), subtotal));

  return {
    ok: true,
    coupon: {
      couponId: c.coupon_id,
      code: c.code,
      discountType: c.discount_type,
      discountAmount: discount,
    },
  };
}

/** Write the redemption row — call inside the booking transaction. */
export async function recordRedemption(
  client: PoolClient,
  couponId: number,
  bookingId: string,
  userId: string,
  amount: number,
): Promise<void> {
  await client.query(
    `INSERT INTO coupon_redemptions (coupon_id, booking_id, user_id, amount)
     VALUES ($1, $2, $3, $4)`,
    [couponId, bookingId, userId, amount],
  );
}

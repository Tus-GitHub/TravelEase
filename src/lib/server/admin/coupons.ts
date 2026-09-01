import { getPool } from "../db";
import { applyPartialUpdate, softDelete } from "./_util";

/**
 * Admin CRUD for coupons (chunk 2.3). Customer-side validate/redeem lives in
 * `src/lib/server/coupons.ts`.
 */

export type DiscountType = "percent" | "flat";

export interface AdminCoupon {
  id: number;
  code: string;
  description: string;
  discountType: DiscountType;
  discountValue: number;
  maxDiscount: number | null;
  minBookingAmount: number;
  usageLimit: number | null;
  perUserLimit: number;
  startsAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
  redemptions: number;
}

interface Row {
  coupon_id: number;
  code: string;
  description: string | null;
  discount_type: DiscountType;
  discount_value: string;
  max_discount: string | null;
  min_booking_amount: string;
  usage_limit: number | null;
  per_user_limit: number;
  starts_at: Date | null;
  expires_at: Date | null;
  is_active: boolean;
  redemptions: number;
}

function toCoupon(r: Row): AdminCoupon {
  return {
    id: r.coupon_id,
    code: r.code,
    description: r.description ?? "",
    discountType: r.discount_type,
    discountValue: Number(r.discount_value),
    maxDiscount: r.max_discount != null ? Number(r.max_discount) : null,
    minBookingAmount: Number(r.min_booking_amount),
    usageLimit: r.usage_limit,
    perUserLimit: r.per_user_limit,
    startsAt: r.starts_at ? new Date(r.starts_at).toISOString() : null,
    expiresAt: r.expires_at ? new Date(r.expires_at).toISOString() : null,
    isActive: r.is_active,
    redemptions: Number(r.redemptions),
  };
}

const SELECT = `
  SELECT c.coupon_id, c.code, c.description, c.discount_type, c.discount_value,
         c.max_discount, c.min_booking_amount, c.usage_limit, c.per_user_limit,
         c.starts_at, c.expires_at, c.is_active,
         (SELECT count(*) FROM coupon_redemptions cr WHERE cr.coupon_id = c.coupon_id) AS redemptions
  FROM coupons c
`;

export async function listCoupons(): Promise<AdminCoupon[]> {
  const r = await getPool().query(
    `${SELECT} WHERE c.is_deleted = false ORDER BY c.created_at DESC`,
  );
  return r.rows.map(toCoupon);
}

async function getCoupon(id: number): Promise<AdminCoupon | null> {
  const r = await getPool().query(
    `${SELECT} WHERE c.coupon_id = $1 AND c.is_deleted = false`,
    [id],
  );
  return r.rows[0] ? toCoupon(r.rows[0]) : null;
}

export interface CouponInput {
  code: string;
  description?: string;
  discountType: DiscountType;
  discountValue: number;
  maxDiscount?: number | null;
  minBookingAmount?: number;
  usageLimit?: number | null;
  perUserLimit?: number;
  startsAt?: string | null;
  expiresAt?: string | null;
}

export type CreateResult =
  | { ok: true; coupon: AdminCoupon }
  | { ok: false; message: string };

export async function createCoupon(
  input: CouponInput,
  actorId: string,
): Promise<CreateResult> {
  const code = (input.code ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,40}$/.test(code)) {
    return { ok: false, message: "Code must be 3–40 chars: letters, digits, - or _." };
  }
  if (input.discountType !== "percent" && input.discountType !== "flat") {
    return { ok: false, message: "Discount type must be 'percent' or 'flat'." };
  }
  const value = Number(input.discountValue);
  if (!Number.isFinite(value) || value <= 0) {
    return { ok: false, message: "Discount value must be a positive number." };
  }
  if (input.discountType === "percent" && value > 100) {
    return { ok: false, message: "A percent discount can't exceed 100." };
  }

  try {
    const r = await getPool().query(
      `INSERT INTO coupons
         (code, description, discount_type, discount_value, max_discount,
          min_booking_amount, usage_limit, per_user_limit, starts_at, expires_at,
          created_by, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11)
       RETURNING coupon_id`,
      [
        code,
        input.description?.trim() || null,
        input.discountType,
        value,
        input.maxDiscount != null ? Number(input.maxDiscount) : null,
        Number(input.minBookingAmount) || 0,
        input.usageLimit != null ? Math.floor(Number(input.usageLimit)) : null,
        input.perUserLimit != null ? Math.max(1, Math.floor(Number(input.perUserLimit))) : 1,
        input.startsAt || null,
        input.expiresAt || null,
        actorId,
      ],
    );
    return { ok: true, coupon: (await getCoupon(r.rows[0].coupon_id))! };
  } catch (err) {
    if ((err as { code?: string }).code === "23505") {
      return { ok: false, message: "A coupon with that code already exists." };
    }
    throw err;
  }
}

const COLUMNS = {
  description: "description",
  discountValue: "discount_value",
  maxDiscount: "max_discount",
  minBookingAmount: "min_booking_amount",
  usageLimit: "usage_limit",
  perUserLimit: "per_user_limit",
  startsAt: "starts_at",
  expiresAt: "expires_at",
  isActive: "is_active",
} as const;

export async function updateCoupon(
  id: number,
  input: Partial<CouponInput & { isActive: boolean }>,
  actorId: string,
): Promise<AdminCoupon | null> {
  const ok = await applyPartialUpdate("coupons", "coupon_id", id, input, COLUMNS, actorId);
  return ok ? getCoupon(id) : null;
}

export function deleteCoupon(id: number, actorId: string): Promise<boolean> {
  return softDelete("coupons", "coupon_id", id, actorId);
}

import type { PoolClient } from "pg";
import { getPool } from "./db";
import { calculateRefund, type CancelInitiator } from "@/lib/refund";

/**
 * Refund records (chunk 2.5, plan.md §7). A row is created when a *paid*
 * (Confirmed/Ongoing) booking is cancelled — the amount comes from the §7
 * tiers. Payment is offline, so an admin settles it by hand.
 */

export type RefundStatus = "pending" | "paid" | "waived";

export interface RefundView {
  id: string;
  bookingId: string;
  amount: number;
  chargeAmount: number;
  tier: string;
  reason: string | null;
  status: RefundStatus;
  method: string | null;
  reference: string | null;
  createdAt: string;
}

interface Row {
  refund_id: string;
  booking_id: string;
  amount: string;
  charge_amount: string;
  tier: string;
  reason: string | null;
  status: RefundStatus;
  method: string | null;
  reference: string | null;
  created_at: Date;
}

function toView(r: Row): RefundView {
  return {
    id: r.refund_id,
    bookingId: r.booking_id,
    amount: Number(r.amount),
    chargeAmount: Number(r.charge_amount),
    tier: r.tier,
    reason: r.reason,
    status: r.status,
    method: r.method,
    reference: r.reference,
    createdAt: new Date(r.created_at).toISOString(),
  };
}

/**
 * Create the refund row for a cancellation — call inside the transitionBooking
 * transaction. Idempotent-ish: `UNIQUE(booking_id)` means a second call throws
 * 23505; the caller only invokes this on the first Confirmed/Ongoing→Cancelled.
 */
export async function createCancellationRefund(
  client: PoolClient,
  args: {
    bookingId: string;
    totalAmount: number;
    pickupAt: Date;
    initiatedBy: CancelInitiator;
    actorId: string;
  },
): Promise<RefundView> {
  const calc = calculateRefund({
    totalAmount: args.totalAmount,
    pickupAt: args.pickupAt,
    initiatedBy: args.initiatedBy,
  });
  const r = await client.query(
    `INSERT INTO refunds
       (booking_id, amount, charge_amount, tier, reason, status, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, 'pending', $6, $6)
     RETURNING *`,
    [args.bookingId, calc.refundAmount, calc.chargeAmount, calc.tier, calc.reason, args.actorId],
  );
  return toView(r.rows[0]);
}

export async function getRefundForBooking(bookingId: string): Promise<RefundView | null> {
  const r = await getPool().query("SELECT * FROM refunds WHERE booking_id = $1", [
    bookingId,
  ]);
  return r.rows[0] ? toView(r.rows[0]) : null;
}

export type SettleResult =
  | { ok: true; refund: RefundView }
  | { ok: false; status: number; message: string };

/** Admin marks a pending refund paid or waived. */
export async function settleRefund(
  bookingId: string,
  input: { status: "paid" | "waived"; method?: string | null; reference?: string | null },
  actorId: string,
): Promise<SettleResult> {
  if (input.status !== "paid" && input.status !== "waived") {
    return { ok: false, status: 400, message: "Status must be 'paid' or 'waived'." };
  }
  const pool = getPool();
  const current = (
    await pool.query("SELECT status FROM refunds WHERE booking_id = $1", [bookingId])
  ).rows[0];
  if (!current) {
    return { ok: false, status: 404, message: "No refund is recorded for this booking." };
  }
  if (current.status !== "pending") {
    return { ok: false, status: 409, message: `Refund is already ${current.status}.` };
  }
  const r = await pool.query(
    `UPDATE refunds
        SET status = $1, method = $2, reference = $3, updated_by = $4
      WHERE booking_id = $5
      RETURNING *`,
    [
      input.status,
      input.method?.trim() || null,
      input.reference?.trim() || null,
      actorId,
      bookingId,
    ],
  );
  return { ok: true, refund: toView(r.rows[0]) };
}

/** True when the booking has no outstanding (pending, non-zero) refund. */
export async function refundIsClearForBooking(bookingId: string): Promise<boolean> {
  const r = await getPool().query(
    "SELECT amount, status FROM refunds WHERE booking_id = $1",
    [bookingId],
  );
  const row = r.rows[0];
  if (!row) return true; // nothing owed
  if (Number(row.amount) === 0) return true;
  return row.status !== "pending";
}

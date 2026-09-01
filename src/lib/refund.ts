/**
 * Cancellation refund policy (plan.md §7). ONE pure function — no DB, no HTTP,
 * deterministic, unit-tested. Every refund/charge in the app comes from here so
 * the policy can't drift across routes.
 *
 *   > 72h before pickup   -> free cancellation   (full refund)
 *   24h – 72h before       -> 50% charge          (half refund)
 *   < 24h before           -> no refund
 *   operator-initiated     -> 100% refund, any time
 */

export type CancelInitiator = "customer" | "operator";

export type RefundTier = "free" | "half" | "none" | "operator";

export interface RefundInput {
  /** The booking's paid/owed total, in INR. */
  totalAmount: number;
  /** Trip start (bookings.start_datetime). */
  pickupAt: Date;
  /** Who is cancelling. "operator" = Jagdamba Travellers. */
  initiatedBy: CancelInitiator;
  /** Defaults to now — injectable for tests. */
  now?: Date;
}

export interface RefundResult {
  refundAmount: number;
  chargeAmount: number;
  tier: RefundTier;
  hoursBeforePickup: number;
  reason: string;
}

function money(n: number): number {
  return Math.round((Math.max(0, n) + Number.EPSILON) * 100) / 100;
}

export function calculateRefund(input: RefundInput): RefundResult {
  const total = Math.max(
    0,
    typeof input.totalAmount === "number" && Number.isFinite(input.totalAmount)
      ? input.totalAmount
      : 0,
  );
  const now = input.now ?? new Date();
  const hours =
    Math.round(((input.pickupAt.getTime() - now.getTime()) / 3_600_000) * 100) / 100;

  let tier: RefundTier;
  let refundFraction: number;
  let reason: string;

  if (input.initiatedBy === "operator") {
    tier = "operator";
    refundFraction = 1;
    reason = "Cancelled by Jagdamba Travellers — full refund.";
  } else if (hours > 72) {
    tier = "free";
    refundFraction = 1;
    reason = "Cancelled more than 72 hours before pickup — free cancellation.";
  } else if (hours >= 24) {
    tier = "half";
    refundFraction = 0.5;
    reason = "Cancelled 24–72 hours before pickup — 50% charge applies.";
  } else {
    tier = "none";
    refundFraction = 0;
    reason = "Cancelled less than 24 hours before pickup — no refund.";
  }

  const refundAmount = money(total * refundFraction);
  const chargeAmount = money(total - refundAmount);

  return { refundAmount, chargeAmount, tier, hoursBeforePickup: hours, reason };
}

/**
 * Unified pricing engine (plan.md §6). ONE pure function prices all five booking
 * types — no database, no HTTP, deterministic, unit-tested. Every rate comes from
 * the resolved `PricingRule` (config, plan.md §19); the booking type only selects
 * which components apply. Never price a booking from a client-supplied total —
 * the server calls this and recomputes.
 *
 * Worked examples it must reproduce (plan.md §5):
 *   hourly:  500 + 250×8 + 15 extra km × 18  = 2770  + 5% GST 138.50 = 2908.50
 *   package: 4500×5 + 500×5 + 300×4          = 26200 + 5% GST 1310   = 27510
 */

export type BookingTypeCode =
  | "point_to_point"
  | "hourly"
  | "outstation"
  | "package"
  | "airport_transfer";

/** Flat view of one `pricing_rules` row — all money in INR. */
export interface PricingRuleInput {
  baseAmount: number;
  perKmRate: number;
  perHourRate: number;
  includedKm: number;
  extraKmRate: number;
  perDayRate: number;
  driverAllowancePerDay: number;
  nightCharge: number;
  flatRate: number;
  taxPercent: number;
  minHours: number | null;
  minKm: number | null;
}

/** Normalized trip facts. Distances in km, durations in whole units. */
export interface TripInput {
  bookingType: BookingTypeCode;
  distanceKm?: number;
  hours?: number;
  days?: number;
  nights?: number;
  passengers?: number;
  /** Set when a curated package is sold per person — overrides the per-day math. */
  packagePricePerPerson?: number;
  /** Coupons etc. (Phase 2). Clamped to the subtotal. */
  discountAmount?: number;
}

export interface PriceLine {
  label: string;
  amount: number;
}

export interface PriceBreakdown {
  baseAmount: number;
  vehicleAmount: number;
  driverAllowance: number;
  nightCharges: number;
  extraKmCharges: number;
  packageAmount: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  currency: "INR";
  breakdown: PriceLine[];
}

/** Round to paise (2dp), avoiding binary-float drift like 138.49999999. */
function money(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Non-negative finite number, else 0. */
function num(n: number | undefined | null): number {
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : 0;
}

export function calculatePrice(
  trip: TripInput,
  rule: PricingRuleInput,
): PriceBreakdown {
  const distanceKm = num(trip.distanceKm);
  const hours = num(trip.hours);
  const days = Math.max(1, Math.floor(num(trip.days)) || 1);
  const nights = Math.floor(num(trip.nights));
  const passengers = Math.max(1, Math.floor(num(trip.passengers)) || 1);

  let baseAmount = 0;
  let vehicleAmount = 0;
  let driverAllowance = 0;
  let nightCharges = 0;
  let extraKmCharges = 0;
  let packageAmount = 0;

  switch (trip.bookingType) {
    case "airport_transfer": {
      vehicleAmount =
        rule.flatRate > 0 ? rule.flatRate : rule.perKmRate * distanceKm;
      break;
    }
    case "point_to_point": {
      baseAmount = rule.baseAmount;
      const km = Math.max(distanceKm, num(rule.minKm));
      vehicleAmount = rule.flatRate > 0 ? rule.flatRate : rule.perKmRate * km;
      break;
    }
    case "hourly": {
      baseAmount = rule.baseAmount;
      const billedHours = Math.max(hours, num(rule.minHours));
      vehicleAmount = rule.perHourRate * billedHours;
      const extraKm = Math.max(0, distanceKm - rule.includedKm);
      extraKmCharges = extraKm * rule.extraKmRate;
      break;
    }
    case "outstation": {
      baseAmount = rule.baseAmount;
      const km = Math.max(distanceKm, num(rule.minKm));
      vehicleAmount = rule.perKmRate * km;
      driverAllowance = rule.driverAllowancePerDay * days;
      nightCharges = rule.nightCharge * nights;
      break;
    }
    case "package": {
      if (num(trip.packagePricePerPerson) > 0) {
        packageAmount = (trip.packagePricePerPerson as number) * passengers;
      } else {
        vehicleAmount = rule.perDayRate * days;
        driverAllowance = rule.driverAllowancePerDay * days;
        nightCharges = rule.nightCharge * (nights || Math.max(0, days - 1));
      }
      break;
    }
  }

  baseAmount = money(baseAmount);
  vehicleAmount = money(vehicleAmount);
  driverAllowance = money(driverAllowance);
  nightCharges = money(nightCharges);
  extraKmCharges = money(extraKmCharges);
  packageAmount = money(packageAmount);

  const subtotal =
    baseAmount +
    vehicleAmount +
    driverAllowance +
    nightCharges +
    extraKmCharges +
    packageAmount;

  const discountAmount = money(Math.min(num(trip.discountAmount), subtotal));
  const taxable = subtotal - discountAmount;
  const taxPercent = Math.min(Math.max(num(rule.taxPercent), 0), 100);
  const taxAmount = money((taxable * taxPercent) / 100);
  const totalAmount = money(taxable + taxAmount);

  const breakdown: PriceLine[] = [];
  if (baseAmount) breakdown.push({ label: "Base fare", amount: baseAmount });
  if (vehicleAmount)
    breakdown.push({
      label: trip.bookingType === "package" ? "Vehicle (per day)" : "Vehicle charge",
      amount: vehicleAmount,
    });
  if (packageAmount)
    breakdown.push({ label: "Package price", amount: packageAmount });
  if (driverAllowance)
    breakdown.push({ label: "Driver allowance", amount: driverAllowance });
  if (nightCharges)
    breakdown.push({ label: "Night charges", amount: nightCharges });
  if (extraKmCharges)
    breakdown.push({ label: "Extra distance", amount: extraKmCharges });
  if (discountAmount)
    breakdown.push({ label: "Discount", amount: -discountAmount });
  if (taxAmount)
    breakdown.push({ label: `Tax (${taxPercent}% GST)`, amount: taxAmount });

  return {
    baseAmount,
    vehicleAmount,
    driverAllowance,
    nightCharges,
    extraKmCharges,
    packageAmount,
    discountAmount,
    taxAmount,
    totalAmount,
    currency: "INR",
    breakdown,
  };
}

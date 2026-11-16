import { getPool } from "./db";
import { PER_PERSON_PACKAGE_RULE, type BookingTypeCode, type PricingRuleInput } from "./pricing";
import { bookingTimeValue } from "../booking-datetime";

/**
 * DB side of pricing (plan.md §19). Resolves a config row for the pure engine in
 * `pricing.ts` — this module talks to the database, that one never does.
 */

export async function resolveBookingTypeId(
  code: BookingTypeCode,
): Promise<number | null> {
  const r = await getPool().query(
    "SELECT booking_type_id FROM booking_types WHERE code = $1",
    [code],
  );
  return r.rows[0]?.booking_type_id ?? null;
}

/**
 * Picks the applicable pricing rule: a vehicle-type-specific rule beats the
 * NULL catch-all, then highest `priority` wins, within the effective-date window
 * and excluding soft-deleted / inactive rows. Null when nothing matches.
 */
export async function resolvePricingRule(
  bookingTypeId: number,
  vehicleTypeId: number | null,
  vehicleId: number | null = null,
  tripDate?: Date,
): Promise<PricingRuleInput | null> {
  const r = await getPool().query(
    `SELECT base_amount, per_km_rate, per_hour_rate, included_km, extra_km_rate,
            per_day_rate, driver_allowance_per_day, night_charge, flat_rate,
            tax_percent, min_hours, min_km, vehicle_id,
            empty_return_enabled, empty_return_per_km_rate
       FROM pricing_rules
      WHERE booking_type_id = $1
        AND (vehicle_id = $3 OR (vehicle_id IS NULL AND (vehicle_type_id = $2 OR vehicle_type_id IS NULL)))
        AND is_deleted = false AND is_active = true
        AND (effective_from IS NULL OR effective_from <= COALESCE($4::date, CURRENT_DATE))
        AND (effective_to   IS NULL OR effective_to   >= COALESCE($4::date, CURRENT_DATE))
      ORDER BY (vehicle_id IS NOT NULL) DESC, (vehicle_type_id IS NOT NULL) DESC, priority DESC, pricing_rule_id ASC
      LIMIT 1`,
    [bookingTypeId, vehicleTypeId, vehicleId, bookingTimeValue(tripDate??new Date()).slice(0,10)],
  );
  const row = r.rows[0];
  if (!row) return null;

  // NUMERIC comes back from pg as a string.
  return {
    emptyReturnEnabled: row.vehicle_id != null && row.vehicle_id === vehicleId && row.empty_return_enabled === true,
    emptyReturnPerKmRate: Number(row.empty_return_per_km_rate),
    baseAmount: Number(row.base_amount),
    perKmRate: Number(row.per_km_rate),
    perHourRate: Number(row.per_hour_rate),
    includedKm: Number(row.included_km),
    extraKmRate: Number(row.extra_km_rate),
    perDayRate: Number(row.per_day_rate),
    driverAllowancePerDay: Number(row.driver_allowance_per_day),
    nightCharge: Number(row.night_charge),
    flatRate: Number(row.flat_rate),
    taxPercent: Number(row.tax_percent),
    minHours: row.min_hours != null ? Number(row.min_hours) : null,
    minKm: row.min_km != null ? Number(row.min_km) : null,
  };
}

/** A self-built itinerary can use the selected car’s existing admin-set day rate.
 * Configured package rules and curated per-person package prices take precedence. */
export async function resolveVehicleDailyRule(vehicleId: number): Promise<PricingRuleInput | null> {
  const row = (await getPool().query(`SELECT v.base_price_per_day FROM vehicles v JOIN vehicle_types t USING(vehicle_type_id)
    WHERE v.vehicle_id=$1 AND v.is_active AND NOT v.is_deleted AND v.is_available AND t.is_active AND NOT t.is_deleted`, [vehicleId])).rows[0];
  const amount = Number(row?.base_price_per_day);
  return Number.isFinite(amount) && amount > 0 ? { ...PER_PERSON_PACKAGE_RULE, perDayRate: amount } : null;
}

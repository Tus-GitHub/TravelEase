import test from "node:test";
import assert from "node:assert/strict";
import { calculatePrice, type PricingRuleInput } from "../../src/lib/server/pricing";
import { tripDuration } from "../../src/lib/booking-duration";
const rule: PricingRuleInput = { baseAmount: 100, perKmRate: 18, perHourRate: 100, includedKm: 0, extraKmRate: 0,
  perDayRate: 1000, driverAllowancePerDay: 200, nightCharge: 100, flatRate: 0, taxPercent: 5, minHours: null, minKm: 20,
  emptyReturnEnabled: true, emptyReturnPerKmRate: 9 };
test("one-way fares expose actual empty-return distance/rate before tax and discounts", () => {
  const quote = calculatePrice({ bookingType: "point_to_point", distanceKm: 12, emptyReturnKm: 15, discountAmount: 50 }, rule);
  assert.equal(quote.emptyReturnAmount, 135);
  assert.equal(quote.subtotal, 100 + 20 * 18 + 15 * 9);
  assert.equal(quote.taxAmount, 27.25); assert.equal(quote.totalAmount, 572.25);
  assert(quote.breakdown.some(line => line.label === "Empty vehicle return (15 km × ₹9/km)" && line.amount === 135));
});
test("a flat airport fare can add a separately configured actual reverse-road fare", () => {
  const quote = calculatePrice({ bookingType: "airport_transfer", distanceKm: 12, emptyReturnKm: 15 }, { ...rule, flatRate: 500 });
  assert.equal(quote.vehicleAmount, 500); assert.equal(quote.emptyReturnAmount, 135); assert.equal(quote.totalAmount, 666.75);
});
test("disabled policy and customer round trips never add an empty return", () => {
  assert.equal(calculatePrice({ bookingType: "point_to_point", distanceKm: 12, emptyReturnKm: 15 }, { ...rule, emptyReturnEnabled: false }).emptyReturnAmount, undefined);
  for (const bookingType of ["outstation", "package", "hourly"] as const) {
    assert.equal(calculatePrice({ bookingType, distanceKm: 24, emptyReturnKm: 15, days: 3, nights: 2 }, rule).emptyReturnAmount, undefined);
  }
});
test("return duration follows Indian calendar dates and rejects invalid or unbounded returns", () => {
  assert.deepEqual(tripDuration("2026-11-20T03:30:00Z", "2026-11-20T14:30:00Z"), { days: 1, nights: 0 });
  assert.deepEqual(tripDuration("2026-11-20T18:00:00Z", "2026-11-20T19:00:00Z"), { days: 2, nights: 1 });
  assert.deepEqual(tripDuration("2026-11-20T03:30:00Z", "2026-11-22T14:30:00Z"), { days: 3, nights: 2 });
  for (const end of ["", "invalid", "2026-11-20T03:30:00Z", "2026-11-19T03:30:00Z", "2027-11-20T03:30:00Z"]) assert.throws(() => tripDuration("2026-11-20T03:30:00Z", end));
});

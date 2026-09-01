/*
 * Unit tests for the pure pricing engine (src/lib/server/pricing.ts, plan.md §5/§6).
 * No DB — just the function. Same lightweight style as db-crud.test.ts (no framework).
 *
 * Run:  npm run test:pricing
 * or:   node --experimental-strip-types db/tests/pricing.test.ts
 */
import {
  calculatePrice,
  type PricingRuleInput,
  type TripInput,
} from "../../src/lib/server/pricing.ts";

let passed = 0;
let failed = 0;

function check(label: string, cond: boolean, detail = "") {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}
function eq(label: string, actual: number, expected: number) {
  check(label, actual === expected, `expected ${expected}, got ${actual}`);
}

/** A zeroed rule; tests set only the fields they exercise. */
function rule(over: Partial<PricingRuleInput>): PricingRuleInput {
  return {
    baseAmount: 0,
    perKmRate: 0,
    perHourRate: 0,
    includedKm: 0,
    extraKmRate: 0,
    perDayRate: 0,
    driverAllowancePerDay: 0,
    nightCharge: 0,
    flatRate: 0,
    taxPercent: 0,
    minHours: null,
    minKm: null,
    ...over,
  };
}
function trip(over: Partial<TripInput> & { bookingType: TripInput["bookingType"] }): TripInput {
  return over;
}

// ── 1. Hourly worked example (plan.md §5) ────────────────────────────────────
{
  const r = calculatePrice(
    trip({ bookingType: "hourly", hours: 8, distanceKm: 95 }),
    rule({ baseAmount: 500, perHourRate: 250, includedKm: 80, extraKmRate: 18, taxPercent: 5 }),
  );
  eq("hourly: base", r.baseAmount, 500);
  eq("hourly: vehicle (250×8)", r.vehicleAmount, 2000);
  eq("hourly: extra km (15×18)", r.extraKmCharges, 270);
  eq("hourly: tax (5% of 2770)", r.taxAmount, 138.5);
  eq("hourly: total", r.totalAmount, 2908.5);
  check("hourly: no driver line", r.driverAllowance === 0);
  check(
    "hourly: breakdown labels",
    r.breakdown.map((l) => l.label).join("|") ===
      "Base fare|Vehicle charge|Extra distance|Tax (5% GST)",
    r.breakdown.map((l) => l.label).join("|"),
  );
}

// ── 2. Multi-day package worked example (plan.md §5) ─────────────────────────
{
  const r = calculatePrice(
    trip({ bookingType: "package", days: 5, nights: 4 }),
    rule({ perDayRate: 4500, driverAllowancePerDay: 500, nightCharge: 300, taxPercent: 5 }),
  );
  eq("package: vehicle (4500×5)", r.vehicleAmount, 22500);
  eq("package: driver (500×5)", r.driverAllowance, 2500);
  eq("package: nights (300×4)", r.nightCharges, 1200);
  eq("package: tax (5% of 26200)", r.taxAmount, 1310);
  eq("package: total", r.totalAmount, 27510);
}

// ── 3. Package sold per person ──────────────────────────────────────────────
{
  const r = calculatePrice(
    trip({ bookingType: "package", passengers: 4, packagePricePerPerson: 8999, days: 5 }),
    rule({ perDayRate: 4500, driverAllowancePerDay: 500, taxPercent: 5 }),
  );
  eq("per-person: packageAmount (8999×4)", r.packageAmount, 35996);
  check("per-person: no per-day vehicle charge", r.vehicleAmount === 0 && r.driverAllowance === 0);
  eq("per-person: total", r.totalAmount, 37795.8);
}

// ── 4. Airport transfer — flat ─────────────────────────────────────────────
{
  const r = calculatePrice(
    trip({ bookingType: "airport_transfer", distanceKm: 40 }),
    rule({ flatRate: 1200, perKmRate: 14, taxPercent: 5 }),
  );
  eq("airport: flat wins over per-km", r.vehicleAmount, 1200);
  eq("airport: total", r.totalAmount, 1260);
}

// ── 5. Point-to-point — per-km, and flat override ──────────────────────────
{
  const perKm = calculatePrice(
    trip({ bookingType: "point_to_point", distanceKm: 250 }),
    rule({ perKmRate: 14, taxPercent: 5 }),
  );
  eq("p2p: per-km (14×250)", perKm.vehicleAmount, 3500);
  eq("p2p: total", perKm.totalAmount, 3675);

  const flat = calculatePrice(
    trip({ bookingType: "point_to_point", distanceKm: 250 }),
    rule({ perKmRate: 14, flatRate: 2000, taxPercent: 5 }),
  );
  eq("p2p: flat overrides per-km", flat.vehicleAmount, 2000);
}

// ── 6. Outstation ─────────────────────────────────────────────────────────
{
  const r = calculatePrice(
    trip({ bookingType: "outstation", distanceKm: 600, days: 3, nights: 2 }),
    rule({
      perKmRate: 13,
      driverAllowancePerDay: 500,
      nightCharge: 300,
      minKm: 250,
      taxPercent: 5,
    }),
  );
  eq("outstation: vehicle (13×600)", r.vehicleAmount, 7800);
  eq("outstation: driver (500×3)", r.driverAllowance, 1500);
  eq("outstation: nights (300×2)", r.nightCharges, 600);
  eq("outstation: total (9900 + 5%)", r.totalAmount, 10395);
}

// ── 7. minHours / minKm floors ───────────────────────────────────────────
{
  const h = calculatePrice(
    trip({ bookingType: "hourly", hours: 2 }),
    rule({ perHourRate: 250, minHours: 4 }),
  );
  eq("minHours floors billed hours to 4", h.vehicleAmount, 1000);

  const k = calculatePrice(
    trip({ bookingType: "point_to_point", distanceKm: 100 }),
    rule({ perKmRate: 14, minKm: 250 }),
  );
  eq("minKm floors distance to 250", k.vehicleAmount, 3500);
}

// ── 8. Discount is clamped to the subtotal ───────────────────────────────
{
  const r = calculatePrice(
    trip({ bookingType: "airport_transfer", discountAmount: 9999 }),
    rule({ flatRate: 1200, taxPercent: 5 }),
  );
  eq("discount clamped to subtotal", r.discountAmount, 1200);
  eq("clamped discount -> total 0", r.totalAmount, 0);
  eq("clamped discount -> tax 0", r.taxAmount, 0);
}

// ── 9. Negative / NaN inputs are treated as zero ─────────────────────────
{
  const r = calculatePrice(
    trip({ bookingType: "point_to_point", distanceKm: -50 }),
    rule({ perKmRate: 14, baseAmount: 100 }),
  );
  eq("negative distance -> 0 km", r.vehicleAmount, 0);
  eq("base still applies", r.baseAmount, 100);
}

// ── 10. Deterministic ───────────────────────────────────────────────────
{
  const args = () =>
    calculatePrice(
      trip({ bookingType: "outstation", distanceKm: 437, days: 2, nights: 1 }),
      rule({ perKmRate: 12.5, driverAllowancePerDay: 450, nightCharge: 275, taxPercent: 5 }),
    );
  check("same inputs -> identical output", JSON.stringify(args()) === JSON.stringify(args()));
}

console.log(`\npricing engine: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);

/*
 * Unit tests for the cancellation refund policy (src/lib/refund.ts, plan.md §7).
 * Pure - no DB. Same no-framework style as the other db/tests.
 *
 * Run:  npm run test:refund
 */
import { calculateRefund, type RefundInput } from "../../src/lib/refund.ts";

let passed = 0;
let failed = 0;
function check(label: string, cond: boolean, detail = "") {
  if (cond) passed++;
  else {
    failed++;
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}
function eq(label: string, a: number, b: number) {
  check(label, a === b, `expected ${b}, got ${a}`);
}

const NOW = new Date("2026-09-02T12:00:00Z");
const hoursOut = (h: number) => new Date(NOW.getTime() + h * 3_600_000);
const run = (over: Partial<RefundInput>) =>
  calculateRefund({
    totalAmount: 10000,
    pickupAt: hoursOut(100),
    initiatedBy: "customer",
    now: NOW,
    ...over,
  });

// ── operator-initiated: always 100% ────────────────────────────────────────
{
  const r = run({ initiatedBy: "operator", pickupAt: hoursOut(2) });
  eq("operator @2h: full refund", r.refundAmount, 10000);
  eq("operator @2h: no charge", r.chargeAmount, 0);
  check("operator tier", r.tier === "operator");
}

// ── customer, > 72h: free cancellation ─────────────────────────────────────
{
  const r = run({ pickupAt: hoursOut(100) });
  eq("customer @100h: full refund", r.refundAmount, 10000);
  check("tier free", r.tier === "free");
}
{
  const r = run({ pickupAt: hoursOut(72.5) });
  check("customer @72.5h still free", r.tier === "free" && r.refundAmount === 10000);
}

// ── customer, 24h–72h: 50% ─────────────────────────────────────────────────
{
  const r = run({ pickupAt: hoursOut(72) });
  eq("customer @exactly 72h: half refund", r.refundAmount, 5000);
  eq("customer @exactly 72h: half charge", r.chargeAmount, 5000);
  check("tier half", r.tier === "half");
}
{
  const r = run({ pickupAt: hoursOut(48) });
  eq("customer @48h: half refund", r.refundAmount, 5000);
}
{
  const r = run({ pickupAt: hoursOut(24) });
  check("customer @exactly 24h still half", r.tier === "half" && r.refundAmount === 5000);
}

// ── customer, < 24h: nothing ──────────────────────────────────────────────
{
  const r = run({ pickupAt: hoursOut(23.99) });
  eq("customer @23.99h: no refund", r.refundAmount, 0);
  eq("customer @23.99h: full charge", r.chargeAmount, 10000);
  check("tier none", r.tier === "none");
}
{
  const r = run({ pickupAt: hoursOut(1) });
  check("customer @1h: no refund", r.refundAmount === 0);
}
{
  const r = run({ pickupAt: hoursOut(-5) });
  check("pickup already passed: no refund", r.refundAmount === 0 && r.tier === "none");
}

// ── rounding ─────────────────────────────────────────────────────────────
{
  const r = run({ totalAmount: 2908.5, pickupAt: hoursOut(48) });
  eq("50% of 2908.50 = 1454.25", r.refundAmount, 1454.25);
  eq("charge = 1454.25", r.chargeAmount, 1454.25);
}

// ── guards ──────────────────────────────────────────────────────────────
{
  const r = run({ totalAmount: -500, pickupAt: hoursOut(100) });
  eq("negative total -> 0 refund", r.refundAmount, 0);
  eq("negative total -> 0 charge", r.chargeAmount, 0);
}
{
  const a = run({ totalAmount: 4321, pickupAt: hoursOut(50) });
  const b = run({ totalAmount: 4321, pickupAt: hoursOut(50) });
  check("deterministic", JSON.stringify(a) === JSON.stringify(b));
}
{
  const r = run({ pickupAt: hoursOut(40) });
  check("refund + charge == total", r.refundAmount + r.chargeAmount === 10000);
}

console.log(`\nrefund policy: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);

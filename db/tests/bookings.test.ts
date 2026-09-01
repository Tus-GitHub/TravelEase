/*
 * Unit tests for the booking state machine (src/lib/server/bookings.ts, plan.md §8).
 * Pure functions only — no DB. Same lightweight style as the other db/tests.
 *
 * Run:  npm run test:bookings
 */
import {
  canTransition,
  allowedTransitions,
  type BookingStatus,
} from "../../src/lib/bookingStatus.ts";

let passed = 0;
let failed = 0;
function check(label: string, cond: boolean, detail = "") {
  if (cond) passed++;
  else {
    failed++;
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

// ── the 7 legal transitions, each by an actor allowed to do it (plan.md §8) ──
check("Draft -> PendingPayment by customer", canTransition("Draft", "PendingPayment", "customer"));
check("PendingPayment -> Confirmed by admin", canTransition("PendingPayment", "Confirmed", "admin"));
check("PendingPayment -> Confirmed by agent", canTransition("PendingPayment", "Confirmed", "agent"));
check("PendingPayment -> Cancelled by customer", canTransition("PendingPayment", "Cancelled", "customer"));
check("Confirmed -> Ongoing by agent", canTransition("Confirmed", "Ongoing", "agent"));
check("Ongoing -> Completed by admin", canTransition("Ongoing", "Completed", "admin"));
check("Confirmed -> Cancelled by customer", canTransition("Confirmed", "Cancelled", "customer"));
check("Cancelled -> Refunded by admin", canTransition("Cancelled", "Refunded", "admin"));

// ── actor restrictions ──────────────────────────────────────────────────────
check("customer CANNOT confirm (mark paid)", !canTransition("PendingPayment", "Confirmed", "customer"));
check("agent CANNOT refund", !canTransition("Cancelled", "Refunded", "agent"));
check("customer CANNOT refund", !canTransition("Cancelled", "Refunded", "customer"));
check("customer CANNOT start a trip", !canTransition("Confirmed", "Ongoing", "customer"));
check("agent CANNOT cancel a PendingPayment booking", !canTransition("PendingPayment", "Cancelled", "agent"));
check("admin can do every legal transition", (
  ["Draft>PendingPayment", "PendingPayment>Confirmed", "PendingPayment>Cancelled",
   "Confirmed>Ongoing", "Ongoing>Completed", "Confirmed>Cancelled", "Cancelled>Refunded"] as const
).every((pair) => {
  const [from, to] = pair.split(">") as [BookingStatus, BookingStatus];
  return canTransition(from, to, "admin");
}));

// ── illegal transitions ─────────────────────────────────────────────────────
check("no skipping PendingPayment -> Ongoing", !canTransition("PendingPayment", "Ongoing", "admin"));
check("no Completed -> anything", allowedTransitions("Completed", "admin").length === 0);
check("no Refunded -> anything", allowedTransitions("Refunded", "admin").length === 0);
check("no going backwards Confirmed -> PendingPayment", !canTransition("Confirmed", "PendingPayment", "admin"));
check("no Draft -> Confirmed (must pass through PendingPayment)", !canTransition("Draft", "Confirmed", "admin"));
check("same-state is not a transition", !canTransition("Confirmed", "Confirmed", "admin"));

// ── allowedTransitions shape ────────────────────────────────────────────────
check(
  "PendingPayment/admin -> [Confirmed, Cancelled]",
  JSON.stringify(allowedTransitions("PendingPayment", "admin").sort()) ===
    JSON.stringify(["Cancelled", "Confirmed"]),
);
check(
  "PendingPayment/customer -> [Cancelled] only",
  JSON.stringify(allowedTransitions("PendingPayment", "customer")) === JSON.stringify(["Cancelled"]),
);
check(
  "Confirmed/customer -> [Cancelled] only",
  JSON.stringify(allowedTransitions("Confirmed", "customer")) === JSON.stringify(["Cancelled"]),
);
check("system can advance Confirmed -> Ongoing", canTransition("Confirmed", "Ongoing", "system"));
check("system CANNOT confirm payment", !canTransition("PendingPayment", "Confirmed", "system"));

console.log(`\nbooking state machine: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);

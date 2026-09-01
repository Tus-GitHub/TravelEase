/**
 * Booking lifecycle state machine (plan.md §8) — the PURE part, safe to import
 * from client components. The DB-touching `transitionBooking` /
 * `createBooking` / reads live in `src/lib/server/bookings.ts`, which re-exports
 * these.
 */

export type BookingStatus =
  | "Draft"
  | "PendingPayment"
  | "Confirmed"
  | "Ongoing"
  | "Completed"
  | "Cancelled"
  | "Refunded";

/** The acting user's relationship to a specific booking. */
export type BookingActor = "customer" | "agent" | "admin" | "system";

interface TransitionRule {
  from: BookingStatus;
  to: BookingStatus;
  actors: BookingActor[];
}

// "customer" = the booking's owner; "agent" = its assigned agent.
export const TRANSITIONS: TransitionRule[] = [
  { from: "Draft", to: "PendingPayment", actors: ["customer", "agent", "admin", "system"] },
  { from: "PendingPayment", to: "Confirmed", actors: ["agent", "admin"] },
  { from: "PendingPayment", to: "Cancelled", actors: ["customer", "admin", "system"] },
  { from: "Confirmed", to: "Ongoing", actors: ["agent", "admin", "system"] },
  { from: "Ongoing", to: "Completed", actors: ["agent", "admin", "system"] },
  { from: "Confirmed", to: "Cancelled", actors: ["customer", "agent", "admin"] },
  { from: "Cancelled", to: "Refunded", actors: ["admin"] },
];

/** Pure: may `actor` move a booking `from` → `to`? */
export function canTransition(
  from: BookingStatus,
  to: BookingStatus,
  actor: BookingActor,
): boolean {
  return TRANSITIONS.some(
    (t) => t.from === from && t.to === to && t.actors.includes(actor),
  );
}

/** Pure: every status `actor` could move a `from` booking to. */
export function allowedTransitions(
  from: BookingStatus,
  actor: BookingActor,
): BookingStatus[] {
  return TRANSITIONS.filter((t) => t.from === from && t.actors.includes(actor)).map(
    (t) => t.to,
  );
}

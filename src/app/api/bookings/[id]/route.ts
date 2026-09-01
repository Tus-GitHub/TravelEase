import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/auth-guard";
import { getPool } from "@/lib/server/db";
import {
  getBookingForUser,
  transitionBooking,
  type BookingStatus,
} from "@/lib/server/bookings";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STATUSES: BookingStatus[] = [
  "Draft",
  "PendingPayment",
  "Confirmed",
  "Ongoing",
  "Completed",
  "Cancelled",
  "Refunded",
];

/** GET /api/bookings/[id] — 404 if it doesn't exist or the caller may not see it (§26). */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  if (!UUID_RE.test(params.id)) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  }

  const booking = await getBookingForUser(params.id, auth.user);
  if (!booking) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  }
  return NextResponse.json({ booking });
}

/**
 * PATCH /api/bookings/[id] — advance the status through `transitionBooking()`
 * (plan.md §8), or let the owner edit `customerNotes` while the booking is
 * still Draft / PendingPayment.
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  if (!UUID_RE.test(params.id)) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  }

  let body: { status?: unknown; reason?: unknown; customerNotes?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  // ---- status transition ----
  if (body.status !== undefined) {
    if (typeof body.status !== "string" || !STATUSES.includes(body.status as BookingStatus)) {
      return NextResponse.json({ error: "Unknown status." }, { status: 400 });
    }
    const result = await transitionBooking({
      bookingId: params.id,
      toStatus: body.status as BookingStatus,
      user: auth.user,
      reason: typeof body.reason === "string" ? body.reason.slice(0, 500) : undefined,
    });
    if (!result.ok) {
      const status =
        result.code === "invalid_transition" ? 409 : 404; // not_found / forbidden -> 404 (§26)
      return NextResponse.json({ error: result.message }, { status });
    }
    const booking = await getBookingForUser(params.id, auth.user);
    return NextResponse.json({ booking });
  }

  // ---- customer notes (owner only, pre-confirmation) ----
  if (typeof body.customerNotes === "string") {
    const existing = await getBookingForUser(params.id, auth.user);
    if (!existing) {
      return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    }
    if (existing.userId !== auth.user.id) {
      return NextResponse.json(
        { error: "Only the booking's owner can edit its notes." },
        { status: 403 },
      );
    }
    if (existing.status !== "Draft" && existing.status !== "PendingPayment") {
      return NextResponse.json(
        { error: "Notes can only be changed before the booking is confirmed." },
        { status: 409 },
      );
    }
    await getPool().query(
      `UPDATE bookings SET customer_notes = $1, updated_by = $2 WHERE booking_id = $3`,
      [body.customerNotes.slice(0, 1000) || null, auth.user.id, params.id],
    );
    const booking = await getBookingForUser(params.id, auth.user);
    return NextResponse.json({ booking });
  }

  return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
}

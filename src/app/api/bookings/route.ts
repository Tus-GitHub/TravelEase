import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/auth-guard";
import {
  createBooking,
  getBookingForUser,
  listBookingsForUser,
  type CreateBookingInput,
} from "@/lib/server/bookings";

/** GET /api/bookings — the caller's bookings (own / assigned / all, by role). */
export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const bookings = await listBookingsForUser(auth.user);
  return NextResponse.json({ bookings });
}

/**
 * POST /api/bookings — create a booking (plan.md §15, §33). The price is
 * recomputed server-side from the trip facts; any client total is ignored (§6).
 */
export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  let body: CreateBookingInput;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const result = await createBooking(body, auth.user);
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status });
  }

  const booking = await getBookingForUser(result.bookingId, auth.user);
  return NextResponse.json({ booking }, { status: 201 });
}

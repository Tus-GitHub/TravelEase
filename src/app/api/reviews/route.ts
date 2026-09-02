import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/auth-guard";
import { upsertReview } from "@/lib/server/reviews";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/reviews — create or update the caller's review for one of their
 * *Completed* bookings. Body: { bookingId, rating (1–5), title?, body? }.
 */
export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  let body: { bookingId?: unknown; rating?: unknown; title?: unknown; body?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (typeof body.bookingId !== "string" || !UUID_RE.test(body.bookingId)) {
    return NextResponse.json({ error: "A valid booking id is required." }, { status: 400 });
  }

  const result = await upsertReview(body.bookingId, auth.user.id, {
    rating: Number(body.rating),
    title: typeof body.title === "string" ? body.title : undefined,
    body: typeof body.body === "string" ? body.body : undefined,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
  return NextResponse.json({ review: result.review }, { status: 201 });
}

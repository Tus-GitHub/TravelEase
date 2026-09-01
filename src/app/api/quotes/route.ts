import { NextResponse } from "next/server";
import { calculatePrice, type BookingTypeCode, type TripInput } from "@/lib/server/pricing";
import { resolveBookingTypeId, resolvePricingRule } from "@/lib/server/pricing-rules";
import { getPool } from "@/lib/server/db";

/**
 * POST /api/quotes — a server-computed price for a prospective booking
 * (plan.md §6, §31). Public: guests get a quote before signing in (§34).
 *
 * The client sends trip facts only (type, distance, hours, days, …). The total
 * is NEVER taken from the client — the server resolves the pricing rule and
 * recomputes. Per-person package price is looked up here, not trusted from the
 * request.
 */
const BOOKING_TYPES: BookingTypeCode[] = [
  "point_to_point",
  "hourly",
  "outstation",
  "package",
  "airport_transfer",
];

const nonNegative = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : undefined;

const asInt = (v: unknown): number | null =>
  typeof v === "number" && Number.isInteger(v) ? v : null;

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const bookingType = body.bookingType;
  if (
    typeof bookingType !== "string" ||
    !BOOKING_TYPES.includes(bookingType as BookingTypeCode)
  ) {
    return NextResponse.json({ error: "Unknown booking type." }, { status: 400 });
  }

  const trip: TripInput = {
    bookingType: bookingType as BookingTypeCode,
    distanceKm: nonNegative(body.distanceKm),
    hours: nonNegative(body.hours),
    days: nonNegative(body.days),
    nights: nonNegative(body.nights),
    passengers: nonNegative(body.passengers),
    // discountAmount + packagePricePerPerson are resolved server-side only.
  };

  const vehicleTypeId = asInt(body.vehicleTypeId);

  // Per-person package pricing — price comes from the packages table, never the client.
  if (
    trip.bookingType === "package" &&
    (body.packageId != null || body.packageSlug != null)
  ) {
    const res = await getPool().query(
      `SELECT price_per_person, duration_days
         FROM packages
        WHERE is_deleted = false AND is_active = true
          AND (($1::int IS NOT NULL AND package_id = $1)
            OR ($2::text IS NOT NULL AND slug = $2))
        LIMIT 1`,
      [asInt(body.packageId), typeof body.packageSlug === "string" ? body.packageSlug : null],
    );
    if (!res.rows[0]) {
      return NextResponse.json({ error: "Package not found." }, { status: 404 });
    }
    trip.packagePricePerPerson = Number(res.rows[0].price_per_person);
    if (trip.days === undefined) trip.days = Number(res.rows[0].duration_days);
  }

  const bookingTypeId = await resolveBookingTypeId(trip.bookingType);
  if (bookingTypeId == null) {
    return NextResponse.json(
      { error: "Booking type is not configured." },
      { status: 500 },
    );
  }

  const rule = await resolvePricingRule(bookingTypeId, vehicleTypeId);
  if (!rule) {
    return NextResponse.json(
      { error: "No pricing is configured for this trip yet." },
      { status: 422 },
    );
  }

  return NextResponse.json({ quote: calculatePrice(trip, rule) });
}

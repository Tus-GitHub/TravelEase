import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readBoundedJsonObject } from "@/lib/server/http-json";
import { matchesRequestOrigin } from "@/lib/server/request-origin";
import { calculatePrice, PER_PERSON_PACKAGE_RULE, type BookingTypeCode, type TripInput } from "@/lib/server/pricing";
import { resolveBookingTypeId, resolvePricingRule } from "@/lib/server/pricing-rules";
import { validateCoupon } from "@/lib/server/coupons";
import { resolveSeason } from "@/lib/server/seasonal-pricing";
import { getUserIdForToken, SESSION_COOKIE } from "@/lib/server/session";
import { quoteSharedTrip } from "@/lib/server/weekend-bookings";
import { tripResponse, tripFailure } from "@/lib/server/weekend-http";
import { carTripFacts, distanceTrip } from "@/lib/server/car-trip";
import { MapServiceError, verifiedBookingRoute } from "@/lib/server/map-services";
import { emptyReturnRoute } from "@/lib/server/empty-return";
import { tripDuration } from "@/lib/booking-duration";
import type { BookingRoute } from "@/lib/booking-route";
import { resolvePrivatePackage } from "@/lib/server/package-plan";
import { TripError } from "@/lib/weekend-trips";

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
  if (!matchesRequestOrigin(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  let body: Record<string, unknown>;
  try {
    body = await readBoundedJsonObject(request.body, 20 * 1024);
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (body.departureId !== undefined) {
    try { return tripResponse(await quoteSharedTrip(body)); } catch (error) { return tripFailure(error); }
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

  let vehicleTypeId = asInt(body.vehicleTypeId);
  let vehicleId: number | null = null;
  let verifiedRoute: BookingRoute | undefined;
  if (body.vehicleId != null) {
    try {
      const facts = await carTripFacts({ vehicleId: body.vehicleId, vehicleTypeId: body.vehicleTypeId, bookingType: trip.bookingType,
        passengers: body.passengers, routeId: body.routeId, pickupPoint: body.pickupPoint, dropPoint: body.dropPoint });
      vehicleId = body.vehicleId as number;
      vehicleTypeId = facts.vehicleTypeId;
      if (facts.route) { verifiedRoute = facts.route; trip.distanceKm = facts.route.distanceKm; trip.hours = facts.route.durationHours; }
    } catch(error) { return NextResponse.json({ error: error instanceof MapServiceError ? error.message : "Could not validate the car route." }, { status: error instanceof MapServiceError ? error.status : 503 }); }
  } else if(distanceTrip(trip.bookingType)) {
    try {const route=await verifiedBookingRoute(body.routeId,body.pickupPoint,body.dropPoint,trip.bookingType==="outstation");verifiedRoute=route;trip.distanceKm=route.distanceKm;trip.hours=route.durationHours;}
    catch(error){return NextResponse.json({error:error instanceof MapServiceError?error.message:"Could not validate the road route."},{status:error instanceof MapServiceError?error.status:503});}
  }

  // Per-person package pricing — price comes from the packages table, never the client.
  let packagePlan: Awaited<ReturnType<typeof resolvePrivatePackage>> | undefined;
  if (
    trip.bookingType === "package" &&
    (body.packageId != null || body.packageSlug != null)
  ) {
    try { packagePlan = await resolvePrivatePackage({ packageId: body.packageId, packageSlug: body.packageSlug, guidedPath: body.guidedPath }); }
    catch(error) { return NextResponse.json({ error: error instanceof TripError ? error.message : "Could not load the package plan." }, { status: error instanceof TripError ? error.status : 503 }); }
    if (vehicleId !== null && vehicleTypeId !== packagePlan.vehicleTypeId) return NextResponse.json({ error: "Choose a car matching this package’s vehicle type." }, { status: 400 });
    trip.packagePricePerPerson = packagePlan.pricePerPerson;
    trip.days = packagePlan.days;
    trip.nights = packagePlan.nights;
    vehicleTypeId = packagePlan.vehicleTypeId;
    if ((trip.passengers ?? 1) > packagePlan.maxPersons) {
      return NextResponse.json({ error: "This package cannot accommodate that many passengers." }, { status: 400 });
    }
  }

  const bookingTypeId = await resolveBookingTypeId(trip.bookingType);
  if (bookingTypeId == null) {
    return NextResponse.json(
      { error: "Booking type is not configured." },
      { status: 500 },
    );
  }

  const date = typeof body.startDate === "string" ? new Date(body.startDate) : undefined;
  if (date && Number.isNaN(date.getTime())) return NextResponse.json({ error: "Choose a valid travel date." }, { status: 400 });
  const rule = await resolvePricingRule(bookingTypeId, vehicleTypeId, vehicleId, date) ?? (packagePlan && packagePlan.pricePerPerson > 0 ? PER_PERSON_PACKAGE_RULE : null);
  if (!rule) {
    return NextResponse.json(
      { error: "No pricing is configured for this trip yet." },
      { status: 422 },
    );
  }
  if (trip.bookingType === "outstation") {
    try { const duration = tripDuration(String(body.startDate ?? ""), String(body.endDateTime ?? "")); trip.days = duration.days; trip.nights = duration.nights; }
    catch(error) { return NextResponse.json({ error: (error as Error).message }, { status: 400 }); }
    if (verifiedRoute && Date.parse(String(body.endDateTime)) < Date.parse(String(body.startDate)) + verifiedRoute.durationHours * 3600000) return NextResponse.json({ error: "Return time must allow the road travel time shown." }, { status: 400 });
  }
  try { const reverse = await emptyReturnRoute(trip.bookingType, rule, verifiedRoute); trip.emptyReturnKm = reverse?.distanceKm; }
  catch(error) { return NextResponse.json({ error: error instanceof MapServiceError ? error.message : "Could not calculate the empty return." }, { status: error instanceof MapServiceError ? error.status : 503 }); }

  // Seasonal multiplier for the trip start date, if the client sent one (2.8).
  if (typeof body.startDate === "string") {
    const day = new Date(body.startDate);
    if (!Number.isNaN(day.getTime())) {
      const season = await resolveSeason(day, bookingTypeId, vehicleTypeId);
      if (season) {
        trip.seasonalMultiplier = season.multiplier;
        trip.seasonalLabel = season.name;
      }
    }
  }

  const packageMetadata = packagePlan ? { packageFingerprint: packagePlan.fingerprint, packageDays: packagePlan.days, packageNights: packagePlan.nights } : {};
  const quote = { ...calculatePrice(trip, rule), ...packageMetadata };

  // Optional coupon preview (chunk 2.3). Per-user limit is checked only if we
  // can identify the visitor; it's still enforced for real at booking time.
  const couponCode =
    typeof body.couponCode === "string" ? body.couponCode.trim() : "";
  if (!couponCode) {
    return NextResponse.json({ quote });
  }

  const userId = await getUserIdForToken(cookies().get(SESSION_COOKIE)?.value);
  const applied = await validateCoupon(couponCode, quote.subtotal, userId);
  if (!applied.ok) {
    return NextResponse.json({ quote, couponError: applied.reason });
  }

  return NextResponse.json({
    quote: { ...calculatePrice(
      { ...trip, discountAmount: applied.coupon.discountAmount },
      rule,
    ), ...packageMetadata },
    coupon: { code: applied.coupon.code, discountAmount: applied.coupon.discountAmount },
  });
}

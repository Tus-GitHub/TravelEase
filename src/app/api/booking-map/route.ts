import { NextResponse } from "next/server";
import { matchesRequestOrigin } from "@/lib/server/request-origin";
import { readBoundedJsonObject } from "@/lib/server/http-json";
import { routePoint } from "@/lib/booking-route";
import { searchMapPlaces, suggestMapPlaces, calculateBookingRoute, MapServiceError } from "@/lib/server/map-services";

export async function POST(request: Request) {
  if (!matchesRequestOrigin(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  let body: Record<string, unknown>;
  try { body = await readBoundedJsonObject(request.body, 4096); }
  catch { return NextResponse.json({ error: "Invalid map request." }, { status: 400 }); }
  try {
    if (body.action === "suggest" && typeof body.query === "string") {
      return NextResponse.json({ results: await suggestMapPlaces(body.query) }, { headers: { "Cache-Control": "no-store" } });
    }
    if (body.action === "search" && typeof body.query === "string") {
      return NextResponse.json({ results: await searchMapPlaces(body.query) }, { headers: { "Cache-Control": "no-store" } });
    }
    const pickup = routePoint(body.pickup), drop = routePoint(body.drop);
    if (body.action !== "route" || !pickup || !drop || typeof body.roundTrip !== "boolean") return NextResponse.json({ error: "Choose valid pickup and drop points." }, { status: 400 });
    return NextResponse.json({ route: await calculateBookingRoute(pickup, drop, body.roundTrip) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const known = error instanceof MapServiceError;
    return NextResponse.json({ error: known ? error.message : "Map service is unavailable. Please try again later." }, {
      status: known ? error.status : 503,
      headers: { "Cache-Control": "no-store", ...(known && error.retryAfter ? { "Retry-After": String(error.retryAfter) } : {}) },
    });
  }
}

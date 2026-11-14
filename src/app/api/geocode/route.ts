import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserIdForToken, SESSION_COOKIE } from "@/lib/server/session";
import { geocodeForward, geocodeReverse } from "@/lib/server/geocode";
import { isValidLatLng } from "@/lib/validation";
import { MapServiceError } from "@/lib/server/map-services";

// Session-gated so it can't be used as an open geocoding proxy; login also
// naturally throttles abuse. Only the profile location picker calls this.
export async function GET(request: Request) {
  const userId = await getUserIdForToken(cookies().get(SESSION_COOKIE)?.value);
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const latRaw = searchParams.get("lat");
  const lngRaw = searchParams.get("lng");
  const q = searchParams.get("q")?.trim() ?? "";

  try {
    if (latRaw !== null && lngRaw !== null) {
      const lat = Number(latRaw);
      const lng = Number(lngRaw);
      if (!isValidLatLng(lat, lng)) {
        return NextResponse.json({ error: "Invalid coordinates." }, { status: 400 });
      }
      return NextResponse.json({ result: await geocodeReverse(lat, lng) });
    }

    if (q.length >= 3) {
      return NextResponse.json({ results: await geocodeForward(q) });
    }

    return NextResponse.json(
      { error: "Provide ?q= (min 3 characters) or ?lat=&lng=." },
      { status: 400 },
    );
  } catch (error) {
    return NextResponse.json({ error: error instanceof MapServiceError ? error.message : "Geocoding service unavailable." }, { status: error instanceof MapServiceError ? error.status : 502,
      headers: error instanceof MapServiceError && error.retryAfter ? { "Retry-After":String(error.retryAfter) } : {} });
  }
}

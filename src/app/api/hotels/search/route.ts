import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/auth-guard";
import { HotelError, parseHotelSearch } from "@/lib/hotels";
import { readBoundedJson } from "@/lib/server/http-json";
import { resolveHotelDestination } from "@/lib/server/hotel-destinations";
import { searchHotelProvider } from "@/lib/server/hotel-provider";
import { matchesRequestOrigin } from "@/lib/server/request-origin";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const auth = await requireUser(); if (!auth.ok) return auth.response;
  const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
  if (!matchesRequestOrigin(request)) return reply({ error: "Invalid origin." }, 403);
  let input;
  try { input = parseHotelSearch(await readBoundedJson(request.body, 1024)); }
  catch (error) { return reply({ error: error instanceof HotelError ? error.message : "Choose valid hotel search details." }, 400); }
  try {
    const destination = await resolveHotelDestination(input.cityId);
    const hotels = await searchHotelProvider(input, destination, auth.user.id);
    const fresh = await resolveHotelDestination(input.cityId);
    if (fresh.latitude !== destination.latitude || fresh.longitude !== destination.longitude) throw new HotelError("The city location changed. Please search again.", 409);
    return reply({ result: { hotels, sandbox: true, searchedAt: new Date().toISOString(), destination: { id: fresh.id, regionId: fresh.regionId, name: fresh.name, regionName: fresh.regionName } } });
  } catch (error) {
    return reply({ error: error instanceof HotelError ? error.message : "Hotel search is unavailable. Please try again later." }, error instanceof HotelError ? error.status : 503);
  }
}

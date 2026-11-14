import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/auth-guard";
import { ItineraryError, parseItineraryRequest, validateSuggestedIds } from "@/lib/itinerary-suggestions";
import { generateItineraryIds, readBoundedJson } from "@/lib/server/ai-itinerary";
import { checkItineraryCatalogue, loadItineraryCatalogue } from "@/lib/server/itinerary-catalogue";
import { matchesRequestOrigin } from "@/lib/server/request-origin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
  if (!matchesRequestOrigin(request)) return reply({ error: "Invalid origin." }, 403);
  let input;
  try { input = parseItineraryRequest(await readBoundedJson(request.body, 2048)); }
  catch { return reply({ error: "Choose a region, 2 to 5 stops and up to 3 interests." }, 400); }
  try {
    const candidates = await loadItineraryCatalogue(input.regionId);
    checkItineraryCatalogue(input, candidates);
    const ids = await generateItineraryIds(input, candidates, auth.user.id);
    // Catalogue changes during the provider call must not return removed stops.
    const fresh = await loadItineraryCatalogue(input.regionId, ids);
    checkItineraryCatalogue(input, fresh);
    validateSuggestedIds({ orderedIds: ids }, input, fresh.map(spot => Number(spot.id)));
    return reply({ suggestion: { regionId: input.regionId, spots: ids.map(id => fresh.find(spot => Number(spot.id) === id)!) } });
  } catch (error) {
    if (error instanceof ItineraryError) return reply({ error: error.message }, error.status);
    return reply({ error: "Itinerary ideas are temporarily unavailable. Please choose stops manually." }, 503);
  }
}

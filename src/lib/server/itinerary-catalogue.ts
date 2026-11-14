import { getPool } from "./db";
import { ItineraryError, type ItineraryRequest } from "../itinerary-suggestions";
import { PACKAGE_IMAGE_FALLBACK } from "./catalogue";
import type { TouristSpot } from "@/types";

export interface ItineraryCandidate extends TouristSpot { cityName: string }
export const MAX_ITINERARY_CANDIDATES = 60;

/** Reused for the initial shortlist and a fresh availability check after generation. */
export async function loadItineraryCatalogue(regionId: number, selectedIds?: number[]): Promise<ItineraryCandidate[]> {
  const result = await getPool().query(
    `SELECT ts.tourist_spot_id, ts.name, ts.tag, ts.description, ts.image_url, c.name AS city_name
       FROM tourist_spots ts JOIN cities c ON c.city_id = ts.city_id
       JOIN regions r ON r.region_id = c.region_id
      WHERE r.region_id = $1 AND r.is_active AND NOT r.is_deleted
        AND c.is_active AND NOT c.is_deleted AND ts.is_active AND NOT ts.is_deleted
        AND ($2::int[] IS NULL OR ts.tourist_spot_id = ANY($2::int[]))
      ORDER BY ts.display_order, ts.tourist_spot_id LIMIT $3`,
    [regionId, selectedIds ?? null, MAX_ITINERARY_CANDIDATES + 1],
  );
  if (result.rows.length > MAX_ITINERARY_CANDIDATES) {
    throw new ItineraryError("This region has too many stops for AI suggestions right now. Please choose stops manually.", 422);
  }
  return result.rows.map(row => ({
    id: String(row.tourist_spot_id), name: row.name, tag: row.tag ?? "", description: row.description ?? "",
    imageUrl: row.image_url ?? PACKAGE_IMAGE_FALLBACK, cityName: row.city_name,
  }));
}

export function checkItineraryCatalogue(request: ItineraryRequest, candidates: ItineraryCandidate[]) {
  if (candidates.length < request.stopCount || request.keepIds.some(id => !candidates.some(spot => Number(spot.id) === id))) {
    throw new ItineraryError("Some stops are no longer available in this region. Refresh the page and choose your stops again.", 409);
  }
}

import { regions } from "@/data/regions";

/**
 * Canonical set of travel-interest tags a customer can pick as preferences.
 * Derived from the tourist-spot `tag` vocabulary so `customer_profiles.preferred_tags`
 * can be matched directly against `tourist_spots.tag` for recommendations (plan.md §12a).
 */
export const TRAVEL_TAGS: string[] = Array.from(
  new Set(regions.flatMap((region) => region.spots.map((spot) => spot.tag))),
).sort((a, b) => a.localeCompare(b));

export function isValidTravelTag(tag: string): boolean {
  return TRAVEL_TAGS.includes(tag);
}

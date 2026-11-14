export const ITINERARY_INTERESTS = ["Heritage", "Nature", "Culture", "Adventure", "Relaxation"] as const;
export type ItineraryInterest = typeof ITINERARY_INTERESTS[number];
export interface ItineraryRequest {
  regionId: number;
  stopCount: number;
  keepIds: number[];
  interests: ItineraryInterest[];
}

export class ItineraryError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

const isId = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0 && Number(value) <= 2147483647;

export function parseItineraryRequest(value: unknown): ItineraryRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ItineraryError("Choose a region and your trip preferences.");
  const data = value as Record<string, unknown>;
  if (Object.keys(data).some(key => !["regionId", "stopCount", "keepIds", "interests"].includes(key)) ||
      !isId(data.regionId) || !Number.isInteger(data.stopCount) || Number(data.stopCount) < 2 || Number(data.stopCount) > 5 ||
      !Array.isArray(data.keepIds) || data.keepIds.length > Number(data.stopCount) ||
      !data.keepIds.every(isId) || new Set(data.keepIds).size !== data.keepIds.length ||
      !Array.isArray(data.interests) || data.interests.length > 3 || new Set(data.interests).size !== data.interests.length ||
      !data.interests.every(interest => ITINERARY_INTERESTS.includes(interest))) {
    throw new ItineraryError("Choose 2 to 5 stops and up to 3 interests. Your selected stops must fit the trip.");
  }
  return data as unknown as ItineraryRequest;
}

/** Treat model output as untrusted: IDs only, exactly the requested set size. */
export function validateSuggestedIds(value: unknown, request: ItineraryRequest, allowedIds: number[]): number[] {
  const data = value as { orderedIds?: unknown } | null;
  const ids = data?.orderedIds;
  if (!data || typeof data !== "object" || Object.keys(data).length !== 1 ||
      !Array.isArray(ids) || ids.length !== request.stopCount || new Set(ids).size !== ids.length ||
      ids.some(id => !isId(id) || !allowedIds.includes(id)) || request.keepIds.some(id => !ids.includes(id))) {
    throw new ItineraryError("We could not create a suitable itinerary. Please try different interests or choose stops manually.", 502);
  }
  return ids;
}

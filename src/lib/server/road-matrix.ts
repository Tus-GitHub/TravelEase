import type { RoadMatrix } from "../route-optimization";

export class RoutingError extends Error {
  status: number;
  constructor(message: string, status = 502) { super(message); this.status = status; }
}

// Bounded warm-instance cache and request budget; provider quota remains the global cap.
const cache = new Map<string, { expires: number; matrix: RoadMatrix }>();
let requests: number[] = [];
let inFlight = false;

export async function getRoadMatrix(locations: [number, number][], fetcher: typeof fetch = fetch): Promise<RoadMatrix> {
  const key = process.env.OPENROUTESERVICE_API_KEY;
  if (!key) throw new RoutingError("Route suggestions are not available yet. You can still arrange your stops manually.", 503);
  const cacheKey = JSON.stringify(locations);
  const now = Date.now();
  const hit = cache.get(cacheKey);
  if (hit && hit.expires > now) return hit.matrix;
  requests = requests.filter(at => now - at < 60_000);
  if (inFlight || requests.length >= 20) throw new RoutingError("Route suggestions are busy. Please try again shortly.", 429);
  requests.push(now); inFlight = true;
  try {
    const response = await fetcher("https://api.openrouteservice.org/v2/matrix/driving-car", {
      method: "POST", headers: { Authorization: key, "Content-Type": "application/json" },
      body: JSON.stringify({ locations, metrics: ["duration"] }),
      cache: "no-store", signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) throw new RoutingError(response.status === 429 ? "Routing quota reached. Please try again later." : "Road estimates are temporarily unavailable. Your route has not changed.", response.status === 429 ? 429 : 502);
    const data = await response.json();
    const matrix: unknown = data.durations;
    if (!Array.isArray(matrix) || matrix.length !== locations.length || matrix.some(row =>
      !Array.isArray(row) || row.length !== locations.length || row.some(v => v !== null && (typeof v !== "number" || !Number.isFinite(v) || v < 0)))) {
      throw new RoutingError("The routing service returned invalid travel times.");
    }
    cache.set(cacheKey, { expires: now + 3_600_000, matrix });
    if (cache.size > 100) cache.delete(cache.keys().next().value!);
    return matrix;
  } catch (error) {
    if (error instanceof RoutingError) throw error;
    throw new RoutingError("Road estimates are temporarily unavailable. Please try again.");
  } finally { inFlight = false; }
}

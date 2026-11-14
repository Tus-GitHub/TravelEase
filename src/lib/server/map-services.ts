import { createHash } from "crypto";
import { getPool } from "./db";
import { routePoint, samePoint, type BookingRoute, type RoutePoint } from "../booking-route";

type Provider = "nominatim" | "fossgis";
export class MapServiceError extends Error {
  status: number;
  retryAfter: number;
  constructor(message: string, status = 503, retryAfter = 0) { super(message); this.status=status; this.retryAfter=retryAfter; }
}
const USER_AGENT = "JagdambaTravellers/1.0 (+https://travelease-rouge.vercel.app/contact)";
// Hard ceilings cannot be increased through a request or environment variable.
const DAILY_LIMIT = 200;
const GAP_MS = 1100;
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const origin = (provider: Provider) => {
  const raw = provider === "nominatim" ? process.env.BOOKING_GEOCODE_ORIGIN ?? "https://nominatim.openstreetmap.org" : process.env.BOOKING_ROUTING_ORIGIN ?? "https://routing.openstreetmap.de";
  const url = new URL(raw);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/") throw new MapServiceError("Map service is not configured.");
  return url.origin;
};

/** Shared DB gate: durably reserve at most 1 call/1.1s and 200/day across every app instance. */
export async function cachedMapRequest<T>(provider: Provider, key: string, load: () => Promise<T>): Promise<T> {
  if (process.env.BOOKING_MAPS_DISABLED === "true") throw new MapServiceError("Maps are temporarily unavailable. Please try again later.");
  const pool = getPool();
  const cached = await pool.query("SELECT response FROM map_service_cache WHERE cache_key=$1 AND expires_at>now()", [key]);
  if (cached.rows[0]) return cached.rows[0].response as T;
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    const lock = await db.query("SELECT pg_try_advisory_xact_lock(hashtext($1)) AS locked", [`booking-maps:${provider}`]);
    if (!lock.rows[0].locked) throw new MapServiceError("Map service is busy. Please try again in a moment.", 429, 2);
    const hit = await db.query("SELECT response FROM map_service_cache WHERE cache_key=$1 AND expires_at>now()", [key]);
    if (hit.rows[0]) { await db.query("COMMIT"); return hit.rows[0].response as T; }
    await db.query("INSERT INTO map_service_usage(provider,usage_date) VALUES($1,(now() AT TIME ZONE 'UTC')::date) ON CONFLICT DO NOTHING", [provider]);
    const state = (await db.query(`SELECT request_count, usage_date=(clock_timestamp() AT TIME ZONE 'UTC')::date AS today,
      EXTRACT(EPOCH FROM (clock_timestamp()-last_request_at))*1000 AS gap FROM map_service_usage WHERE provider=$1 FOR UPDATE`, [provider])).rows[0];
    if (state.today && state.request_count >= DAILY_LIMIT) throw new MapServiceError("Today's free map allowance has been reached. Please try again tomorrow.", 429, 3600);
    if (state.gap !== null && Number(state.gap) < GAP_MS) throw new MapServiceError("Please wait a moment before searching or routing again.", 429, 2);
    await db.query(`UPDATE map_service_usage SET request_count=CASE WHEN usage_date=(clock_timestamp() AT TIME ZONE 'UTC')::date THEN request_count+1 ELSE 1 END,
      usage_date=(clock_timestamp() AT TIME ZONE 'UTC')::date, last_request_at=clock_timestamp() WHERE provider=$1`, [provider]);
    // Commit the allowance BEFORE contacting the provider. A lost acknowledgement
    // fails closed; later provider/cache failures cannot undo consumed allowance.
    await db.query("COMMIT");
  } catch (error) { await db.query("ROLLBACK"); throw error; }
  finally { db.release(); }
  let result: T;
  try { result = await load(); }
  catch (error) { throw error instanceof MapServiceError ? error : new MapServiceError("Map service is unavailable. Please try again later."); }
  await pool.query("DELETE FROM map_service_cache WHERE expires_at<=now()");
  await pool.query(`INSERT INTO map_service_cache(cache_key,provider,response,expires_at) VALUES($1,$2,$3::jsonb,now()+interval '24 hours')
    ON CONFLICT(cache_key) DO UPDATE SET response=EXCLUDED.response,expires_at=EXCLUDED.expires_at,created_at=now()`, [key, provider, JSON.stringify(result)]);
  return result;
}

async function upstream(url: URL): Promise<unknown> {
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT, "Accept-Language": "en" }, signal: AbortSignal.timeout(8000), cache: "no-store", redirect: "error" });
  if (!response.ok) throw new MapServiceError("Map service is unavailable. Please try again later.");
  const text = await response.text();
  if (text.length > 2_000_000) throw new MapServiceError("Map response was too large.");
  return JSON.parse(text);
}

export interface MapPlace extends RoutePoint { label: string; city: string; state: string; pincode: string }
function place(item: Record<string, unknown>): MapPlace | null {
  const point = routePoint({ lat: Number(item.lat), lng: Number(item.lon) });
  if (!point || typeof item.display_name !== "string") return null;
  const address = (item.address ?? {}) as Record<string, string>;
  return { ...point, label: item.display_name.split(",").slice(0, 4).join(",").slice(0, 280),
    city: address.city || address.town || address.village || address.suburb || "", state: address.state || "", pincode: address.postcode || "" };
}
export async function searchMapPlaces(query: string): Promise<MapPlace[]> {
  const q = query.trim().replace(/\s+/g, " ");
  if (q.length < 3 || q.length > 150) throw new MapServiceError("Search for a public place or area using 3–150 characters.", 400);
  const key = hash(`nominatim:search:${origin("nominatim")}:${q.toLowerCase()}`);
  return cachedMapRequest("nominatim", key, async () => {
    const url = new URL(`${origin("nominatim")}/search`);
    url.search = new URLSearchParams({ q, format: "jsonv2", addressdetails: "1", countrycodes: "in", limit: "6" }).toString();
    const data = await upstream(url);
    if (!Array.isArray(data)) throw new MapServiceError("Invalid map search response.");
    return data.flatMap(item => { const result = place(item); return result ? [result] : []; });
  });
}
export async function reverseMapPlace(point: RoutePoint): Promise<MapPlace | null> {
  const key = hash(`nominatim:reverse:${origin("nominatim")}:${point.lat},${point.lng}`);
  return cachedMapRequest("nominatim", key, async () => {
    const url = new URL(`${origin("nominatim")}/reverse`);
    url.search = new URLSearchParams({ lat: String(point.lat), lon: String(point.lng), format: "jsonv2", addressdetails: "1", zoom: "16" }).toString();
    return place(await upstream(url) as Record<string, unknown>);
  });
}
export async function calculateBookingRoute(pickup: RoutePoint, drop: RoutePoint, roundTrip: boolean): Promise<BookingRoute> {
  if (samePoint(pickup, drop)) throw new MapServiceError("Choose different pickup and destination points.", 400);
  const points = roundTrip ? [pickup, drop, pickup] : [pickup, drop];
  const coordinates = points.map(p => `${p.lng},${p.lat}`).join(";");
  const id = hash(`fossgis:${origin("fossgis")}:${coordinates}`);
  return cachedMapRequest("fossgis", id, async () => {
    const url = new URL(`${origin("fossgis")}/routed-car/route/v1/driving/${coordinates}`);
    url.search = new URLSearchParams({ overview: "simplified", geometries: "geojson", steps: "false" }).toString();
    const data = await upstream(url) as { code?: string; routes?: { distance: number; duration: number; geometry?: { coordinates?: [number,number][] } }[]; waypoints?: { distance: number }[] };
    const route = data.routes?.[0];
    if (data.code !== "Ok" || !route || !Number.isFinite(route.distance) || route.distance < 1 || route.distance > 10_000_000 ||
        !Number.isFinite(route.duration) || route.duration <= 0 || data.waypoints?.some(p => p.distance > 1500)) throw new MapServiceError("No suitable road route was found. Adjust the map points.", 422);
    const geometry = route.geometry?.coordinates;
    if (!geometry?.length || geometry.length > 15000 || geometry.some(p => !routePoint({ lat: p[1], lng: p[0] }))) throw new MapServiceError("Invalid road route response.");
    return { id, pickup, drop, roundTrip, distanceKm: Math.ceil(route.distance / 10) / 100,
      durationHours: Math.ceil(route.duration / 36) / 100, geometry, provider: "fossgis" };
  });
}
/** Booking/quote read trusted cached road results; never accept customer-entered kilometres. */
export async function verifiedBookingRoute(id: unknown, pickup: unknown, drop: unknown, roundTrip: boolean): Promise<BookingRoute> {
  const a = routePoint(pickup), b = routePoint(drop);
  if (typeof id !== "string" || !/^[a-f0-9]{64}$/.test(id) || !a || !b) throw new MapServiceError("Choose pickup and destination locations, then calculate the road route.", 400);
  const row = (await getPool().query("SELECT response FROM map_service_cache WHERE cache_key=$1 AND provider='fossgis' AND expires_at>now()", [id])).rows[0];
  const route = row?.response as BookingRoute | undefined;
  if (!route || !samePoint(route.pickup, a) || !samePoint(route.drop, b) || route.roundTrip !== roundTrip) throw new MapServiceError("Your route estimate has expired or changed. Calculate the route again.", 422);
  return route;
}

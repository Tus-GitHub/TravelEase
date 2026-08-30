/**
 * Server-side geocoding. Kept behind a small provider interface so the backend
 * (currently keyless OpenStreetMap / Nominatim) can be swapped for a keyed
 * service later without touching the API route or the UI — just add a provider
 * and branch in `getProvider()` on an env var.
 */

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface GeoResult extends GeoPoint {
  /** Short human-readable label, e.g. "Malviya Nagar, Jaipur, Rajasthan". */
  label: string;
  city: string;
  state: string;
  pincode: string;
}

interface GeocodeProvider {
  name: string;
  forward(query: string): Promise<GeoResult[]>;
  reverse(point: GeoPoint): Promise<GeoResult | null>;
}

// ── tiny in-memory cache (per warm server instance) ───────────────────────────
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 500;
const MISS = Symbol("miss");
const cache = new Map<string, { at: number; value: unknown }>();

function cacheGet<T>(key: string): T | typeof MISS {
  const hit = cache.get(key);
  if (!hit) return MISS;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return MISS;
  }
  return hit.value as T;
}

function cacheSet(key: string, value: unknown): void {
  cache.set(key, { at: Date.now(), value });
  if (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
}

// ── serialize upstream calls, ≥1.1s apart (Nominatim usage policy) ────────────
let lastCallAt = 0;
let queue: Promise<unknown> = Promise.resolve();

function schedule<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const gap = Date.now() - lastCallAt;
    if (gap < 1100) await new Promise((r) => setTimeout(r, 1100 - gap));
    lastCallAt = Date.now();
    return task();
  });
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

// ── Nominatim provider ───────────────────────────────────────────────────────
const NOMINATIM = "https://nominatim.openstreetmap.org";
const USER_AGENT =
  process.env.GEOCODE_USER_AGENT ?? "TravelEase/1.0 (travel booking app)";

interface NominatimAddress {
  city?: string;
  town?: string;
  village?: string;
  suburb?: string;
  neighbourhood?: string;
  county?: string;
  state_district?: string;
  state?: string;
  postcode?: string;
}

interface NominatimItem {
  lat: string;
  lon: string;
  display_name: string;
  address?: NominatimAddress;
  error?: string;
}

function shortLabel(displayName: string): string {
  return displayName
    .split(",")
    .slice(0, 3)
    .map((s) => s.trim())
    .filter(Boolean)
    .join(", ");
}

function mapItem(item: NominatimItem): GeoResult {
  const a = item.address ?? {};
  return {
    lat: Number(item.lat),
    lng: Number(item.lon),
    label: shortLabel(item.display_name),
    city:
      a.city ||
      a.town ||
      a.village ||
      a.suburb ||
      a.neighbourhood ||
      a.county ||
      a.state_district ||
      "",
    state: a.state || "",
    pincode: a.postcode || "",
  };
}

async function nominatimFetch(path: string, params: Record<string, string>): Promise<unknown> {
  const url = new URL(`${NOMINATIM}${path}`);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, "Accept-Language": "en" },
  });
  if (!res.ok) throw new Error(`nominatim ${path} responded ${res.status}`);
  return res.json();
}

const nominatim: GeocodeProvider = {
  name: "nominatim",
  async forward(query) {
    const data = (await nominatimFetch("/search", {
      q: query,
      limit: "6",
      countrycodes: "in",
    })) as NominatimItem[];
    return Array.isArray(data) ? data.map(mapItem).filter((r) => Number.isFinite(r.lat)) : [];
  },
  async reverse(point) {
    const data = (await nominatimFetch("/reverse", {
      lat: String(point.lat),
      lon: String(point.lng),
    })) as NominatimItem;
    if (!data || data.error || !data.lat) return null;
    return mapItem(data);
  },
};

function getProvider(): GeocodeProvider {
  // Later: if (process.env.GEOCODE_PROVIDER === "maptiler") return maptiler;
  return nominatim;
}

export async function geocodeForward(query: string): Promise<GeoResult[]> {
  const key = `f:${query.trim().toLowerCase()}`;
  const cached = cacheGet<GeoResult[]>(key);
  if (cached !== MISS) return cached;
  const results = await schedule(() => getProvider().forward(query.trim()));
  cacheSet(key, results);
  return results;
}

export async function geocodeReverse(lat: number, lng: number): Promise<GeoResult | null> {
  const key = `r:${lat.toFixed(5)},${lng.toFixed(5)}`;
  const cached = cacheGet<GeoResult | null>(key);
  if (cached !== MISS) return cached;
  const result = await schedule(() => getProvider().reverse({ lat, lng }));
  cacheSet(key, result);
  return result;
}

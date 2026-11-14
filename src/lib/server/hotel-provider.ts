import { HotelError, type HotelResult, type HotelSearchInput, type HotelFee } from "../hotels";
import { readBoundedJson } from "./http-json";

type JsonObject = Record<string, unknown>;
const object = (value: unknown): JsonObject => value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const text = (value: unknown, limit = 160): string => typeof value === "string" ? value.trim().slice(0, limit) : "";
const money = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) && value >= 0 && value < 100_000_000 ? value : null;
const price = (value: unknown) => object(Array.isArray(value) ? value[0] : value);

export function hotelImageUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 1500) return null;
  try { const url = new URL(value); return url.protocol === "https:" && url.hostname === "static.cupid.travel" && !url.username && !url.password && !url.port ? url.href : null; }
  catch { return null; }
}

/** One room only. Never expose supplier/net prices when a public selling price is absent. */
export function normalizeHotelResults(payload: unknown, adults: number): HotelResult[] {
  const root = object(payload);
  if (root.sandbox !== true || !Array.isArray(root.data) || !Array.isArray(root.hotels)) throw new HotelError("The hotel provider returned an unexpected test response. Please try again later.", 502);
  const details = new Map(list(root.hotels).slice(0, 30).map(item => { const hotel = object(item); return [text(hotel.id), hotel]; }));
  const seen = new Set<string>(); const results: HotelResult[] = [];
  for (const item of root.data.slice(0, 30)) {
    const record = object(item); const id = text(record.hotelId, 100); const hotel = details.get(id);
    if (!id || !hotel || !text(hotel.name) || seen.has(id)) continue;
    const offer = object(list(record.roomTypes)[0]); const rates = list(offer.rates);
    if (rates.length !== 1) continue;
    const rate = object(rates[0]);
    if (rate.adultCount !== adults || (rate.childCount !== undefined && rate.childCount !== 0)) continue;
    const retail = price(offer.offerRetailRate); const publicPrice = price(offer.suggestedSellingPrice);
    const retailAmount = money(retail.amount); const publicAmount = money(publicPrice.amount);
    const total = retail.currency === "INR" && publicPrice.currency === "INR" && retailAmount !== null && publicAmount !== null ? Math.max(retailAmount, publicAmount) : null;
    const policy = object(rate.cancellationPolicies);
    const propertyFees: HotelFee[] = list(object(rate.retailRate).taxesAndFees ?? rate.taxesAndFees).slice(0, 12).map(object).filter(fee => fee.included !== true).map(fee => ({
      label: text(fee.description) || "Property charge", amount: money(fee.amount), currency: /^[A-Z]{3}$/.test(text(fee.currency)) ? text(fee.currency) : null,
    }));
    seen.add(id);
    results.push({ id, name: text(hotel.name), address: text(hotel.address, 300), imageUrl: hotelImageUrl(hotel.main_photo) ?? hotelImageUrl(hotel.thumbnail),
      stars: typeof hotel.stars === "number" && Number.isInteger(hotel.stars) && hotel.stars >= 1 && hotel.stars <= 5 ? hotel.stars : null,
      room: text(rate.name) || "Room details on request", board: text(rate.boardName) || "Meal plan on request", total, currency: "INR",
      cancellation: policy.refundableTag === "RFN" ? "Refundable conditions reported — confirm deadlines and charges with our team." : policy.refundableTag === "NRFN" ? "Non-refundable conditions reported — confirm terms with our team." : "Cancellation terms need confirmation with our team.",
      propertyFees,
    });
    if (results.length === 12) break;
  }
  if (root.data.length && !results.length) throw new HotelError("We could not read the hotel options safely. Please try again or ask our team.", 502);
  return results;
}

export class HotelQuota {
  private users = new Map<string, { count: number; until: number }>();
  private total = 0; private until = 0; private active = 0;
  acquire(id: string, now = Date.now()) {
    this.users.forEach((entry, key) => { if (entry.until <= now) this.users.delete(key); });
    if (this.until <= now) { this.total = 0; this.until = now + 60_000; }
    const entry = this.users.get(id) ?? { count: 0, until: now + 60_000 };
    if (entry.count >= 5 || this.total >= 20 || this.active >= 2 || this.users.size >= 1000) throw new HotelError("Hotel searches are busy. Try again in a minute.", 429);
    entry.count++; this.users.set(id, entry); this.total++; this.active++;
    let released = false; return () => { if (!released) { this.active--; released = true; } };
  }
}
const globals = globalThis as unknown as { __hotelQuota?: HotelQuota };
const quota = globals.__hotelQuota ??= new HotelQuota();
export function hotelProviderConfigured() {
  return process.env.VERCEL_ENV !== "production" && /^(sand_|sandbox_)\S+$/.test(process.env.LITEAPI_SANDBOX_KEY?.trim() ?? "");
}
export async function searchHotelProvider(input: HotelSearchInput, location: { latitude: number; longitude: number }, userId: string,
  options: { fetcher?: typeof fetch; limiter?: HotelQuota; timeoutMs?: number } = {}): Promise<HotelResult[]> {
  if (!hotelProviderConfigured()) throw new HotelError("Hotel search is not connected yet. You can still send our team a stay enquiry.", 503);
  const release = (options.limiter ?? quota).acquire(userId);
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 15_000);
  try {
    const response = await (options.fetcher ?? fetch)("https://api.liteapi.travel/v3.0/hotels/rates", {
      method: "POST", redirect: "error", signal: controller.signal, cache: "no-store",
      headers: { "X-API-Key": process.env.LITEAPI_SANDBOX_KEY!.trim(), "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ checkin: input.checkin, checkout: input.checkout, occupancies: [{ adults: input.adults }],
        guestNationality: input.nationality, currency: "INR", latitude: location.latitude, longitude: location.longitude,
        radius: 15000, limit: 12, maxRatesPerHotel: 1, includeHotelData: true, timeout: 8 }),
    });
    if (response.status === 204) { await response.body?.cancel(); return []; }
    if (!response.ok) { await response.body?.cancel(); throw new HotelError("Hotel search is temporarily unavailable. Try again later or send an enquiry.", 503); }
    return normalizeHotelResults(await readBoundedJson(response.body, 1024 * 1024), input.adults);
  } catch (error) {
    if (error instanceof HotelError) throw error;
    throw new HotelError("We could not reach the hotel provider. Please try again or send an enquiry.", 502);
  } finally { clearTimeout(timer); release(); }
}

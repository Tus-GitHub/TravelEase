import assert from "node:assert/strict";
import { test } from "node:test";
import { HotelError, hotelToday, hotelDateAfter, parseHotelSearch, hotelEnquiry } from "../../src/lib/hotels.ts";
import { HotelQuota, hotelProviderConfigured, hotelImageUrl, normalizeHotelResults, searchHotelProvider } from "../../src/lib/server/hotel-provider.ts";

const now = new Date("2026-11-05T18:00:00Z");
const input = { cityId: 1, checkin: "2026-11-06", checkout: "2026-11-08", adults: 2, nationality: "IN" };
const location = { latitude: 28.6139, longitude: 77.209 };
const destination = { id: 1, regionId: 1, name: "Delhi", regionName: "North" };
const status = (expected: number) => (error: unknown) => error instanceof HotelError && error.status === expected;
function payload() {
  return { sandbox: true, hotels: [{ id: "lp123", name: "Test hotel", address: "Test address", stars: 4, main_photo: "https://static.cupid.travel/hotels/123.jpg" }],
    data: [{ hotelId: "lp123", roomTypes: [{ offerRetailRate: { amount: 5000, currency: "INR" }, suggestedSellingPrice: { amount: 5500, currency: "INR" }, rates: [{ name: "Deluxe", adultCount: 2, childCount: 0, boardName: "Breakfast", cancellationPolicies: { refundableTag: "RFN" }, retailRate: { taxesAndFees: [{ included: true, description: "Tax", amount: 500, currency: "INR" }, { included: false, description: "Property fee", amount: 100, currency: "INR" }] } }] }] }] };
}
process.env.LITEAPI_SANDBOX_KEY = "sand_test-only";
delete process.env.VERCEL_ENV;

test("hotel dates use India time and reject invalid calendars, past stays and oversized stays", () => {
  assert.equal(hotelToday(new Date("2026-11-05T19:00:00Z")), "2026-11-06");
  assert.equal(hotelDateAfter("2028-02-28", 1), "2028-02-29");
  assert.deepEqual(parseHotelSearch(input, now), input);
  for (const value of [null, [], { ...input, checkin: "2026-02-30" }, { ...input, checkin: "2026-02-29" },
    { ...input, checkin: "2026-11-04" }, { ...input, checkout: input.checkin }, { ...input, checkout: "2026-12-07" },
    { ...input, checkin: "2027-11-06", checkout: "2027-11-08" }, { ...input, cityId: "1" }, { ...input, cityId: 2147483648 },
    { ...input, cityId: 0 }, { ...input, adults: 0 }, { ...input, adults: 5 }, { ...input, adults: 1.5 },
    { ...input, nationality: "__proto__" }, { ...input, nationality: "in" }, { ...input, latitude: 1 }, { ...input, price: 5 }]) {
    assert.throws(() => parseHotelSearch(value, now), status(400));
  }
});

test("normalizer separates full-stay public price, property fees and conditional cancellation", () => {
  const hotel = normalizeHotelResults(payload(), 2)[0];
  assert.equal(hotel.total, 5500); assert.equal(hotel.currency, "INR");
  assert.deepEqual(hotel.propertyFees, [{ label: "Property fee", amount: 100, currency: "INR" }]);
  assert.match(hotel.cancellation, /confirm deadlines/); assert.equal(hotel.stars, 4);
  assert.ok(!JSON.stringify(hotel).includes("offerRetailRate"));
  const value = payload(); value.data[0].roomTypes[0].suggestedSellingPrice.amount = 4500;
  assert.equal(normalizeHotelResults(value, 2)[0].total, 5000);
  value.data[0].roomTypes[0].suggestedSellingPrice.currency = "USD";
  assert.equal(normalizeHotelResults(value, 2)[0].total, null, "never mislabel currency or expose net price");
  const missing = payload() as any; delete missing.data[0].roomTypes[0].suggestedSellingPrice;
  assert.equal(normalizeHotelResults(missing, 2)[0].total, null);
  const arrays = payload() as any;
  arrays.data[0].roomTypes[0].offerRetailRate = [arrays.data[0].roomTypes[0].offerRetailRate];
  arrays.data[0].roomTypes[0].suggestedSellingPrice = [arrays.data[0].roomTypes[0].suggestedSellingPrice];
  assert.equal(normalizeHotelResults(arrays, 2)[0].total, 5500);
});

test("malformed, live, mismatched occupancy and unjoined results fail closed", () => {
  for (const value of [null, {}, { ...payload(), sandbox: false }, { ...payload(), hotels: [] }]) assert.throws(() => normalizeHotelResults(value, 2), status(502));
  assert.throws(() => normalizeHotelResults(payload(), 3), status(502));
  const child = payload(); child.data[0].roomTypes[0].rates[0].childCount = 1;
  assert.throws(() => normalizeHotelResults(child, 2), status(502));
  const duplicate = payload(); duplicate.data.push(duplicate.data[0]);
  assert.equal(normalizeHotelResults(duplicate, 2).length, 1);
  assert.deepEqual(normalizeHotelResults({ sandbox: true, data: [], hotels: [] }, 2), []);
  const invalid = payload(); invalid.data[0].roomTypes[0].suggestedSellingPrice.amount = Infinity;
  assert.equal(normalizeHotelResults(invalid, 2)[0].total, null);
});

test("images only allow the documented HTTPS CDN without credentials or arbitrary origins", () => {
  assert.equal(hotelImageUrl("https://static.cupid.travel/hotels/123.jpg"), "https://static.cupid.travel/hotels/123.jpg");
  for (const url of ["http://static.cupid.travel/a", "https://static.cupid.travel.evil.test/a", "https://secret@static.cupid.travel/a", "https://static.cupid.travel:8443/a", "javascript:alert(1)", "https://127.0.0.1/a", null]) assert.equal(hotelImageUrl(url), null);
});

test("provider request is fixed, bounded, one-room and contains no customer identity", async () => {
  let calls = 0;
  const hotels = await searchHotelProvider(input, location, "private-user-id", { limiter: new HotelQuota(), fetcher: async (url, options) => {
    calls++; assert.equal(url, "https://api.liteapi.travel/v3.0/hotels/rates");
    assert.equal(options?.redirect, "error"); assert.equal(options?.cache, "no-store");
    const body = JSON.parse(String(options?.body));
    assert.deepEqual(body.occupancies, [{ adults: 2 }]); assert.equal(body.latitude, location.latitude);
    assert.equal(body.longitude, location.longitude); assert.equal(body.currency, "INR");
    assert.equal(body.includeHotelData, true); assert.equal(body.maxRatesPerHotel, 1);
    assert.ok(body.timeout <= 8 && body.limit <= 12);
    assert.ok(!String(options?.body).includes("private-user-id"));
    assert.ok(!String(options?.body).includes("sand_test-only"));
    return Response.json(payload());
  } });
  assert.equal(calls, 1); assert.equal(hotels.length, 1);
});

test("unconfigured, production credentials and production deployment cannot call provider", async () => {
  const fetcher = async () => { assert.fail("provider must not be called"); };
  for (const key of ["", "prod_not-allowed", "other-key"]) {
    process.env.LITEAPI_SANDBOX_KEY = key; assert.equal(hotelProviderConfigured(), false);
    await assert.rejects(searchHotelProvider(input, location, "user", { fetcher }), status(503));
  }
  process.env.LITEAPI_SANDBOX_KEY = "sand_test-only"; process.env.VERCEL_ENV = "production";
  await assert.rejects(searchHotelProvider(input, location, "user", { fetcher }), status(503));
  delete process.env.VERCEL_ENV; assert.equal(hotelProviderConfigured(), true);
});

test("upstream failures are sanitized, never retried and release concurrency slots", async () => {
  const limiter = new HotelQuota(); let calls = 0;
  for (const httpStatus of [401, 429, 500]) {
    await assert.rejects(searchHotelProvider(input, location, String(httpStatus), { limiter, fetcher: async () => {
      calls++; return new Response("private-provider-detail", { status: httpStatus });
    } }), error => status(503)(error) && !(error as Error).message.includes("private-provider-detail"));
  }
  assert.equal(calls, 3); const release = limiter.acquire("after-error"); release();
  assert.deepEqual(await searchHotelProvider(input, location, "empty", { limiter, fetcher: async () => new Response(null, { status: 204 }) }), []);
});

test("invalid JSON, oversized bodies and timeouts fail safely", async () => {
  for (const body of ["not-json", "x".repeat(1024 * 1024 + 1)]) {
    await assert.rejects(searchHotelProvider(input, location, "user", { limiter: new HotelQuota(), fetcher: async () => new Response(body) }), status(502));
  }
  const limiter = new HotelQuota();
  await assert.rejects(searchHotelProvider(input, location, "user", { limiter, timeoutMs: 5, fetcher: async (_url, options) => new Promise((_resolve, reject) => {
    options?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
  }) }), status(502));
  const release = limiter.acquire("recovered"); release();
});

test("quotas cap each user, the warm instance and concurrent requests, then recover", () => {
  const users = new HotelQuota(); for (let i = 0; i < 5; i++) users.acquire("user", 1000)();
  assert.throws(() => users.acquire("user", 1001), status(429)); users.acquire("user", 61001)();
  const total = new HotelQuota(); for (let i = 0; i < 20; i++) total.acquire(String(i), 1000)();
  assert.throws(() => total.acquire("more", 1001), status(429));
  const parallel = new HotelQuota(); const release = parallel.acquire("one", 1000); const other = parallel.acquire("two", 1000);
  assert.throws(() => parallel.acquire("three", 1000), status(429)); release(); release();
  parallel.acquire("three", 1000)(); other();
});

test("enquiries are explicitly nonbinding support messages, including no-provider fallback", () => {
  const hotel = normalizeHotelResults(payload(), 2)[0];
  const ticket = hotelEnquiry(input, destination, hotel, "Late arrival");
  assert.equal(ticket.category, "general"); assert.match(ticket.message, /no reservation or payment/);
  assert.match(ticket.message, /Staff must verify live availability/); assert.match(ticket.message, /Late arrival/);
  assert.match(ticket.message, /INR 5500.00/); assert.ok(ticket.subject.length <= 160);
  const fallback = hotelEnquiry(input, destination, null, "x".repeat(2000));
  assert.match(fallback.message, /Please recommend/); assert.ok(fallback.message.length < 1800);
});

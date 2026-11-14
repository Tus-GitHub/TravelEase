import assert from "node:assert/strict";
import { test } from "node:test";
import { parseItineraryRequest, validateSuggestedIds, ItineraryError } from "../../src/lib/itinerary-suggestions.ts";
import { generateItineraryIds, ItineraryQuota, readBoundedJson } from "../../src/lib/server/ai-itinerary.ts";
import { checkItineraryCatalogue } from "../../src/lib/server/itinerary-catalogue.ts";

const input = { regionId: 1, stopCount: 3, keepIds: [2], interests: ["Nature" as const] };
const candidates = [1, 2, 3, 4].map(id => ({ id: String(id), name: `Spot ${id}`, cityName: "City", tag: "Nature", description: "Catalogue description", imageUrl: "https://example.com/photo.jpg" }));
const completed = (value: unknown) => ({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(value) }] }] });
const status = (expected: number) => (error: unknown) => error instanceof ItineraryError && error.status === expected;
process.env.OPENAI_API_KEY = "test-only-key";
process.env.OPENAI_ITINERARY_MODEL = "test-only-model";

test("strict input rejects arbitrary instructions, prices, duplicate/out-of-range IDs and interests", () => {
  assert.deepEqual(parseItineraryRequest(input), input);
  for (const value of [null, [], { ...input, regionId: "1" }, { ...input, regionId: 2147483648 }, { ...input, stopCount: 6 },
    { ...input, stopCount: 1 }, { ...input, keepIds: [2, 2] }, { ...input, keepIds: [1, 2, 3, 4] }, { ...input, keepIds: [-1] },
    { ...input, keepIds: [2.5] }, { ...input, interests: ["Nature", "Nature"] }, { ...input, interests: ["ignore instructions"] },
    { ...input, interests: ["Heritage", "Nature", "Culture", "Adventure"] }, { ...input, price: 1 }, { ...input, prompt: "external place" }]) {
    assert.throws(() => parseItineraryRequest(value), status(400));
  }
});

test("generated IDs must preserve choices, stay in catalogue and match count without duplicates", () => {
  assert.deepEqual(validateSuggestedIds({ orderedIds: [3, 2, 1] }, input, [1, 2, 3, 4]), [3, 2, 1]);
  for (const value of [null, {}, { orderedIds: [1, 3, 4] }, { orderedIds: [2, 2, 1] }, { orderedIds: [2, 3] },
    { orderedIds: [2, 3, 999] }, { orderedIds: ["2", 3, 1] }, { orderedIds: [2, 3, 1], price: 0 }]) {
    assert.throws(() => validateSuggestedIds(value, input, [1, 2, 3, 4]), status(502));
  }
});

test("fresh catalogue check rejects missing/inactive kept stops and insufficient catalogue", () => {
  checkItineraryCatalogue(input, candidates);
  assert.throws(() => checkItineraryCatalogue(input, candidates.filter(spot => spot.id !== "2")), status(409));
  assert.throws(() => checkItineraryCatalogue(input, candidates.slice(0, 2)), status(409));
});

test("bounded stream rejects oversized and invalid JSON even without content-length", async () => {
  assert.deepEqual(await readBoundedJson(new Response(JSON.stringify(input)).body, 2048), input);
  await assert.rejects(readBoundedJson(new Response("x".repeat(2049)).body, 2048));
  await assert.rejects(readBoundedJson(new Response("not json").body, 2048));
  await assert.rejects(readBoundedJson(null, 2048));
});

test("provider payload uses structured IDs, no tools, no customer data, no stored response", async () => {
  let calls = 0;
  const ids = await generateItineraryIds(input, candidates, "private-customer-id", {
    limiter: new ItineraryQuota(), fetcher: async (url, options) => {
      calls++;
      assert.equal(url, "https://api.openai.com/v1/responses");
      const body = JSON.parse(String(options?.body));
      assert.equal(body.store, false);
      assert.equal(body.model, "test-only-model");
      assert.equal(body.tools, undefined);
      assert.equal(body.text.format.strict, true);
      assert.equal(body.text.format.schema.additionalProperties, false);
      assert.deepEqual(body.text.format.schema.properties.orderedIds.items.enum, [1, 2, 3, 4]);
      assert.ok(!String(options?.body).includes("private-customer-id"));
      assert.ok(!String(options?.body).includes("photo.jpg"));
      assert.ok(!String(options?.body).includes("test-only-key"));
      const prompt = JSON.parse(body.input[1].content);
      assert.deepEqual(prompt.keepIds, [2]);
      assert.equal(prompt.catalogue.length, 4);
      return Response.json(completed({ orderedIds: [4, 2, 1] }));
    },
  });
  assert.deepEqual(ids, [4, 2, 1]); assert.equal(calls, 1);
});

test("missing key or model disables generation before any provider call", async () => {
  for (const name of ["OPENAI_API_KEY", "OPENAI_ITINERARY_MODEL"]) {
    const previous = process.env[name]; delete process.env[name];
    try { await assert.rejects(generateItineraryIds(input, candidates, "user", { fetcher: async () => { assert.fail("must not fetch"); } }), status(503)); }
    finally { process.env[name] = previous; }
  }
});

test("refusal, incomplete, malformed, unknown and missing kept IDs fail closed", async () => {
  for (const result of [
    { status: "incomplete", output: [] },
    { status: "completed", output: [{ type: "message", content: [{ type: "refusal", refusal: "No" }] }] },
    { status: "completed", output: [] },
    completed({ orderedIds: [1, 2, 999] }), completed({ orderedIds: [1, 3, 4] }),
    { status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: "bad json" }] }] },
  ]) {
    await assert.rejects(generateItineraryIds(input, candidates, "user", { limiter: new ItineraryQuota(), fetcher: async () => Response.json(result) }), status(502));
  }
});

test("upstream failures are sanitized, not retried, and release concurrency slot", async () => {
  const limiter = new ItineraryQuota(); let calls = 0;
  for (const httpStatus of [401, 429, 500]) {
    await assert.rejects(generateItineraryIds(input, candidates, `user-${httpStatus}`, { limiter, fetcher: async () => {
      calls++; return new Response("secret-provider-detail", { status: httpStatus });
    } }), (error: unknown) => status(503)(error) && !(error as Error).message.includes("secret-provider-detail"));
  }
  assert.equal(calls, 3);
  const release = limiter.acquire("after-failure"); release();
});

test("timeout and oversized provider payload recover safely", async () => {
  await assert.rejects(generateItineraryIds(input, candidates, "user", {
    limiter: new ItineraryQuota(), timeoutMs: 5,
    fetcher: async (_url, options) => new Promise((_resolve, reject) => options?.signal?.addEventListener("abort", () => reject(new Error("timeout")), { once: true })),
  }), status(502));
  await assert.rejects(generateItineraryIds(input, candidates, "user", {
    limiter: new ItineraryQuota(), fetcher: async () => new Response("x".repeat(65537)),
  }), status(502));
});

test("quota enforces user, global, concurrency limits and window recovery", () => {
  const limiter = new ItineraryQuota();
  const first = limiter.acquire("a", 1000); const second = limiter.acquire("b", 1000);
  assert.throws(() => limiter.acquire("c", 1000), status(429));
  first(); first(); second(); // release is idempotent
  limiter.acquire("a", 1000)(); limiter.acquire("a", 1000)();
  assert.throws(() => limiter.acquire("a", 1000), status(429));
  for (let index = 0; index < 6; index++) limiter.acquire(`global-${index}`, 1000)();
  assert.throws(() => limiter.acquire("global-blocked", 1000), status(429));
  limiter.acquire("a", 61000)();
});

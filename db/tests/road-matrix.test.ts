import assert from "node:assert/strict";
import { getRoadMatrix, RoutingError } from "../../src/lib/server/road-matrix.ts";
import { spotCoordinates } from "../../src/lib/spot-coordinates.ts";

const originalKey = process.env.OPENROUTESERVICE_API_KEY;
try {
  delete process.env.OPENROUTESERVICE_API_KEY;
  await assert.rejects(getRoadMatrix([[77, 28], [78, 27]]), (e: RoutingError) => e.status === 503);
  process.env.OPENROUTESERVICE_API_KEY = "synthetic-test-key";
  let calls = 0;
  const fake: typeof fetch = async (url, options) => {
    calls++;
    assert.equal(url, "https://api.openrouteservice.org/v2/matrix/driving-car");
    assert.deepEqual(JSON.parse(String(options?.body)), { locations: [[77, 28], [78, 27]], metrics: ["duration"] });
    assert.equal((options?.headers as Record<string, string>).Authorization, "synthetic-test-key");
    assert.ok(options?.signal);
    return Response.json({ durations: [[0, 123], [456, 0]] });
  };
  assert.deepEqual(await getRoadMatrix([[77, 28], [78, 27]], fake), [[0, 123], [456, 0]]);
  await getRoadMatrix([[77, 28], [78, 27]], fake);
  assert.equal(calls, 1, "repeat request cached");
  await assert.rejects(getRoadMatrix([[1, 2], [3, 4]], async () => new Response("secret provider body", { status: 429 })), (e: RoutingError) => e.status === 429 && !e.message.includes("secret"));
  await assert.rejects(getRoadMatrix([[1, 2], [3, 4]], async () => Response.json({ durations: [[0]] })), (e: RoutingError) => e.status === 502);
  await assert.rejects(getRoadMatrix([[1, 2], [3, 4]], async () => { throw new Error("secret upstream detail"); }), (e: RoutingError) => e.status === 502 && !e.message.includes("secret"));
  assert.deepEqual(spotCoordinates({}), {});
  assert.deepEqual(spotCoordinates({ latitude: 0, longitude: 0 }), { latitude: 0, longitude: 0 });
  assert.deepEqual(spotCoordinates({ latitude: null, longitude: null }), { latitude: null, longitude: null });
  for (const body of [{ latitude: 1 }, { longitude: 1 }, { latitude: null, longitude: 1 }, { latitude: "28", longitude: 77 }, { latitude: NaN, longitude: 77 }, { latitude: 91, longitude: 77 }, { latitude: 28, longitude: -181 }]) assert.throws(() => spotCoordinates(body));
  console.log("PASS: server-key configuration, coordinate order, timeout signal, cache, quota/malformed/network errors, and paired coordinate validation.");
} finally {
  if (originalKey === undefined) delete process.env.OPENROUTESERVICE_API_KEY;
  else process.env.OPENROUTESERVICE_API_KEY = originalKey;
}

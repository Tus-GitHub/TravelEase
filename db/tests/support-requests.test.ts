import assert from "node:assert/strict";
import { test } from "node:test";
import { readBoundedJsonObject } from "../../src/lib/server/http-json.ts";
import { createTicket } from "../../src/lib/server/support-tickets.ts";
import type { PublicUser } from "../../src/lib/server/users.ts";

const body = (raw: string) => new Request("http://localhost/api/support-tickets", { method: "POST", body: raw }).body;

test("support request reader accepts objects and preserves hotel enquiry text", async () => {
  const input = { subject: "Hotel enquiry: Delhi", category: "general", message: "Traveller note: नमस्ते\nPlease include breakfast." };
  assert.deepEqual(await readBoundedJsonObject(body(JSON.stringify(input)), 20 * 1024), input);
});

test("null, arrays, primitives, malformed JSON and absent bodies fail validation", async () => {
  for (const raw of ["null", "[]", '"text"', "123", "true", "{", ""]) {
    await assert.rejects(readBoundedJsonObject(body(raw), 20 * 1024));
  }
  await assert.rejects(readBoundedJsonObject(null, 20 * 1024));
});

test("actual UTF-8 bytes are bounded even across chunks and without content-length", async () => {
  let cancelled = false;
  const bytes = new TextEncoder().encode(JSON.stringify({ message: "旅".repeat(100) }));
  const streamed = new ReadableStream<Uint8Array>({
    start(controller) { controller.enqueue(bytes.slice(0, 80)); controller.enqueue(bytes.slice(80)); },
    cancel() { cancelled = true; },
  });
  await assert.rejects(readBoundedJsonObject(streamed, 200), /Body too large/);
  assert.equal(cancelled, true);
  assert.equal(streamed.locked, false);
});

test("malformed booking identifiers are rejected before any database query", async () => {
  const user = { id: "d0d00d00-0000-4000-8000-000000000001", role: "customer" } as PublicUser;
  for (const bookingId of ["bad-id", "123", "00000000-0000-0000-0000-00000000000z", " "]) {
    const result = await createTicket(user, { subject: "Hotel help", message: "Please help with this stay.", bookingId });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 400);
  }
});

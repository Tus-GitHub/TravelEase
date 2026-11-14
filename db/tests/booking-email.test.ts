import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import type { Pool, PoolClient } from "pg";
import { localMailSink } from "./_local-smtp.mjs";
import { captureBookingNotification, notifyBookingCreated, notifyBookingStatusChanged } from "../../src/lib/server/notifications.ts";
import { sendAdminBookingNotification } from "../../src/lib/server/email.ts";
import { invalidateSiteSettings } from "../../src/lib/server/site-settings.ts";

// No environment files, DB sockets or external mail. All recipients are reserved fixture addresses.
const customer = "customer@example.invalid", business = "bookings@example.invalid";
const allowed = [customer, business];
const sink = await localMailSink(allowed);
Object.assign(process.env, { SMTP_HOST: "127.0.0.1", SMTP_PORT: String(sink.port), SMTP_USER: "fixture", SMTP_PASS: "fixture", EMAIL_FROM: "Fixture Sender <sender@example.invalid>", APP_ORIGIN: "https://booking.example.invalid" });
let inbox: string | null = business;
let row: Record<string, unknown>;
const logs: unknown[][] = [];
const pool = {
  async query(sql: string, params: unknown[] = []) {
    if (sql.includes("INSERT INTO notifications")) { logs.push(params); return { rows: [] }; }
    if (sql.includes("FROM site_settings")) return { rows: inbox ? [{ setting_key: "contact_email", setting_value: inbox }] : [] };
    if (sql.includes("FROM bookings b")) {
      assert(sql.includes("b.pickup_address") && sql.includes("u.name AS owner_name"));
      return { rows: [row] };
    }
    throw new Error("Unexpected test query; no real database is available");
  },
};
(globalThis as unknown as { __pgPool: Pool }).__pgPool = pool as unknown as Pool;
const previousError = console.error;
console.error = () => {}; // Injected SMTP/config failures are asserted below, not printed as private transport detail.
function decode(raw: string) {
  const bytes = (value: string) => value.replace(/(?:=[0-9a-f]{2})+/gi,
    encoded => Buffer.from(encoded.replace(/=/g, ""), "hex").toString("utf8"));
  const split = raw.indexOf("\n\n");
  const headers = raw.slice(0, split).replace(/\n[ \t]+/g, " ")
    .replace(/=\?UTF-8\?([BQ])\?([^?]+)\?=/gi, (_, kind, value) =>
      kind.toUpperCase() === "B" ? Buffer.from(value, "base64").toString("utf8") : bytes(value.replace(/_/g, " ")));
  return headers + "\n\n" + bytes(raw.slice(split + 2).replace(/=\r?\n/g, ""));
}
const snapshot = async () => {
  const result = await captureBookingNotification(String(row.booking_id), pool as unknown as PoolClient);
  assert(result); return result;
};
beforeEach(() => {
  sink.messages.length = 0; sink.rejected.length = 0; logs.length = 0;
  allowed.splice(0, allowed.length, customer, business); inbox = business; invalidateSiteSettings();
  row = { booking_id: "00000000-0000-4000-8000-000000000001", booking_reference: "TE-EMAIL001", status: "PendingPayment", start_datetime: new Date("2026-12-01T06:00:00Z"), total_amount: "1250", passenger_count: 2, type_code: "point_to_point", owner_user_id: "00000000-0000-4000-8000-000000000002", owner_email: customer, owner_name: "<i>Fixture customer</i>", owner_phone: "9999999999", pickup_address: "Pickup <test>", drop_address: "Destination test", itinerary: null, driver_name: null, driver_phone: null, departure_id: null, seat_hold_expires_at: null, refund_amount: null };
});
after(async () => { console.error = previousError; await sink.close(); });

test("booking receipt and separate business alert use reciprocal Reply-To with the verified sender", async () => {
  await notifyBookingCreated(await snapshot());
  assert.equal(sink.messages.length, 2); assert.deepEqual(sink.rejected, []);
  const receipt = sink.messages.find((mail: { to: string[] }) => mail.to.includes(customer))!;
  const alert = sink.messages.find((mail: { to: string[] }) => mail.to.includes(business))!;
  assert.match(receipt.content, /Reply-To: bookings@example\.invalid/i);
  assert.match(alert.content, /Reply-To: customer@example\.invalid/i);
  for (const mail of [receipt, alert]) {
    const content = decode(mail.content);
    assert.match(content, /From: Fixture Sender <sender@example\.invalid>/i);
    assert.match(content, /TE-EMAIL001/); assert.match(content, /11:30/); assert.match(content, /IST/);
    assert.match(content, /Destination test/);
    assert(!content.slice(content.indexOf("<!doctype html>")).includes("<i>Fixture customer</i>"));
  }
  assert.match(decode(alert.content), /Payment pending/);
  assert.match(decode(alert.content), /https:\/\/booking\.example\.invalid\/admin\/bookings/);
  assert.match(decode(alert.content), /&lt;i&gt;Fixture customer&lt;\/i&gt;/);
  assert.equal(logs.find(values => values[3] === business)?.[0], null);
  assert(logs.every(values => values[5] === "sent"));
});

test("both emails retain committed recipient, fare and route after later mutations", async () => {
  const event = await snapshot();
  row.owner_email = "later@example.invalid"; row.total_amount = "9999"; row.pickup_address = "Later changed route";
  await notifyBookingCreated(event);
  assert.equal(sink.messages.length, 2);
  for (const mail of sink.messages) {
    assert.match(decode(mail.content), /1,250/);
    assert(!decode(mail.content).includes("9,999"));
    assert(!mail.content.includes("Later changed route") && !mail.content.includes("later@example.invalid"));
  }
});

test("customer SMTP rejection does not suppress the business alert or reject the booking notification", async () => {
  allowed.splice(allowed.indexOf(customer), 1);
  await assert.doesNotReject(notifyBookingCreated(await snapshot()));
  assert.equal(sink.messages.length, 1); assert.deepEqual(sink.messages[0].to, [business]);
  assert.equal(logs.find(values => values[3] === customer)?.[5], "failed");
  assert.equal(logs.find(values => values[3] === business)?.[5], "sent");
});

test("business SMTP rejection does not suppress the customer receipt", async () => {
  allowed.splice(allowed.indexOf(business), 1);
  await assert.doesNotReject(notifyBookingCreated(await snapshot()));
  assert.equal(sink.messages.length, 1); assert.deepEqual(sink.messages[0].to, [customer]);
  assert.equal(logs.find(values => values[3] === customer)?.[5], "sent");
  assert.equal(logs.find(values => values[3] === business)?.[5], "failed");
});

test("missing business inbox is logged separately and never falls back to a demo recipient", async () => {
  inbox = null;
  await assert.doesNotReject(notifyBookingCreated(await snapshot()));
  assert.equal(sink.messages.length, 1); assert.deepEqual(sink.messages[0].to, [customer]);
  assert(!sink.messages[0].content.includes("Reply-To:"));
  assert.equal(logs.find(values => values[2] === "booking.admin")?.[5], "failed");
});

test("status confirmation retains the business Reply-To and distinct confirmed wording", async () => {
  row.status = "Confirmed";
  await notifyBookingStatusChanged(await snapshot(), "PendingPayment", "Confirmed");
  assert.equal(sink.messages.length, 1);
  const content = decode(sink.messages[0].content);
  assert.match(content, /Booking confirmed/); assert.match(content, /Reply-To: bookings@example\.invalid/i);
});

test("invalid customer Reply-To cannot inject email headers", async () => {
  const event = await snapshot();
  await assert.rejects(sendAdminBookingNotification(business, { email: "customer@example.invalid\r\nBcc: outsider@example.invalid" }, event.info), /Invalid booking email mailbox/);
  assert.equal(sink.messages.length, 0);
});

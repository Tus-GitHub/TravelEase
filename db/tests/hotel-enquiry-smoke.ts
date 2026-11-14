/** Real hotel enquiry -> customer thread -> admin status flow on local dev.
 * Uses existing tables and removes its own fixtures. Never sends a staff reply
 * (which would trigger SMTP), calls a hotel provider or makes a booking. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { getPool } from "../../src/lib/server/db.ts";
import { SESSION_COOKIE } from "../../src/lib/server/session.ts";

assert(process.argv.includes("--dev") && !process.env.VERCEL, "Local development only");
assert.equal(execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim(), "development");
const host = (value: string) => new URL(value).hostname.replace(/-pooler\./, ".");
assert(process.env.DATABASE_URL_APP && process.env.DATABASE_URL && process.env.DATABASE_URL_PRODUCTION);
assert.equal(host(process.env.DATABASE_URL_APP), host(process.env.DATABASE_URL));
assert.notEqual(host(process.env.DATABASE_URL_APP), host(process.env.DATABASE_URL_PRODUCTION));
const modulePath = process.argv.find(value => value.startsWith("--browser-module="))?.slice("--browser-module=".length);
assert(modulePath, "Pass --browser-module=<absolute path to an installed Playwright module>");
const { chromium } = createRequire(import.meta.url)(modulePath);
const target = new URL(process.argv.find(value => value.startsWith("--base="))?.slice(7) ?? "http://127.0.0.1:3000");
assert(target.protocol === "http:" && ["localhost", "127.0.0.1"].includes(target.hostname) && target.pathname === "/" && !target.username && !target.password && !target.search && !target.hash, "Local HTTP origin required");
const base = target.origin;
const pool = getPool();
const fixture = (role: string) => ({ id: randomUUID(), token: randomUUID(), role });
const customer = fixture("customer"), outsider = fixture("customer"), admin = fixture("admin");
const fixtures = [customer, outsider, admin];
const fixtureIds = fixtures.map(value => value.id);
let browser: { close(): Promise<void> } | undefined;
let ticketId: string | undefined;
let checks = 0;
const note = `Hotel handoff smoke ${randomUUID()}`;

async function api(path: string, actor: typeof customer | null, method = "GET", data?: unknown, origin = base) {
  return fetch(base + path, { method, redirect: "error", signal: AbortSignal.timeout(60_000),
    headers: { "Content-Type": "application/json", Origin: origin, ...(actor ? { Cookie: `${SESSION_COOKIE}=${actor.token}` } : {}) },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
}
async function status(expected: number, response: Promise<Response>, label: string) {
  const result = await response;
  assert.equal(result.status, expected, label); checks++;
  return result;
}
try {
  for (const actor of fixtures) {
    const inserted = await pool.query(`WITH fixture AS (
      INSERT INTO users(user_id,name,email,phone,password_hash,role_id,email_verified_at)
        SELECT $1,'Hotel enquiry smoke',$2,'',$3,role_id,now() FROM roles WHERE name=$4 RETURNING user_id
      ) INSERT INTO sessions(token,user_id,expires_at)
        SELECT $5,user_id,now()+interval '15 minutes' FROM fixture`,
      [actor.id, `hotel-smoke-${actor.id}@example.invalid`, randomUUID(), actor.role, actor.token]);
    assert.equal(inserted.rowCount, 1);
    const identity = await (await api("/api/auth/me", actor)).json();
    assert.equal(identity.user?.id, actor.id, "Local app must resolve the development fixture");
    assert.equal(identity.user.role, actor.role);
  }

  await status(401, api("/api/support-tickets", null, "POST", {}), "Anonymous creation blocked");
  await status(403, api("/api/admin/support-tickets", customer), "Customer cannot list admin tickets");
  for (const input of [null, [], "text", { subject: "Hotel help", message: "A valid message", bookingId: "bad-id" }]) {
    await status(400, api("/api/support-tickets", customer, "POST", input), "Malformed creation returns400, not500");
  }
  await status(403, api("/api/support-tickets", customer, "POST", {}, "https://foreign.invalid"), "Foreign-origin creation blocked");
  await status(400, api("/api/support-tickets", customer, "POST", { message: "x".repeat(25_000) }), "Oversized request rejected");

  const instance = await chromium.launch({ channel: "chrome", headless: true }); browser = instance;
  const customerContext = await instance.newContext({ viewport: { width: 1280, height: 900 } });
  const adminContext = await instance.newContext({ viewport: { width: 1280, height: 900 } });
  for (const [context, actor] of [[customerContext, customer], [adminContext, admin]] as const) {
    await context.addCookies([{ name: SESSION_COOKIE, value: actor.token, url: base, httpOnly: true, sameSite: "Lax" }]);
  }
  const page = await customerContext.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error: Error) => errors.push(error.message));
  await page.goto(base + "/hotels", { waitUntil: "domcontentloaded", timeout: 90_000 });
  const help = page.getByRole("button", { name: "Request hotel help", exact: true });
  await help.waitFor({ timeout: 60_000 });
  await help.click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Anything we should know?").fill(note);
  await dialog.getByRole("button", { name: "Keep browsing" }).click();
  assert.equal(Number((await pool.query("SELECT count(*) AS n FROM support_tickets WHERE user_id=$1", [customer.id])).rows[0].n), 0, "Preview/cancel must not create a ticket");
  await help.click();
  await dialog.getByLabel("Anything we should know?").fill(note);
  const submitted = page.waitForResponse((response: { url(): string; request(): { method(): string } }) =>
    response.url() === base + "/api/support-tickets" && response.request().method() === "POST");
  await dialog.getByRole("button", { name: "Send hotel enquiry" }).click();
  const response = await submitted;
  assert.equal(response.status(), 201);
  const { ticket } = await response.json(); ticketId = ticket.id;
  assert.equal(ticket.userId, customer.id); assert.equal(ticket.category, "general"); assert.equal(ticket.bookingId, null);
  assert.equal(ticket.status, "open"); assert.equal(ticket.messages.length, 1);
  assert.match(ticket.messages[0].body, /no reservation or payment/);
  assert.ok(ticket.messages[0].body.includes(note));
  await page.waitForURL(base + "/profile/support/" + ticketId);
  await page.getByRole("heading", { name: ticket.subject, exact: true }).waitFor();
  assert.equal(Number((await pool.query("SELECT count(*) AS n FROM support_tickets WHERE user_id=$1", [customer.id])).rows[0].n), 1);
  const stored = (await pool.query("SELECT body FROM support_ticket_messages WHERE support_ticket_id=$1", [ticketId])).rows;
  assert.equal(stored.length, 1); assert.equal(stored[0].body, ticket.messages[0].body);
  console.log("PASS real browser hotel preview/cancel, explicit send201, one persisted enquiry and customer thread rendering.");

  await status(404, api(`/api/support-tickets/${ticketId}`, outsider), "Another customer cannot read the enquiry");
  await status(404, api(`/api/support-tickets/${ticketId}`, outsider, "POST", { message: "Should not be saved" }), "Another customer cannot reply");
  await status(403, api(`/api/admin/support-tickets/${ticketId}`, customer, "PATCH", { status: "closed" }), "Customer cannot change admin status");
  for (const [path, actor, method] of [[`/api/support-tickets/${ticketId}`, customer, "POST"], [`/api/admin/support-tickets/${ticketId}`, admin, "PATCH"]] as const) {
    await status(400, api(path, actor, method, null), "Malformed reply/status body returns400");
    await status(403, api(path, actor, method, {}, "https://foreign.invalid"), "Foreign-origin mutation blocked");
  }
  await page.getByLabel("Your reply").fill("Please include breakfast in the quote.");
  const customerReply = page.waitForResponse((r: { url(): string; request(): { method(): string } }) => r.url() === `${base}/api/support-tickets/${ticketId}` && r.request().method() === "POST");
  await page.getByRole("button", { name: "Send reply", exact: true }).click();
  assert.equal((await customerReply).status(), 200);
  await page.getByText("Please include breakfast in the quote.", { exact: true }).waitFor();

  const staffPage = await adminContext.newPage();
  staffPage.on("pageerror", (error: Error) => errors.push(error.message));
  await staffPage.goto(base + "/admin/support", { waitUntil: "domcontentloaded", timeout: 90_000 });
  await staffPage.getByRole("button").filter({ hasText: ticket.reference }).click({ timeout: 60_000 });
  await staffPage.getByRole("heading", { name: ticket.subject, exact: true }).waitFor();
  await staffPage.getByText("Please include breakfast in the quote.", { exact: true }).waitFor();
  await staffPage.getByRole("button", { name: `Edit ${ticket.reference} status`, exact: true }).click();
  const edit = staffPage.getByRole("dialog");
  await edit.getByLabel("Status", { exact: true }).selectOption("closed");
  const closed = staffPage.waitForResponse((r: { url(): string; request(): { method(): string } }) => r.url() === `${base}/api/admin/support-tickets/${ticketId}` && r.request().method() === "PATCH");
  await edit.getByRole("button", { name: "Save changes", exact: true }).click();
  assert.equal((await closed).status(), 200);
  await edit.waitFor({ state: "detached" });
  assert.equal((await pool.query("SELECT status FROM support_tickets WHERE support_ticket_id=$1", [ticketId])).rows[0].status, "closed");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByText("This ticket is closed.", { exact: false }).waitFor();
  assert.equal(await page.getByLabel("Your reply").count(), 0);
  await status(409, api(`/api/support-tickets/${ticketId}`, customer, "POST", { message: "After closure" }), "Closed ticket rejects further replies");
  assert.equal(Number((await pool.query("SELECT count(*) AS n FROM support_ticket_messages WHERE support_ticket_id=$1", [ticketId])).rows[0].n), 2);
  assert.equal(Number((await pool.query("SELECT count(*) AS n FROM notifications WHERE user_id=ANY($1::uuid[])", [fixtureIds])).rows[0].n), 0, "No notification mail was generated");
  assert.deepEqual(errors, []);
  console.log(`PASS customer follow-up, real admin view/custom status popup, persisted closure and customer closed state; ${checks} API security/validation checks. No API mocks.`);
} finally {
  try { await browser?.close(); }
  finally {
    try {
      // Delete only this run's synthetic tickets; message rows cascade with them.
      await pool.query("DELETE FROM support_tickets WHERE user_id=ANY($1::uuid[])", [fixtureIds]);
      await pool.query("DELETE FROM sessions WHERE user_id=ANY($1::uuid[])", [fixtureIds]);
      await pool.query("DELETE FROM users WHERE user_id=ANY($1::uuid[]) AND name='Hotel enquiry smoke'", [fixtureIds]);
      const remaining = await pool.query(`SELECT
        (SELECT count(*) FROM users WHERE user_id=ANY($1::uuid[])) +
        (SELECT count(*) FROM support_tickets WHERE user_id=ANY($1::uuid[])) +
        (SELECT count(*) FROM support_ticket_messages WHERE author_user_id=ANY($1::uuid[])) +
        (SELECT count(*) FROM sessions WHERE user_id=ANY($1::uuid[])) AS n`, [fixtureIds]);
      assert.equal(Number(remaining.rows[0].n), 0);
      console.log("Development fixtures removed; absence verified. No emails, provider calls, bookings, schema or production changes.");
    } finally { await pool.end(); }
  }
}

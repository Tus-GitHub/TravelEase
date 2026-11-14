/** Real development browser/API/database acceptance. Synthetic fixtures only.
 * SMTP is captured by a local receiving sink; no email or money is delivered. */
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { execFileSync, fork } from "node:child_process";
import { createRequire } from "node:module";
import { mkdir, realpath, lstat, unlink, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import pg from "pg";
import { runtimeDatabaseConfig } from "../../src/lib/server/db-config.ts";
import { localMailSink } from "./_local-smtp.mjs";

assert(process.argv.includes("--dev") && !process.env.VERCEL, "Local development only");
assert.equal(execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim(), "development");
const host = (value: string) => new URL(value).hostname.replace(/-pooler\./, ".");
const ownerUrl = process.env.DATABASE_URL!, runtimeUrl = process.env.DATABASE_URL_APP!;
assert(ownerUrl && runtimeUrl && process.env.DATABASE_URL_PRODUCTION);
assert.equal(host(ownerUrl), host(runtimeUrl));
assert.notEqual(host(ownerUrl), host(process.env.DATABASE_URL_PRODUCTION));
const modulePath = process.argv.find(value => value.startsWith("--browser-module="))?.slice(17);
assert(modulePath, "Pass --browser-module=<installed Playwright module>");
const { chromium } = createRequire(import.meta.url)(modulePath);
const artifacts = process.argv.find(value => value.startsWith("--artifacts="))?.slice(12);
const runId = randomUUID();
const routeId = createHash("sha256").update(`booking-acceptance:${runId}`).digest("hex");
const pickupPoint = { lat: 28.6129, lng: 77.2295 }, dropPoint = { lat: 28.6562, lng: 77.241 };
const fixture = (role: string) => ({ id: randomUUID(), token: randomUUID(), role, email: `booking-${randomUUID()}@example.invalid` });
const customer = fixture("customer"), stranger = fixture("customer"), admin = fixture("admin");
const actors = [customer, stranger, admin], userIds = actors.map(actor => actor.id);
const pool = new pg.Pool({ ...runtimeDatabaseConfig(ownerUrl), max: 5, application_name: "booking-acceptance-fixtures" });
const base = "http://127.0.0.1:3103";
let vehicleType: number | undefined, otherType: number | undefined, packageId: number | undefined, vehicle: number, coupon: number | undefined;
let child: ReturnType<typeof fork> | undefined, browser: { close(): Promise<void> } | undefined;
let sandbox: string | undefined;
let sink: Awaited<ReturnType<typeof localMailSink>> | undefined;
let serverLog = "", checks = 0;
let primaryId: string | undefined;
const stamp = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString();
async function api(route: string, actor: typeof customer | null, method = "GET", data?: unknown, origin = base) {
  return fetch(base + route, { method, redirect: "error", signal: AbortSignal.timeout(90_000),
    headers: { "Content-Type": "application/json", Origin: origin, ...(actor ? { Cookie: `session_token=${actor.token}` } : {}) },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
}
async function expectStatus(response: Promise<Response>, expected: number, label: string) {
  const r = await response; assert.equal(r.status, expected, `${label}: HTTP ${r.status}`); checks++;
  return r;
}
const bookingInput = (hours = 240) => ({ bookingType: "point_to_point", vehicleTypeId: vehicleType, vehicleId: vehicle,
  startDateTime: stamp(hours), endDateTime: stamp(hours + 2), passengerCount: 2, estimatedDistanceKm: 10,
  routeId, pickupPoint, dropPoint });
async function booking(hours: number) {
  const r = await expectStatus(api("/api/bookings", customer, "POST", { ...bookingInput(hours), totalAmount: 1, status: "Confirmed", userId: stranger.id }), 201, "Create with untrusted price/status/owner");
  const { booking } = await r.json(); assert.equal(booking.totalAmount, 1260); assert.equal(booking.status, "PendingPayment"); assert.equal(booking.userId, customer.id);
  return booking.id as string;
}
async function transition(id: string, to: string, actor = admin, extra = {}) {
  const prefix = actor === admin ? "/api/admin/bookings/" : "/api/bookings/";
  return expectStatus(api(prefix + id, actor, "PATCH", { status: to, reason: "Development acceptance", ...extra }), 200, `Transition to ${to}`);
}
async function state(id: string) { return (await pool.query("SELECT status,total_amount FROM bookings WHERE booking_id=$1", [id])).rows[0]; }
async function refund(id: string) { return (await pool.query("SELECT * FROM refunds WHERE booking_id=$1", [id])).rows[0]; }
async function activeBlocks(id: string) { return Number((await pool.query("SELECT count(*) AS n FROM vehicle_availability WHERE booking_id=$1 AND NOT is_deleted", [id])).rows[0].n); }
try {
  // Trusted server-cache fixture keeps all lifecycle checks independent of a live map provider.
  await pool.query("INSERT INTO map_service_cache(cache_key,provider,response,expires_at) VALUES($1,'fossgis',$2::jsonb,now()+interval '2 hours')", [routeId, JSON.stringify({ id: routeId, pickup: pickupPoint, drop: dropPoint, roundTrip: false, distanceKm: 10, durationHours: 1, geometry: [[pickupPoint.lng,pickupPoint.lat],[dropPoint.lng,dropPoint.lat]], provider: "fossgis" })]);
  for (const actor of actors) {
    await pool.query(`WITH fixture AS (INSERT INTO users(user_id,name,email,phone,password_hash,role_id,email_verified_at)
      VALUES($1,'Booking acceptance',$2,'','disabled',(SELECT role_id FROM roles WHERE name=$3),now()) RETURNING user_id)
      INSERT INTO sessions(token,user_id,expires_at) SELECT $4,user_id,now()+interval '45 minutes' FROM fixture`, [actor.id, actor.email, actor.role, actor.token]);
  }
  vehicleType = (await pool.query("INSERT INTO vehicle_types(slug,title) VALUES($1,'Booking acceptance') RETURNING vehicle_type_id", [runId])).rows[0].vehicle_type_id;
  otherType = (await pool.query("INSERT INTO vehicle_types(slug,title) VALUES($1,'Booking acceptance other type') RETURNING vehicle_type_id", [runId + "-other"])).rows[0].vehicle_type_id;
  vehicle = (await pool.query("INSERT INTO vehicles(vehicle_type_id,name,seating_capacity,base_price_per_day) VALUES($1,'Booking acceptance vehicle',4,1000) RETURNING vehicle_id", [vehicleType])).rows[0].vehicle_id;
  await pool.query(`INSERT INTO pricing_rules(booking_type_id,vehicle_type_id,name,base_amount,per_km_rate,tax_percent)
    VALUES((SELECT booking_type_id FROM booking_types WHERE code='point_to_point'),$1,'Booking acceptance',1000,20,5)`, [vehicleType]);
  await pool.query(`INSERT INTO seasonal_pricing(name,starts_on,ends_on,booking_type_id,vehicle_type_id,multiplier,priority)
    SELECT 'Booking acceptance','2020-01-01','2099-12-31',booking_type_id,$1,1,2147483647 FROM booking_types WHERE code IN ('point_to_point','package')`, [vehicleType]);
  await pool.query(`INSERT INTO pricing_rules(booking_type_id,vehicle_type_id,name,tax_percent)
    VALUES((SELECT booking_type_id FROM booking_types WHERE code='package'),$1,'Booking acceptance package',5)`, [vehicleType]);
  packageId = (await pool.query(`INSERT INTO packages(region_id,vehicle_type_id,name,slug,duration_days,max_persons,price_per_person)
    VALUES((SELECT region_id FROM regions WHERE NOT is_deleted AND is_active LIMIT 1),$1,'Booking acceptance package',$2,2,4,400) RETURNING package_id`, [vehicleType, runId])).rows[0].package_id;
  const couponCode = `VERIFY-${runId.slice(0, 24)}`.toUpperCase();
  coupon = (await pool.query("INSERT INTO coupons(code,discount_type,discount_value,usage_limit,per_user_limit) VALUES($1,'flat',100,1,1) RETURNING coupon_id", [couponCode])).rows[0].coupon_id;
  sink = await localMailSink(actors.map(actor => actor.email));
  child = fork(path.resolve("db/tests/_booking-server.cjs"), [], { execArgv: [], silent: true, windowsHide: true,
    env: { ...process.env, NODE_ENV: "development", BOOKING_SMOKE_SERVER: "dev-only", APP_ORIGIN: base,
      SMTP_HOST: "127.0.0.1", SMTP_PORT: String(sink.port), SMTP_USER: "test", SMTP_PASS: "test", EMAIL_FROM: "Booking smoke <smoke@example.invalid>" } });
  for (const stream of [child.stdout, child.stderr]) stream?.on("data", chunk => { serverLog = (serverLog + chunk.toString()).slice(-6000); });
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Isolated development server startup timed out")), 120_000);
    child!.on("message", (message: { ready?: boolean; sandbox?: string }) => {
      if (message.sandbox) sandbox = message.sandbox;
      if (message.ready) { clearTimeout(timer); resolve(); }
    });
    child!.once("exit", code => { clearTimeout(timer); reject(new Error(`Isolated server exited ${code}: ${serverLog}`)); });
  });
  console.log("Isolated Next dev server ready on loopback3103; mail sink accepts only this run's synthetic addresses.");
  for (const actor of actors) assert.equal((await (await api("/api/auth/me", actor)).json()).user?.id, actor.id);
  await expectStatus(api("/api/bookings", null, "POST", {}), 401, "Booking requires login");

  const instance = await chromium.launch({ channel: "chrome", headless: true }); browser = instance;
  const customerContext = await instance.newContext({ viewport: { width: 1280, height: 900 } });
  const adminContext = await instance.newContext({ viewport: { width: 1440, height: 1000 } });
  for (const [context, actor] of [[customerContext, customer], [adminContext, admin]] as const) await context.addCookies([{ name: "session_token", value: actor.token, url: base, httpOnly: true, sameSite: "Lax" }]);
  const page = await customerContext.newPage(), staff = await adminContext.newPage();
  const errors: string[] = [];
  for (const p of [page, staff]) {
    p.on("pageerror", (e: Error) => { errors.push(e.message); console.error("Browser error:", e.message); });
    p.on("console", (message: { type(): string; text(): string }) => { if (message.type() === "error") console.error("Browser console:", message.text().slice(0, 400)); });
    p.on("requestfailed", (request: { url(): string; failure(): { errorText: string } | null }) => console.error("Browser request failed:", new URL(request.url()).pathname, request.failure()?.errorText));
  }
  // The custom pickup/date/map wizard is exercised by car-booking-acceptance.ts.
  // This suite retains quote/coupon authority and the real payment/refund browser lifecycle.
  const initialQuote = await (await expectStatus(api("/api/quotes", customer, "POST", {
    ...bookingInput(), passengers: 2, startDate: "2090-01-01T10:00:00Z", couponCode,
  }), 200, "Trusted route quote with coupon")).json();
  assert.equal(initialQuote.quote.totalAmount, 1155);
  const created = await expectStatus(api("/api/bookings", customer, "POST", {
    ...bookingInput(), startDateTime: "2090-01-01T10:00:00Z", endDateTime: "2090-01-01T12:00:00Z",
    couponCode, expectedTotal: initialQuote.quote.totalAmount, pickupAddress: "Development test pickup", dropAddress: "Development test destination",
  }), 201, "Create quoted coupon booking");
  const { booking: first } = await created.json(); primaryId = first.id;
  assert.equal(first.totalAmount, 1155); assert.equal(first.status, "PendingPayment");
  await page.goto(`${base}/booking/${primaryId}/confirm`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.getByText("Pay by phone to confirm your trip", { exact: true }).waitFor();
  assert.equal(Number((await state(primaryId!)).total_amount), 1155); assert.equal(await activeBlocks(primaryId!), 0);
  assert.equal(Number((await pool.query("SELECT count(*) AS n FROM coupon_redemptions WHERE coupon_id=$1", [coupon])).rows[0].n), 1);
  console.log("PASS trusted-route quote/coupon API -> booking201 -> real browser payment confirmation; stored INR1155, one redemption, no early vehicle hold.");

  await expectStatus(api(`/api/bookings/${primaryId}`, stranger), 404, "Other customer cannot read booking");
  await expectStatus(api(`/api/bookings/${primaryId}`, stranger, "PATCH", { status: "Cancelled" }), 404, "Other customer cannot cancel");
  await expectStatus(api(`/api/bookings/${primaryId}`, customer, "PATCH", { status: "Confirmed" }), 409, "Customer cannot mark payment received");
  await expectStatus(api(`/api/admin/bookings/${primaryId}`, customer, "PATCH", { status: "Confirmed" }), 403, "Admin API requires admin");
  await staff.goto(base + "/admin/bookings", { waitUntil: "domcontentloaded", timeout: 90_000 });
  const row = staff.getByRole("row").filter({ has: staff.getByText(first.reference, { exact: true }) });
  await row.waitFor({ timeout: 90_000 });
  await row.getByRole("combobox").first().selectOption("Confirmed");
  await staff.getByRole("dialog").getByRole("button", { name: "Update booking", exact: true }).click();
  await staff.getByRole("dialog").waitFor({ state: "detached" });
  assert.equal((await state(primaryId!)).status, "Confirmed"); assert.equal(await activeBlocks(primaryId!), 1);
  await expectStatus(api(`/api/admin/bookings/${primaryId}`, admin, "PATCH", { status: "Confirmed" }), 409, "Duplicate payment confirmation rejected");

  await page.goto(`${base}/profile/bookings/${primaryId}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.getByRole("button", { name: "Cancel booking", exact: true }).click({ timeout: 60_000 });
  await page.getByRole("dialog").getByRole("button", { name: "Cancel booking", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "detached" });
  assert.equal((await state(primaryId!)).status, "Cancelled"); assert.equal(await activeBlocks(primaryId!), 0);
  const owed = await refund(primaryId!); assert.equal(Number(owed.amount), 1155); assert.equal(Number(owed.charge_amount), 0); assert.equal(owed.status, "pending");
  await expectStatus(api(`/api/admin/bookings/${primaryId}`, admin, "PATCH", { status: "Refunded" }), 409, "Cannot complete refund before settlement");
  await expectStatus(api(`/api/admin/bookings/${primaryId}/refund`, customer, "POST", { status: "paid" }), 403, "Customer cannot settle refund");
  await staff.reload({ waitUntil: "domcontentloaded" }); await row.waitFor();
  await row.getByRole("button").first().click();
  await staff.getByRole("button", { name: "Mark paid", exact: true }).click();
  const payment = staff.getByRole("dialog");
  await payment.getByLabel("Payment method", { exact: true }).fill("UPI test record");
  await payment.getByLabel("Transaction reference (optional)", { exact: true }).fill("ACCEPTANCE-ONLY");
  await payment.getByRole("button", { name: "Mark paid", exact: true }).click();
  await payment.waitFor({ state: "detached" });
  assert.equal((await refund(primaryId!)).status, "paid"); assert.equal((await refund(primaryId!)).reference, "ACCEPTANCE-ONLY");
  await expectStatus(api(`/api/admin/bookings/${primaryId}/refund`, admin, "POST", { status: "waived" }), 409, "Settled refund cannot be overwritten");
  await row.getByRole("combobox").first().selectOption("Refunded");
  await staff.getByRole("dialog").getByRole("button", { name: "Update booking", exact: true }).click();
  await staff.getByRole("dialog").waitFor({ state: "detached" });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByText("Refunded", { exact: true }).first().waitFor();
  assert.equal((await state(primaryId!)).status, "Refunded");
  assert.deepEqual((await pool.query("SELECT to_status FROM booking_status_history WHERE booking_id=$1 ORDER BY changed_at,booking_status_history_id", [primaryId])).rows.map(r => r.to_status), ["PendingPayment", "Confirmed", "Cancelled", "Refunded"]);
  console.log("PASS real admin mark-paid popup -> reservation -> customer cancellation -> full refund -> settlement metadata -> Refunded; one ordered history and released vehicle.");
  if (artifacts) { await mkdir(artifacts, { recursive: true }); await page.screenshot({ path: path.join(artifacts, "booking-refunded-customer.png"), fullPage: true }); }

  for (const scenario of [{ hours: 48, tier: "half", amount: 630 }, { hours: 12, tier: "none", amount: 0 }, { hours: 12, tier: "operator", amount: 1260 }]) {
    const id = await booking(scenario.hours); await transition(id, "Confirmed");
    await transition(id, "Cancelled", scenario.tier === "operator" ? admin : customer, { refundInitiatedBy: "operator" });
    const result = await refund(id); assert.equal(Number(result.amount), scenario.amount); assert.equal(result.tier, scenario.tier);
    assert.equal(Number(result.charge_amount), 1260 - scenario.amount); assert.equal(await activeBlocks(id), 0);
    if (scenario.amount) await expectStatus(api(`/api/admin/bookings/${id}/refund`, admin, "POST", { status: "waived" }), 200, "Admin waiver recorded");
    await transition(id, "Refunded");
  }
  const unpaid = await booking(120); await transition(unpaid, "Cancelled", customer); assert.equal(await refund(unpaid), undefined); assert.equal(await activeBlocks(unpaid), 0);
  console.log("PASS half/no-refund/operator-full policy, customer cannot claim operator override, explicit waiver and unpaid cancellation; tampered totals/status/owner ignored.");

  for (const invalid of [{ vehicleTypeId: otherType }, { vehicleId: "bad" }, { passengerCount: 5 }]) {
    await expectStatus(api("/api/bookings", customer, "POST", { ...bookingInput(), ...invalid }), 400, "Invalid vehicle/type/capacity rejected");
  }
  await expectStatus(api("/api/bookings", customer, "POST", { ...bookingInput(), vehicleId: 2147483647 }), 409, "Unavailable vehicle rejected");
  await pool.query("UPDATE vehicles SET is_active=false WHERE vehicle_id=$1", [vehicle]);
  try { await expectStatus(api("/api/bookings", customer, "POST", bookingInput()), 409, "Inactive vehicle rejected"); }
  finally { await pool.query("UPDATE vehicles SET is_active=true WHERE vehicle_id=$1", [vehicle]); }
  const packageFacts = { bookingType: "package", packageId, vehicleTypeId: otherType, days: 99, passengers: 2, startDate: stamp(240), packagePricePerPerson: 1, totalAmount: 1 };
  const quote = await (await expectStatus(api("/api/quotes", customer, "POST", packageFacts), 200, "Curated quote resolves authoritative type and price")).json();
  assert.equal(quote.quote.totalAmount, 840);
  const saved = await (await expectStatus(api("/api/bookings", customer, "POST", { ...packageFacts, startDateTime: stamp(240), durationDays: 99, passengerCount: 2 }), 201, "Curated booking resolves authoritative values")).json();
  assert.equal(saved.booking.totalAmount, 840);
  const snapshot = (await pool.query("SELECT vehicle_type_id,duration_days FROM bookings WHERE booking_id=$1", [saved.booking.id])).rows[0];
  assert.equal(snapshot.vehicle_type_id, vehicleType); assert.equal(snapshot.duration_days, 2);
  await expectStatus(api("/api/quotes", customer, "POST", { ...packageFacts, passengers: 5 }), 400, "Curated quote capacity enforced");
  await expectStatus(api("/api/bookings", customer, "POST", { ...packageFacts, startDateTime: stamp(240), passengerCount: 5 }), 400, "Curated booking capacity enforced");
  console.log("PASS vehicle identity/type/activity/capacity guards and curated quote-booking price/type/duration authority.");

  // A real row lock makes both old read-then-write settlement calls overlap.
  const concurrent = await booking(240); await transition(concurrent, "Confirmed"); await transition(concurrent, "Cancelled", customer);
  await expectStatus(api(`/api/admin/bookings/${concurrent}/refund`, admin, "POST", { status: "paid", method: "x".repeat(41) }), 400, "Oversized settlement method rejected");
  await expectStatus(api(`/api/admin/bookings/${concurrent}/refund`, admin, "POST", { status: "paid", reference: "x".repeat(121) }), 400, "Oversized settlement reference rejected");
  const guard = await pool.connect();
  let results;
  try {
    await guard.query("BEGIN"); await guard.query("SELECT 1 FROM refunds WHERE booking_id=$1 FOR UPDATE", [concurrent]);
    const calls = ["paid", "waived"].map(status => api(`/api/admin/bookings/${concurrent}/refund`, admin, "POST", { status, method: "Test", reference: status }));
    const waiting = Promise.all(calls); let blocked = false;
    for (let attempt = 0; attempt < 50; attempt++) {
      const n = (await pool.query("SELECT count(*) AS n FROM pg_stat_activity WHERE wait_event_type='Lock' AND query LIKE 'UPDATE refunds%'" )).rows[0].n;
      if (Number(n) >= 2) { blocked = true; break; }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    await guard.query("ROLLBACK"); results = await waiting;
    assert(blocked, "Both settlements must contend on the row lock");
  } finally { await guard.query("ROLLBACK"); guard.release(); }
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409], "Competing refund settlements must have one winner");
  assert.equal(Number((await pool.query("SELECT count(*) AS n FROM activity_logs WHERE entity_id=$1 AND action='refund.settle'", [concurrent])).rows[0].n), 1);
  console.log("PASS competing refund settlement: one winner and one audit event.");

  for (const [route, actor, method] of [["/api/quotes", null, "POST"], ["/api/bookings", customer, "POST"], [`/api/bookings/${primaryId}`, customer, "PATCH"], [`/api/admin/bookings/${primaryId}`, admin, "PATCH"], [`/api/admin/bookings/${primaryId}/refund`, admin, "POST"]] as const) {
    await expectStatus(api(route, actor, method, null), 400, "Null JSON rejected cleanly");
    await expectStatus(api(route, actor, method, {}, "https://foreign.invalid"), 403, "Foreign origin rejected");
  }
  assert.deepEqual(errors, []); assert.deepEqual(sink.rejected, []); assert(sink.messages.length > 0);
  const sent = Number((await pool.query("SELECT count(*) AS n FROM notifications WHERE user_id=ANY($1::uuid[]) AND status='sent'", [userIds])).rows[0].n);
  assert.equal(sent, sink.messages.length);
  assert.equal(Number((await pool.query("SELECT count(*) AS n FROM notifications WHERE user_id=ANY($1::uuid[]) AND status='failed'", [userIds])).rows[0].n), 0);
  console.log(`PASS ${checks} API checks; ${sent} notifications captured only by the loopback SMTP sink. No real payment/refund or external email.`);
} catch (error) {
  console.error("Recent isolated server log:", serverLog.replace(/postgres(?:ql)?:\/\/\S+/g, "[redacted database URL]"));
  throw error;
} finally {
  try { await browser?.close(); }
  finally {
    if (child && child.exitCode === null) {
      await new Promise<void>(resolve => { const timer = setTimeout(() => { child?.kill(); resolve(); }, 20_000); child!.once("exit", () => { clearTimeout(timer); resolve(); }); if (child!.connected) child!.send("stop"); else child!.kill(); });
    }
    await sink?.close();
    try {
      await pool.query("DELETE FROM map_service_cache WHERE cache_key=$1", [routeId]);
      assert.equal((await pool.query("SELECT count(*)::int AS n FROM map_service_cache WHERE cache_key=$1",[routeId])).rows[0].n,0);
      await pool.query("DELETE FROM notifications WHERE user_id=ANY($1::uuid[])", [userIds]);
      await pool.query("DELETE FROM activity_logs WHERE user_id=ANY($1::uuid[])", [userIds]);
      await pool.query("DELETE FROM bookings WHERE user_id=ANY($1::uuid[])", [userIds]);
      if (packageId) await pool.query("DELETE FROM packages WHERE package_id=$1", [packageId]);
      if (vehicleType) {
        await pool.query("DELETE FROM vehicles WHERE vehicle_type_id=$1", [vehicleType]);
        await pool.query("DELETE FROM pricing_rules WHERE vehicle_type_id=$1", [vehicleType]);
        await pool.query("DELETE FROM seasonal_pricing WHERE vehicle_type_id=$1", [vehicleType]);
        await pool.query("DELETE FROM vehicle_types WHERE vehicle_type_id=$1", [vehicleType]);
      }
      if (otherType) await pool.query("DELETE FROM vehicle_types WHERE vehicle_type_id=$1", [otherType]);
      if (coupon) await pool.query("DELETE FROM coupons WHERE coupon_id=$1", [coupon]);
      await pool.query("DELETE FROM sessions WHERE user_id=ANY($1::uuid[])", [userIds]);
      await pool.query("DELETE FROM users WHERE user_id=ANY($1::uuid[]) AND name='Booking acceptance'", [userIds]);
      const remaining = await pool.query(`SELECT (SELECT count(*) FROM users WHERE user_id=ANY($1::uuid[])) +
        (SELECT count(*) FROM bookings WHERE user_id=ANY($1::uuid[])) + (SELECT count(*) FROM notifications WHERE user_id=ANY($1::uuid[])) +
        (SELECT count(*) FROM activity_logs WHERE user_id=ANY($1::uuid[])) + (SELECT count(*) FROM vehicle_types WHERE vehicle_type_id=$2) AS n`, [userIds, vehicleType ?? null]);
      assert.equal(Number(remaining.rows[0].n), 0);
      console.log("Temporary development fixtures removed and verified; isolated test server/mail sink stopped. No schema or production changes.");
    } finally {
      await pool.end();
      if (sandbox) {
        // Resolve and constrain the exact directory before recursive cleanup.
        const resolved = await realpath(sandbox), tempRoot = await realpath(os.tmpdir());
        assert.equal(path.dirname(resolved), tempRoot);
        assert(path.basename(resolved).startsWith("travel-booking-acceptance-"));
        const dependencies = path.join(resolved, "node_modules");
        const link = await lstat(dependencies).catch(() => null);
        if (link) {
          assert(link.isSymbolicLink());
          assert.equal(await realpath(dependencies), await realpath("node_modules"));
          await unlink(dependencies); // Never recurse into the repository dependencies.
        }
        await rm(resolved, { recursive: true, force: true, maxRetries: 6, retryDelay: 500 });
        console.log("Isolated source/build directory removed; repository dependencies preserved.");
      }
    }
  }
}

/** Admin browser -> API -> restricted dev DB. Synthetic rows only; no DDL/prod/mail. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync, fork } from "node:child_process";
import { createRequire } from "node:module";
import { mkdir, realpath, lstat, unlink, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import pg from "pg";
import { runtimeDatabaseConfig } from "../../src/lib/server/db-config.ts";
import { localMailSink } from "./_local-smtp.mjs";
import { discardUpload } from "../../src/lib/server/cloudinary.ts";
import type { AdminDeparture, DepartureInput, Guide } from "../../src/lib/weekend-trips.ts";
import { cmsCatalogueAcceptance } from './cms-catalogue-acceptance.ts';

assert(process.argv.includes("--dev") && !process.env.VERCEL, "Development only");
assert.equal(execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim(), "development");
const endpoint = (url: string) => new URL(url).hostname.replace(/-pooler\./, ".");
const owner = process.env.DATABASE_URL!, runtime = process.env.DATABASE_URL_APP!;
assert(owner && runtime && process.env.DATABASE_URL_PRODUCTION);
assert.equal(endpoint(owner), endpoint(runtime)); assert.notEqual(endpoint(owner), endpoint(process.env.DATABASE_URL_PRODUCTION));
const modulePath = process.argv.find(arg => arg.startsWith("--browser-module="))?.slice(17); assert(modulePath);
const { chromium } = createRequire(import.meta.url)(modulePath);
const artifacts = process.argv.find(arg => arg.startsWith("--artifacts="))?.slice(12);
const pool = new pg.Pool({ ...runtimeDatabaseConfig(owner), max: 3 });
const actors = ["admin", "customer", "customer"].map(role => ({ role, id: randomUUID(), token: randomUUID() }));
const [admin, customer, other] = actors, ids = actors.map(actor => actor.id), run = "weekend-check-" + randomUUID();
const base = "http://127.0.0.1:3103", route = "/api/admin/weekend-trips";
let child: ReturnType<typeof fork> | undefined, browser: { close(): Promise<void> } | undefined, sandbox: string | undefined, sink: Awaited<ReturnType<typeof localMailSink>> | undefined;
let vehicleType: number | undefined, vehicle: number | undefined, driver: number | undefined, packageId: number | undefined, checks = 0, log = "";
const assets: string[] = [], browserErrors: string[] = [], cmsPages: string[] = [];
const redact = (text: string) => text.replace(/postgres(?:ql)?:\/\/\S+/g, "[database URL]");
async function api(url: string, actor: typeof admin | null = admin, method = "GET", body?: unknown, origin = base) {
  return fetch(base + url, { method, signal: AbortSignal.timeout(120000), headers: { "Content-Type": "application/json", Origin: origin, ...(actor ? { Cookie: `session_token=${actor.token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
async function expect(response: Promise<Response>, status: number, label: string) {
  const result = await response; checks++; assert.equal(result.status, status, label); return result;
}
async function read(id: string): Promise<AdminDeparture> { return (await (await expect(api(route + '/' + id), 200, "Read departure")).json()).item; }

try {
  for (const actor of actors) await pool.query(`WITH fixture AS (INSERT INTO users(user_id,name,email,phone,password_hash,role_id,email_verified_at)
    SELECT $1,'Weekend acceptance',$2,'',$3,role_id,now() FROM roles WHERE name=$4 RETURNING user_id)
    INSERT INTO sessions(token,user_id,expires_at) SELECT $5,user_id,now()+interval '90 minutes' FROM fixture`, [actor.id, `${actor.id}@example.invalid`, randomUUID(), actor.role, actor.token]);
  const city = (await pool.query("SELECT city_id,region_id FROM cities WHERE NOT is_deleted AND is_active ORDER BY city_id LIMIT 1")).rows[0]; assert(city, "An existing active development city is needed");
  vehicleType = (await pool.query("INSERT INTO vehicle_types(slug,title,created_by) VALUES($1,'Weekend acceptance',$2) RETURNING vehicle_type_id", [run, admin.id])).rows[0].vehicle_type_id;
  vehicle = (await pool.query("INSERT INTO vehicles(vehicle_type_id,name,seating_capacity,base_price_per_day,created_by) VALUES($1,'Weekend acceptance coach',12,1000,$2) RETURNING vehicle_id", [vehicleType, admin.id])).rows[0].vehicle_id;
  driver = (await pool.query("INSERT INTO drivers(name,phone,created_by) VALUES('Weekend acceptance driver','0000000000',$1) RETURNING driver_id", [admin.id])).rows[0].driver_id;
  packageId = (await pool.query("INSERT INTO packages(region_id,vehicle_type_id,name,slug,duration_days,max_persons,price_per_person,booking_mode,created_by) VALUES($1,$2,$3,$4,3,10,4999,'shared',$5) RETURNING package_id", [city.region_id, vehicleType, run, run, admin.id])).rows[0].package_id;
  const spot = (await pool.query('SELECT tourist_spot_id,name FROM tourist_spots WHERE is_active AND NOT is_deleted ORDER BY tourist_spot_id LIMIT 1')).rows[0]; assert(spot);
  await pool.query('INSERT INTO package_stops(package_id,tourist_spot_id,stop_order,created_by) VALUES($1,$2,1,$3)', [packageId, spot.tourist_spot_id, admin.id]);
  sink = await localMailSink(actors.map(actor => `${actor.id}@example.invalid`));
  const built = process.argv.includes('--built');
  const childEnv = { ...process.env, DATABASE_URL: runtime, NODE_ENV: built ? "production" : "development", VERCEL_ENV: "development", BOOKING_SMOKE_BUILD: built ? "1" : "0", BOOKING_SMOKE_SERVER: "dev-only", APP_ORIGIN: base, SMTP_HOST: "127.0.0.1", SMTP_PORT: String(sink.port), SMTP_USER: "test", SMTP_PASS: "test", EMAIL_FROM: "Weekend acceptance <test@example.invalid>" };
  delete childEnv.DATABASE_URL_PRODUCTION;
  child = fork(path.resolve("db/tests/_booking-server.cjs"), [], { execArgv: [], silent: true, windowsHide: true, env: childEnv });
  for (const stream of [child.stdout, child.stderr]) stream?.on("data", chunk => { log = (log + chunk.toString()).slice(-8000); });
  await new Promise<void>((resolve, reject) => { const timer = setTimeout(() => reject(Error("Isolated server startup timed out")), built ? 600000 : 120000); child!.on("message", (message: { ready?: boolean; sandbox?: string; built?: boolean }) => { if (message.sandbox) sandbox = message.sandbox; if (message.built) console.log('Optimized local build passed.'); if (message.ready) { clearTimeout(timer); resolve(); } }); child!.once("exit", code => { clearTimeout(timer); reject(Error(`Server exited ${code}`)); }); });
  console.log("Weekend admin test server ready; restricted development DB, no external email.");
  await expect(api(route, null), 401, "Guests cannot manage trips");
  await expect(api(route, customer), 403, "Customers cannot manage trips");
  await expect(api("/api/admin/tour-guides", customer), 403, "Guide contacts private");
  for (const value of [null, [], {}, { title: "x" }]) await expect(api(route, admin, "POST", value), 400, "Malformed trip");
  await expect(api(route, admin, "POST", {}, "https://foreign.invalid"), 403, "Origin guard");
  await expect(api("/api/quotes", null, "POST", { bookingType: "package", packageId, vehicleTypeId: vehicleType, passengers: 1 }), 404, "Shared-only template cannot use private quote");
  const instance = await chromium.launch({ channel: "chrome", headless: true }); browser = instance;
  const context = await instance.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
  await context.addCookies([{ name: "session_token", value: admin.token, url: base, httpOnly: true, sameSite: "Lax" }]);
  const page = await context.newPage(); page.on("pageerror", (error: Error) => browserErrors.push(redact(error.message)));
  page.on("requestfailed", (request: { url(): string; failure(): { errorText: string } | null }) => console.error("Browser request failed", request.url(), request.failure()?.errorText));
  page.on("console", (message: { type(): string; text(): string }) => { if (message.type() === "error") console.error("Browser console", redact(message.text())); });
  await page.goto(base + "/admin/tour-guides", { waitUntil: "domcontentloaded", timeout: 120000 });
  try { await page.getByRole("button", { name: "Add guide", exact: true }).click(); }
  catch (error) { console.error("Guide browser boundary", page.url(), await page.locator('body').innerText(), browserErrors); if (artifacts) await page.screenshot({ path: path.join(artifacts, "weekend-admin-failure.png") }); throw error; }
  await page.getByLabel("Guide name", { exact: true }).fill("Weekend acceptance guide");
  await page.getByLabel("Private contact number").fill("0000000000");
  await page.getByLabel("Public introduction").fill("A friendly guide for the acceptance journey.");
  await page.getByLabel("Languages", { exact: false }).fill("Hindi,English");
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=", "base64");
  const upload = page.waitForResponse((response: { url(): string; request(): { method(): string } }) => response.url().endsWith(route + "/image") && response.request().method() === "POST");
  await page.locator('input[type="file"]').setInputFiles({ name: "weekend-guide.png", mimeType: "image/png", buffer: png });
  const uploaded = await (await upload).json(); assert(uploaded.url); assert(uploaded.publicId.startsWith("jagdamba/development/")); assets.push(uploaded.publicId);
  await page.getByRole("button", { name: "Save guide", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden", timeout: 30000 });
  const guides: Guide[] = (await (await api("/api/admin/tour-guides")).json()).items;
  const guide = guides.find(item => item.name === "Weekend acceptance guide" && item.imageUrl === uploaded.url); assert(guide);
  assert.deepEqual(guide.languages, ["Hindi", "English"]);
  console.log("Real guide form and Cloudinary upload saved and read back.");
  const date = new Date(Date.now() + 14 * 86400000); while (date.getUTCDay() !== 5) date.setUTCDate(date.getUTCDate() + 1);
  const startsAt = date.toISOString().slice(0, 10) + "T16:30:00.000Z", endsAt = new Date(Date.parse(startsAt) + 2 * 86400000).toISOString();
  const night = new Date(Date.parse(startsAt) + 86400000).toISOString().slice(0, 10);
  const data: DepartureInput = { packageId: packageId!, slug: run, title: "Weekend acceptance departure", startsAt, endsAt, pickupCityId: city.city_id, pickupAddress: "Main station", returnAddress: "Main station", vehicleId: vehicle!, driverId: driver!, guideId: guide.id, capacity: 10, staffReservedSeats: 1, minTravellers: 4, pricePerPerson: 4999, taxPercent: 5, bookingOpensAt: new Date(Date.now() - 60000).toISOString(), bookingClosesAt: new Date(Date.parse(startsAt) - 86400000).toISOString(), decisionDeadline: new Date(Date.parse(startsAt) - 2 * 86400000).toISOString(), paymentHoldMinutes: 120, content: { summary: "Meet the group", description: "A complete shared trip.", imageUrl: uploaded.url, imageAlt: "Test trip photo", itinerary: [{ day: 1, title: "Meet and travel", description: "Friday evening pickup" }, { day: 2, title: "Explore", description: "A guided day together" }], inclusions: ["Transport", "Guide", "Hotel"], exclusions: ["Personal shopping"], stayNights: [night] }, privateNotes: "Internal operations", isFeatured: true, displayOrder: 0, stays: [{ hotelName: "Weekend acceptance hotel", hotelAddress: "Hotel road", cityId: city.city_id, imageUrl: uploaded.url, checkIn: night, checkOut: endsAt.slice(0, 10), roomType: "Twin", roomsReserved: 6, occupancyPerRoom: 2, staffBedsReserved: 2, mealPlan: "Breakfast", confirmationStatus: "confirmed", supplierReference: "PRIVATE-REFERENCE", contactName: "Hotel team", contactPhone: "0000000000", supplierCost: 9000, publicNotes: "Shared rooms", privateNotes: "PRIVATE-HOTEL-NOTE" }] };
  let item: AdminDeparture = (await (await expect(api(route, admin, "POST", data), 201, "Create full draft")).json()).item;
  assert.equal(item.status, "draft"); assert.equal(item.stays[0].hotelName, data.stays[0].hotelName);
  assert.equal(item.stays[0].checkIn, data.stays[0].checkIn); assert.equal(item.stays[0].checkOut, data.stays[0].checkOut);
  await expect(api(route, admin, "POST", data), 409, "Duplicate trip address");
  await expect(api(route, admin, "POST", { ...data, slug: run + '-capacity', capacity: 12 }), 400, "Staff seats count towards vehicle capacity");
  const before = item;
  await expect(api(route + '/' + item.id, admin, "PATCH", { ...item, title: "Must roll back", stays: [{ ...item.stays[0], id: randomUUID() }] }), 400, "Foreign hotel identifier");
  item = await read(item.id); assert.equal(item.title, before.title); assert.equal(item.version, before.version);
  const competing = await Promise.all([1,2].map(n => api(route + '/' + item.id, admin, "PATCH", { ...item, title: "Concurrent trip " + n })));
  assert.deepEqual(competing.map(result => result.status).sort(), [200,409]); checks += 2;
  item = await read(item.id);
  await page.goto(base + "/admin/weekend-trips", { waitUntil: "networkidle", timeout: 120000 });
  await page.getByRole("button", { name: "Edit " + item.title, exact: true }).click();
  await page.getByLabel("Trip title", { exact: true }).fill("Weekend browser edited");
  await page.getByRole("tab", { name: "Hotels", exact: true }).click();
  await page.getByLabel("Hotel name · hotel 1", { exact: true }).fill("Hotel edited through browser");
  await page.getByRole("tab", { name: "Preview", exact: true }).click();
  await page.getByRole("heading", { name: "Weekend browser edited", exact: true }).waitFor();
  if (artifacts) { await mkdir(artifacts, { recursive: true }); await page.screenshot({ path: path.join(artifacts, "weekend-admin-desktop.png") }); }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const dimensions = await page.evaluate(() => ({ width: innerWidth, document: document.documentElement.scrollWidth })); assert(dimensions.document <= dimensions.width + 1);
  if (artifacts) await page.screenshot({ path: path.join(artifacts, "weekend-admin-mobile.png") });
  const savedResponse = page.waitForResponse((response: { url(): string; request(): { method(): string } }) => response.url().endsWith(route + '/' + item.id) && response.request().method() === 'PATCH');
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  const saved = await savedResponse; assert.equal(saved.status(), 200, await saved.text());
  await page.getByRole("dialog").waitFor({ state: "hidden", timeout: 30000 });
  item = await read(item.id); assert.equal(item.title, "Weekend browser edited"); assert.equal(item.stays[0].hotelName, "Hotel edited through browser");
  assert.equal((await pool.query("SELECT booking_mode FROM packages WHERE package_id=$1", [packageId])).rows[0].booking_mode, "shared");
  if(process.argv.includes('--full')) {
    const ops=route+'/'+item.id+'/operations';
    await expect(api(ops,customer),403,'Traveller manifest is admin-only');
    await expect(api('/api/weekend-trips/'+item.slug,null),404,'Draft is not public');
    await page.setViewportSize({width:1440,height:1000});
    await page.getByLabel('Find a departure').fill(item.title);
    await page.getByRole('button',{name:'Manage trip',exact:true}).click();
    await page.getByRole('button',{name:'Open bookings',exact:true}).click();
    let confirmation=page.getByRole('dialog',{name:'Open bookings?',exact:true});
    await confirmation.getByRole('button',{name:'Cancel',exact:true}).click();
    assert.equal((await read(item.id)).status,'draft');
    await page.getByRole('button',{name:'Open bookings',exact:true}).click();
    confirmation=page.getByRole('dialog',{name:'Open bookings?',exact:true});
    const opened=page.waitForResponse((r:{url():string;request():{method():string}})=>r.url().endsWith(ops)&&r.request().method()==='POST');
    await confirmation.getByRole('button',{name:'Open bookings',exact:true}).click();
    const openedResponse=await opened;assert.equal(openedResponse.status(),200,await openedResponse.text());
    await confirmation.waitFor({state:'hidden'});
    const publicTrip=(await (await expect(api('/api/weekend-trips/'+item.slug,null),200,'Published trip')).json()).item;
    const publicText=JSON.stringify(publicTrip);for(const hidden of ['PRIVATE-REFERENCE','PRIVATE-HOTEL-NOTE','Internal operations','supplierCost','privateNotes','contactPhone'])assert(!publicText.includes(hidden),hidden+' never public');
    assert.equal(publicTrip.pricePerPerson,4999);assert.equal(publicTrip.availableSeats,10);
    assert.deepEqual(publicTrip.content.routeStops, [{id:spot.tourist_spot_id,name:spot.name}]);
    await pool.query('UPDATE package_stops SET is_deleted=true WHERE package_id=$1 AND created_by=$2',[packageId,admin.id]);
    for(const query of ['maxPrice=1','seats=11','from=2199-01-01'])assert(!(await (await expect(api('/api/weekend-trips?'+query,null),200,'Live listing filter')).json()).items.some((t:{id:string})=>t.id===item.id));
    await expect(api('/api/weekend-trips?seats=-1',null),400,'Invalid filter');
    const customerContext=await instance.newContext({viewport:{width:1280,height:950},reducedMotion:'reduce'});
    await customerContext.addCookies([{name:'session_token',value:customer.token,url:base,httpOnly:true,sameSite:'Lax'}]);
    const visitor=await customerContext.newPage();visitor.on('pageerror',(e:Error)=>browserErrors.push(e.message));
    await visitor.goto(base+'/weekend-trips/'+item.slug,{waitUntil:'domcontentloaded',timeout:120000});
    await visitor.getByRole('heading',{name:item.title,exact:true}).waitFor();
    if(artifacts)await visitor.screenshot({path:path.join(artifacts,'weekend-public-desktop.png')});
    await visitor.setViewportSize({width:390,height:844});await visitor.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    assert(await visitor.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    if(artifacts)await visitor.screenshot({path:path.join(artifacts,'weekend-public-mobile.png')});
    await visitor.getByRole('link',{name:'Choose my seats',exact:true}).click();
    await visitor.getByLabel('Number of travellers',{exact:true}).fill('2');
    await visitor.getByLabel('Full name · traveller 1',{exact:true}).fill('Weekend traveller one');
    await visitor.getByLabel('Contact number · traveller 1',{exact:true}).fill('0000000000');
    await visitor.getByLabel('Full name · traveller 2',{exact:true}).fill('Weekend companion');
    await visitor.getByRole('checkbox').check();
    await visitor.getByRole('button',{name:'Reserve my seats',exact:true}).click();
    let reserve=visitor.getByRole('dialog',{name:'Reserve these seats?',exact:true});await reserve.getByRole('button',{name:'Cancel',exact:true}).click();
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM bookings WHERE departure_id=$1',[item.id])).rows[0].n,0);
    if(artifacts)await visitor.screenshot({path:path.join(artifacts,'weekend-checkout-mobile.png')});
    await visitor.getByRole('button',{name:'Reserve my seats',exact:true}).click();reserve=visitor.getByRole('dialog',{name:'Reserve these seats?',exact:true});
    const createdResponse=visitor.waitForResponse((r:{url():string;request():{method():string}})=>r.url().endsWith('/api/bookings')&&r.request().method()==='POST');
    await reserve.getByRole('button',{name:'Hold my seats',exact:true}).click();const created=await createdResponse;assert.equal(created.status(),201,await created.text());
    const booking=(await created.json()).booking;assert.equal(booking.totalAmount,9998);assert.equal(booking.passengers.length,2);
    assert.deepEqual(booking.tripSnapshot.content.routeStops, [{id:spot.tourist_spot_id,name:spot.name}]);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM booking_stops WHERE booking_id=$1 AND custom_label=$2',[booking.id,spot.name])).rows[0].n,1);
    await visitor.waitForURL('**/profile/bookings/'+booking.id);await visitor.getByRole('heading',{name:'Your seats are temporarily held',exact:true}).waitFor();
    const otherBooking=(await (await expect(api('/api/bookings',other,'POST',{departureId:item.id,clientRequestId:randomUUID(),passengerCount:2,passengers:[{name:'Another customer',phone:'0000000000'},{name:'Other companion'}]}),201,'Second unrelated customer')).json()).booking;
    await expect(api('/api/bookings/'+booking.id,other),404,'Other customer cannot read booking');
    assert.equal((await (await api('/api/weekend-trips/'+item.slug,null)).json()).item.availableSeats,6);
    const cms = process.argv.includes('--cms') ? await cmsCatalogueAcceptance({ adminPage: page, browser: instance, base, api, admin, customer, pool, packageId, category: run, regionId: city.region_id, cityId: city.city_id, trip: item, createdPages: cmsPages, artifacts, errors: browserErrors }) : null;
    await page.getByRole('button',{name:'Close dialog',exact:true}).click();
    await page.getByRole('button',{name:'Manage trip',exact:true}).click();
    for(const booked of [booking,otherBooking]) {
      await page.locator('article').filter({hasText:booked.reference}).getByRole('button',{name:'Confirm payment',exact:true}).click();
      const paidDialog=page.getByRole('dialog',{name:'Confirm offline payment?',exact:true});
      const paidResponse=page.waitForResponse((r:{url():string;request():{method():string}})=>r.url().endsWith('/api/admin/bookings/'+booked.id)&&r.request().method()==='PATCH');
      await paidDialog.getByRole('button',{name:'Payment received',exact:true}).click();const paid=await paidResponse;assert.equal(paid.status(),200,await paid.text());await paidDialog.waitFor({state:'hidden'});
    }
    await page.getByRole('button',{name:'Guarantee departure',exact:true}).click();
    const guaranteed=page.getByRole('dialog',{name:'Guarantee departure?',exact:true});await guaranteed.getByRole('button',{name:'Guarantee departure',exact:true}).click();await guaranteed.waitFor({state:'hidden'});
    await page.getByRole('tab',{name:'Hotel rooms',exact:true}).click();await page.getByRole('button',{name:'Assign room',exact:true}).click();
    const roomDialog=page.getByRole('dialog',{name:'Traveller room allocation',exact:true});await roomDialog.getByLabel('Traveller',{exact:true}).selectOption({label:'Weekend traveller one · '+booking.reference});await roomDialog.getByLabel('Room label',{exact:true}).fill('Room A');await roomDialog.getByRole('button',{name:'Save allocation',exact:true}).click();await roomDialog.waitFor({state:'hidden'});
    assert.equal((await (await api('/api/bookings/'+booking.id,customer)).json()).booking.roomAssignments[0].roomLabel,'Room A');
    assert.equal((await (await api('/api/bookings/'+otherBooking.id,other)).json()).booking.roomAssignments.length,0);
    if(artifacts)await page.screenshot({path:path.join(artifacts,'weekend-operations-desktop.png')});
    await visitor.reload({waitUntil:'domcontentloaded'});await visitor.getByRole('button',{name:'Cancel booking',exact:true}).click();const cancel=visitor.getByRole('dialog',{name:'Cancel booking '+booking.reference+'?',exact:true});await cancel.getByRole('button',{name:'Cancel booking',exact:true}).click();await cancel.waitFor({state:'hidden'});
    assert.equal((await (await api('/api/bookings/'+booking.id,customer)).json()).booking.status,'Cancelled');
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM vehicle_availability WHERE departure_id=$1 AND NOT is_deleted",[item.id])).rows[0].n,1);
    if(cms) await cms.page.locator(`[data-cms-catalogue="${cms.sectionId}"]`).getByText('8 seats available',{exact:true}).waitFor({timeout:45000});
    await page.getByRole('button',{name:'Cancel departure',exact:true}).click();const cancelled=page.getByRole('dialog',{name:'Cancel departure?',exact:true});await cancelled.getByLabel('Cancellation reason',{exact:true}).fill('Acceptance operator cancellation');await cancelled.getByRole('button',{name:'Cancel departure',exact:true}).click();await cancelled.waitFor({state:'hidden'});
    const refunded=(await (await api('/api/bookings/'+otherBooking.id,other)).json()).booking;assert.equal(refunded.status,'Cancelled');assert.equal(refunded.refund.amount,9998);assert.equal(refunded.refund.tier,'operator');
    await expect(api('/api/admin/bookings/'+otherBooking.id+'/refund',admin,'POST',{status:'paid',method:'Test transfer',reference:run}),200,'Offline refund settled');
    await expect(api('/api/admin/bookings/'+otherBooking.id,admin,'PATCH',{status:'Refunded'}),200,'Refund closed');
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM vehicle_availability WHERE departure_id=$1 AND NOT is_deleted",[item.id])).rows[0].n,0);
    assert(sink.messages.length>=6);assert.deepEqual(sink.rejected,[]);
    console.log('PASS real public/mobile checkout -> seat holds -> two customer bookings -> admin payment/guarantee/room -> individual and whole-trip cancellation -> offline refund.');
  }
  assert.deepEqual(browserErrors, []);
  console.log(`Weekend admin acceptance passed: ${checks} HTTP checks plus real browser/upload/DB assertions.`);
} catch (error) { console.error("Recent isolated server output:", redact(log)); throw error; }
finally {
  await browser?.close();
  if (child && child.exitCode === null) await new Promise<void>(resolve => { const timer = setTimeout(() => { child?.kill(); resolve(); }, 20000); child!.once("exit", () => { clearTimeout(timer); resolve(); }); if (child!.connected) child!.send("stop"); else child!.kill(); });
  await sink?.close();
  try {
    const cleanup = await pool.connect();
    try {
      await cleanup.query("BEGIN");
      await cleanup.query('DELETE FROM cms_page_revisions WHERE page_id=ANY($1::uuid[])', [cmsPages]);
      await cleanup.query('DELETE FROM cms_pages WHERE page_id=ANY($1::uuid[]) AND created_by=$2', [cmsPages, admin.id]);
      const departures = (await cleanup.query("SELECT departure_id FROM trip_departures WHERE created_by=ANY($1::uuid[])", [ids])).rows.map(row => row.departure_id);
      await cleanup.query("DELETE FROM trip_room_assignments WHERE stay_id IN (SELECT stay_id FROM trip_stays WHERE departure_id=ANY($1::uuid[]))", [departures]);
      await cleanup.query("DELETE FROM trip_stays WHERE departure_id=ANY($1::uuid[])", [departures]);
      await cleanup.query("DELETE FROM vehicle_availability WHERE departure_id=ANY($1::uuid[])", [departures]);
      await cleanup.query("DELETE FROM notifications WHERE user_id=ANY($1::uuid[])",[ids]);
      await cleanup.query("DELETE FROM bookings WHERE created_by=ANY($1::uuid[])", [ids]);
      await cleanup.query("DELETE FROM trip_departures WHERE departure_id=ANY($1::uuid[])", [departures]);
      await cleanup.query("DELETE FROM tour_guides WHERE created_by=ANY($1::uuid[])", [ids]);
      if (packageId) await cleanup.query("DELETE FROM packages WHERE package_id=$1 AND created_by=$2", [packageId, admin.id]);
      if (driver) await cleanup.query("DELETE FROM drivers WHERE driver_id=$1 AND created_by=$2", [driver, admin.id]);
      if (vehicle) await cleanup.query("DELETE FROM vehicles WHERE vehicle_id=$1 AND created_by=$2", [vehicle, admin.id]);
      if (vehicleType) await cleanup.query("DELETE FROM vehicle_types WHERE vehicle_type_id=$1 AND created_by=$2", [vehicleType, admin.id]);
      await cleanup.query("DELETE FROM activity_logs WHERE user_id=ANY($1::uuid[])", [ids]);
      await cleanup.query("DELETE FROM users WHERE user_id=ANY($1::uuid[]) AND name='Weekend acceptance'", [ids]);
      const remaining = (await cleanup.query("SELECT (SELECT count(*) FROM trip_departures WHERE departure_id=ANY($1::uuid[]))+(SELECT count(*) FROM users WHERE user_id=ANY($2::uuid[]))+(SELECT count(*) FROM tour_guides WHERE created_by=ANY($2::uuid[])) AS n", [departures, ids])).rows[0]; assert.equal(Number(remaining.n), 0);
      await cleanup.query("COMMIT");
    } catch (error) { await cleanup.query("ROLLBACK"); throw error; } finally { cleanup.release(); }
    for (const id of assets) { assert(id.startsWith("jagdamba/development/")); await discardUpload(id); }
    console.log("Weekend admin fixtures and development upload cleaned; no production access.");
  } finally {
    await pool.end();
    if (sandbox) { const resolved = await realpath(sandbox); assert.equal(path.dirname(resolved), await realpath(os.tmpdir())); assert(path.basename(resolved).startsWith("travel-booking-acceptance-")); const dependencies = path.join(resolved, "node_modules"), link = await lstat(dependencies).catch(() => null); if (link) { assert(link.isSymbolicLink()); assert.equal(await realpath(dependencies), await realpath("node_modules")); await unlink(dependencies); } await rm(resolved, { recursive: true, force: true, maxRetries: 6, retryDelay: 500 }); }
  }
}

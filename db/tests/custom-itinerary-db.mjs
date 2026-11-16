// Real development bookings using the existing car day rate. Own fixtures and loopback mail only.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { getPool } from "../../src/lib/server/db.ts";
import { runtimeDatabaseConfig } from "../../src/lib/server/db-config.ts";
import { resolveBookingTypeId, resolvePricingRule, resolveVehicleDailyRule } from "../../src/lib/server/pricing-rules.ts";
import { createBooking } from "../../src/lib/server/bookings.ts";
import { localMailSink } from "./_local-smtp.mjs";
const require = createRequire(import.meta.url), { Pool } = require("pg");
assert(process.argv.includes("--dev") && !process.env.VERCEL);
const host = value => new URL(value).hostname.replace("-pooler.", ".");
assert.notEqual(host(process.env.DATABASE_URL), host(process.env.DATABASE_URL_PRODUCTION));
assert.equal(host(process.env.DATABASE_URL), host(process.env.DATABASE_URL_APP));
const pool = new Pool({ ...runtimeDatabaseConfig(process.env.DATABASE_URL), max: 2 });
const tag = randomUUID(), id = randomUUID(), email = `custom-${tag}@example.invalid`, name = `Custom itinerary test ${tag}`;
let region, city, type, vehicle, sink;
const runtimePool = getPool(), originalQuery = runtimePool.query.bind(runtimePool);
let simulateMissingPackageRule = true;
const originalConnect = runtimePool.connect.bind(runtimePool);
// Development has a catch-all rule absent in production. Simulate only that
// confirmed configuration difference for this owned vehicle; all vehicle/rate
// reads, booking writes, row locks and notification delivery use real systems.
runtimePool.query = (text, values, ...rest) => {
  if (simulateMissingPackageRule && typeof text === "string" && text.includes("FROM pricing_rules") && values?.[2] === vehicle) return Promise.resolve({ rows: [], rowCount: 0 });
  return originalQuery(text, values, ...rest);
};
const originalFetch = globalThis.fetch;
globalThis.fetch = () => { throw Error("Custom itinerary regression must not call external providers"); };
try {
  const inbox = String((await pool.query("SELECT setting_value FROM site_settings WHERE setting_key='contact_email'")).rows[0]?.setting_value || "");
  sink = await localMailSink([email, ...(inbox ? [inbox] : [])]);
  Object.assign(process.env, { SMTP_HOST: "127.0.0.1", SMTP_PORT: String(sink.port), SMTP_USER: "test", SMTP_PASS: "test", EMAIL_FROM: "Custom test <test@example.invalid>" });
  await pool.query("INSERT INTO users(user_id,name,email,phone,password_hash,email_verified_at,role_id) VALUES($1,$2,$3,'','unusable',now(),(SELECT role_id FROM roles WHERE name='customer'))", [id, name, email]);
  region = (await pool.query("INSERT INTO regions(name,state) VALUES($1,'Test') RETURNING region_id", [name])).rows[0].region_id;
  city = (await pool.query("INSERT INTO cities(region_id,name) VALUES($1,$2) RETURNING city_id", [region, name])).rows[0].city_id;
  type = (await pool.query("INSERT INTO vehicle_types(slug,title) VALUES($1,$2) RETURNING vehicle_type_id", [tag, name])).rows[0].vehicle_type_id;
  vehicle = (await pool.query("INSERT INTO vehicles(vehicle_type_id,name,seating_capacity,base_price_per_day) VALUES($1,$2,6,3500) RETURNING vehicle_id", [type, name])).rows[0].vehicle_id;
  const spots = [];
  for (const label of ["Start", "Mountains"]) spots.push((await pool.query("INSERT INTO tourist_spots(city_id,name) VALUES($1,$2) RETURNING tourist_spot_id", [city, `${name} ${label}`])).rows[0].tourist_spot_id);
  const bookingType = await resolveBookingTypeId("package");
  assert.equal(await resolvePricingRule(bookingType, type, vehicle), null, "Owned fixture must exercise the missing-rule case");
  assert.equal((await resolveVehicleDailyRule(vehicle)).perDayRate, 3500);
  const user = { id, name, email, phone: "", role: "customer", emailVerified: true, createdAt: new Date().toISOString() };
  const input = { bookingType: "package", vehicleId: vehicle, vehicleTypeId: type, startDateTime: new Date(Date.now() + 30 * 86400000).toISOString(), durationDays: 2, nights: 1, passengerCount: 2,
    expectedTotal: 7000, passengers: [{ name, phone: "+919999999999", isPrimary: true }], stops: spots.map(touristSpotId => ({ touristSpotId })) };
  assert.equal((await createBooking({ ...input, expectedTotal: 1 }, user)).status, 409);
  const first = await createBooking(input, user); assert.equal(first.ok, true, JSON.stringify(first));
  const saved = (await pool.query("SELECT total_amount,vehicle_id FROM bookings WHERE booking_id=$1", [first.bookingId])).rows[0];
  assert.equal(Number(saved.total_amount), 7000); assert.equal(saved.vehicle_id, vehicle);
  assert.equal((await pool.query("SELECT 1 FROM booking_stops WHERE booking_id=$1", [first.bookingId])).rowCount, 2);
  console.log("PASS self-built route books the chosen car at its existing admin day rate; forged total rejected; stops saved");
  await pool.query("UPDATE vehicles SET base_price_per_day=4000 WHERE vehicle_id=$1", [vehicle]);
  const later = { ...input, startDateTime: new Date(Date.now() + 40 * 86400000).toISOString() };
  assert.equal((await createBooking(later, user)).status, 409);
  assert.equal((await createBooking({ ...later, expectedTotal: 8000 }, user)).ok, true);
  console.log("PASS changed admin day rate forces fresh price review before another booking");
  let changedDuringCommit = false;
  runtimePool.connect = (callback) => {
    if (typeof callback === "function") return originalConnect(callback);
    return originalConnect().then(client => {
    const query = client.query.bind(client), release = client.release.bind(client);
    client.query = async (text, values, ...rest) => {
      if (!changedDuringCommit && typeof text === "string" && text.includes("base_price_per_day") && text.includes("FOR UPDATE OF v")) {
        changedDuringCommit = true;
        await pool.query("UPDATE vehicles SET base_price_per_day=4500 WHERE vehicle_id=$1", [vehicle]);
      }
      return query(text, values, ...rest);
    };
    client.release = (...args) => { client.query = query; client.release = release; return release(...args); };
    return client;
    });
  };
  const raced = await createBooking({ ...later, startDateTime: new Date(Date.now() + 45 * 86400000).toISOString(), expectedTotal: 8000 }, user);
  assert.equal(changedDuringCommit, true); assert.equal(raced.status, 409);
  runtimePool.connect = originalConnect;
  await pool.query("UPDATE vehicles SET base_price_per_day=4000 WHERE vehicle_id=$1", [vehicle]);
  console.log("PASS admin day-rate edit after price calculation is rechecked under the booking transaction lock");
  await pool.query("INSERT INTO pricing_rules(booking_type_id,vehicle_type_id,vehicle_id,name,per_day_rate,tax_percent) VALUES($1,$2,$3,$4,2000,10)", [bookingType, type, vehicle, name]);
  simulateMissingPackageRule = false;
  assert.equal((await resolvePricingRule(bookingType, type, vehicle)).perDayRate, 2000);
  assert.equal((await createBooking({ ...input, startDateTime: new Date(Date.now() + 50 * 86400000).toISOString(), expectedTotal: 4400 }, user)).ok, true);
  console.log("PASS explicit package rate and tax override the day-rate fallback");
  await pool.query("UPDATE vehicles SET base_price_per_day=0 WHERE vehicle_id=$1", [vehicle]); assert.equal(await resolveVehicleDailyRule(vehicle), null);
  await pool.query("UPDATE vehicles SET base_price_per_day=4000,is_available=false WHERE vehicle_id=$1", [vehicle]); assert.equal(await resolveVehicleDailyRule(vehicle), null);
  assert.equal(sink.messages.length, 6); assert.deepEqual(sink.rejected, []);
  console.log("PASS zero/unavailable day rates fail closed; six booking messages captured locally");
} finally {
  globalThis.fetch = originalFetch;
  runtimePool.query = originalQuery;
  runtimePool.connect = originalConnect;
  await pool.query("DELETE FROM notifications WHERE user_id=$1 OR booking_id IN(SELECT booking_id FROM bookings WHERE user_id=$1)", [id]);
  await pool.query("DELETE FROM activity_logs WHERE user_id=$1", [id]);
  await pool.query("DELETE FROM vehicle_availability WHERE booking_id IN(SELECT booking_id FROM bookings WHERE user_id=$1)", [id]);
  await pool.query("DELETE FROM bookings WHERE user_id=$1", [id]);
  if (vehicle) await pool.query("DELETE FROM pricing_rules WHERE vehicle_id=$1", [vehicle]);
  if (vehicle) await pool.query("DELETE FROM vehicles WHERE vehicle_id=$1 AND name=$2", [vehicle, name]);
  if (city) await pool.query("DELETE FROM tourist_spots WHERE city_id=$1", [city]);
  if (city) await pool.query("DELETE FROM cities WHERE city_id=$1", [city]);
  if (region) await pool.query("DELETE FROM regions WHERE region_id=$1", [region]);
  if (type) await pool.query("DELETE FROM vehicle_types WHERE vehicle_type_id=$1", [type]);
  await pool.query("DELETE FROM users WHERE user_id=$1 AND email=$2", [id, email]);
  assert.equal((await pool.query("SELECT 1 FROM users WHERE user_id=$1", [id])).rowCount, 0);
  await sink?.close(); await pool.end(); await getPool().end();
  console.log("PASS owned custom-itinerary fixtures removed");
}

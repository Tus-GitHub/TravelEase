/** Real multi-connection tests. Development only; committed, uniquely tagged fixtures
 * are removed in finally. SMTP uses an in-memory transport. No schema changes. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import nodemailer from "nodemailer";
import { runtimeDatabaseConfig } from "../../src/lib/server/db-config.ts";

const url = process.env.DATABASE_URL;
const prod = process.env.DATABASE_URL_PRODUCTION;
assert(url && prod, "Both URLs must be configured to verify development isolation");
assert.notEqual(new URL(url).hostname, new URL(prod).hostname, "Refusing production target");
assert(process.argv.includes("--dev"), "Pass --dev to authorize temporary development fixtures");
const pool = new pg.Pool({ connectionString: url, max: 8, connectionTimeoutMillis: 10000,
  statement_timeout: 15000, application_name: `concurrency-${randomUUID()}` });
const runtimeUrl = process.env.DATABASE_URL_APP;
if (runtimeUrl) assert.equal(new URL(runtimeUrl).hostname, new URL(url).hostname);
// Owner creates/removes fixtures; real application calls exercise least privilege.
const runtimePool = runtimeUrl ? new pg.Pool({...runtimeDatabaseConfig(runtimeUrl),
  application_name:pool.options.application_name}) : pool;
(globalThis as unknown as { __pgPool: pg.Pool }).__pgPool = runtimePool;
const originalTransport = nodemailer.createTransport;
nodemailer.createTransport = (() => originalTransport({ jsonTransport: true })) as typeof originalTransport;
process.env.SMTP_HOST = "in-memory.invalid";
process.env.SMTP_USER = "test";
process.env.SMTP_PASS = "test";
const { createBooking, transitionBooking } = await import("../../src/lib/server/bookings.ts");
const { createAdminBlock } = await import("../../src/lib/server/availability.ts");
const tag = randomUUID();
const ids = [randomUUID(), randomUUID()];
let vt: number | undefined;
let vehicle: number;
let type: number;
const coupons: number[] = [];
const user = (i = 0) => ({ id: ids[i], name: "Concurrency test", email: `${ids[i]}@example.invalid`,
  phone: "", role: "admin", emailVerified: true, createdAt: new Date().toISOString() });
const start = "2090-01-01T10:00:00Z", end = "2090-01-01T12:00:00Z";
const input = () => ({ bookingType: "point_to_point" as const, vehicleTypeId: vt!,
  startDateTime: start, endDateTime: end, estimatedDistanceKm: 10 });
async function booking() {
  const r = await pool.query(`INSERT INTO bookings
    (booking_reference,user_id,booking_type_id,vehicle_type_id,vehicle_id,start_datetime,end_datetime,status,total_amount)
    VALUES ($1,$2,$3,$4,$5,$6,$7,'PendingPayment',1000) RETURNING booking_id`,
  [randomUUID().slice(0,20), ids[0], type, vt, vehicle, start, end]);
  return r.rows[0].booking_id as string;
}
async function coupon(limit: number | null, perUser: number) {
  const code = randomUUID().toUpperCase();
  const r = await pool.query(`INSERT INTO coupons(code,discount_type,discount_value,usage_limit,per_user_limit)
    VALUES ($1,'flat',10,$2,$3) RETURNING coupon_id`, [code,limit,perUser]);
  coupons.push(r.rows[0].coupon_id);
  return code;
}
// Hold the contested row until both application calls are actually waiting in PG.
async function race<T>(lockSql: string, params: unknown[], calls: (() => Promise<T>)[]) {
  const guard = await pool.connect();
  let tasks: Promise<T>[] = [];
  try {
    await guard.query("BEGIN");
    await guard.query(lockSql, params);
    tasks = calls.map(fn => fn());
    // Attach rejection handlers immediately while waiting for lock evidence.
    const results = Promise.allSettled(tasks);
    let waiting = false;
    for (let i = 0; i < 100; i++) {
      const r = await pool.query(`SELECT count(*)::int AS n FROM pg_stat_activity
        WHERE application_name=$1 AND wait_event_type='Lock'`, [pool.options.application_name]);
      if (r.rows[0].n >= calls.length) { waiting = true; break; }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    await guard.query("ROLLBACK");
    const settled = await results;
    assert(waiting, "Both application transactions must contend on a real database lock");
    return settled.map(r => { if (r.status === "rejected") throw r.reason; return r.value; });
  } finally {
    await guard.query("ROLLBACK");
    guard.release();
    await Promise.allSettled(tasks);
  }
}
async function clearBlocks() { await pool.query("DELETE FROM vehicle_availability WHERE vehicle_id=$1", [vehicle]); }
try {
  for (const id of ids) await pool.query(`INSERT INTO users(user_id,name,email,phone,password_hash,role_id)
    VALUES ($1,'Concurrency test',$2,'','disabled',(SELECT role_id FROM roles WHERE name='admin'))`, [id,`${id}@example.invalid`]);
  vt = (await pool.query("INSERT INTO vehicle_types(slug,title) VALUES($1,'Concurrency test') RETURNING vehicle_type_id", [tag])).rows[0].vehicle_type_id;
  vehicle = (await pool.query(`INSERT INTO vehicles(vehicle_type_id,name,seating_capacity,base_price_per_day)
    VALUES($1,'Concurrency test',4,1000) RETURNING vehicle_id`, [vt])).rows[0].vehicle_id;
  type = (await pool.query("SELECT booking_type_id FROM booking_types WHERE code='point_to_point'")).rows[0].booking_type_id;
  await pool.query("INSERT INTO pricing_rules(booking_type_id,vehicle_type_id,name,base_amount) VALUES($1,$2,'Concurrency test',1000)", [type,vt]);

  const a = await booking(), b = await booking();
  const confirmations = await race("SELECT 1 FROM vehicles WHERE vehicle_id=$1 FOR UPDATE", [vehicle],
    [a,b].map(id => () => transitionBooking({ bookingId:id,toStatus:"Confirmed",user:user() })));
  assert.equal(confirmations.filter(r => r.ok).length, 1);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM vehicle_availability WHERE vehicle_id=$1 AND NOT is_deleted", [vehicle])).rows[0].n, 1);
  console.log("PASS competing vehicle confirmations: one reservation");
  await clearBlocks();

  const c = await booking();
  const duplicate = await race("SELECT 1 FROM bookings WHERE booking_id=$1 FOR UPDATE", [c],
    [0,1].map(() => () => transitionBooking({ bookingId:c,toStatus:"Confirmed",user:user() })));
  assert.equal(duplicate.filter(r => r.ok).length, 1);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM booking_status_history WHERE booking_id=$1", [c])).rows[0].n, 1);
  console.log("PASS duplicate confirmation: one history entry");
  const cancelled = await race("SELECT 1 FROM bookings WHERE booking_id=$1 FOR UPDATE", [c],
    [0,1].map(() => () => transitionBooking({ bookingId:c,toStatus:"Cancelled",user:user() })));
  assert.equal(cancelled.filter(r => r.ok).length, 1);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM refunds WHERE booking_id=$1", [c])).rows[0].n, 1);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM vehicle_availability WHERE booking_id=$1 AND NOT is_deleted", [c])).rows[0].n, 0);
  console.log("PASS duplicate cancellation: one refund and reservation released");
  await clearBlocks();

  const d = await booking();
  const maintenance = await race<{ok:boolean}>("SELECT 1 FROM vehicles WHERE vehicle_id=$1 FOR UPDATE", [vehicle], [
    () => transitionBooking({ bookingId:d,toStatus:"Confirmed",user:user() }),
    () => createAdminBlock(vehicle, {startsAt:start,endsAt:end,kind:"maintenance"},ids[0]),
  ]);
  assert.equal(maintenance.filter(r => r.ok).length, 1);
  console.log("PASS maintenance versus confirmation: one winner");
  await clearBlocks();

  const e = await booking();
  const mixed = await race("SELECT 1 FROM bookings WHERE booking_id=$1 FOR UPDATE", [e], [
    () => transitionBooking({bookingId:e,toStatus:"Confirmed",user:user()}),
    () => transitionBooking({bookingId:e,toStatus:"Cancelled",user:user()}),
  ]);
  assert(mixed.some(r => r.ok));
  assert.equal((await pool.query("SELECT status FROM bookings WHERE booking_id=$1", [e])).rows[0].status, "Cancelled");
  const history = (await pool.query(`SELECT from_status,to_status FROM booking_status_history
    WHERE booking_id=$1 ORDER BY booking_status_history_id`, [e])).rows;
  assert.equal(history[0].from_status, "PendingPayment");
  if (history.length === 2) assert.equal(history[1].from_status, history[0].to_status);
  assert.equal(history.at(-1).to_status, "Cancelled");
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM vehicle_availability WHERE booking_id=$1 AND NOT is_deleted", [e])).rows[0].n, 0);
  console.log("PASS concurrent confirm/cancel: consistent final state and history");

  assert((await createAdminBlock(vehicle,{startsAt:start,endsAt:end,kind:"maintenance"},ids[0])).ok);
  assert((await createAdminBlock(vehicle,{startsAt:end,endsAt:"2090-01-01T14:00:00Z",kind:"blocked"},ids[0])).ok);
  console.log("PASS adjacent availability windows remain allowed");
  await clearBlocks();

  for (const perUser of [false,true]) {
    const code = await coupon(perUser ? null : 1, perUser ? 1 : 10);
    const results = await race("SELECT 1 FROM coupons WHERE code=$1 FOR UPDATE", [code],
      [0,1].map(i => () => createBooking({...input(),couponCode:code},user(perUser ? 0 : i))));
    assert.equal(results.filter(r => r.ok).length, 1);
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM coupon_redemptions WHERE coupon_id=$1", [coupons.at(-1)])).rows[0].n, 1);
    console.log(`PASS coupon ${perUser ? 'per-user' : 'global'} limit under contention`);
  }
  const rollbackCode = await coupon(1,1);
  await assert.rejects(createBooking({...input(),couponCode:rollbackCode,passengers:[{name:"Invalid age",age:1.5}]},user()));
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM bookings WHERE coupon_id=$1", [coupons.at(-1)])).rows[0].n, 0);
  assert((await createBooking({...input(),couponCode:rollbackCode},user())).ok);
  console.log("PASS failed booking rolls back coupon usage and releases lock");

  const disabledCode = await coupon(1,1);
  const disabled = await race("UPDATE coupons SET is_active=false WHERE code=$1", [disabledCode],
    [0,1].map(() => () => createBooking({...input(),couponCode:disabledCode},user())));
  // race rolls its guard back: the pending edit must not leak into either request.
  assert.equal(disabled.filter(r => r.ok).length, 1);
  console.log("PASS rolled-back coupon edit does not corrupt concurrent redemption");
} finally {
  // Only this run's IDs; no existing catalogue/customer rows are modified.
  await pool.query("DELETE FROM notifications WHERE user_id=ANY($1::uuid[])", [ids]);
  await pool.query("DELETE FROM activity_logs WHERE user_id=ANY($1::uuid[])", [ids]);
  await pool.query("DELETE FROM bookings WHERE user_id=ANY($1::uuid[])", [ids]);
  if (vt) {
    await pool.query("DELETE FROM vehicles WHERE vehicle_type_id=$1", [vt]);
    await pool.query("DELETE FROM pricing_rules WHERE vehicle_type_id=$1", [vt]);
    await pool.query("DELETE FROM vehicle_types WHERE vehicle_type_id=$1", [vt]);
  }
  await pool.query("DELETE FROM coupons WHERE coupon_id=ANY($1::int[])", [coupons]);
  await pool.query("DELETE FROM users WHERE user_id=ANY($1::uuid[])", [ids]);
  if (runtimePool !== pool) await runtimePool.end();
  await pool.end();
  console.log("Temporary development fixtures removed");
}

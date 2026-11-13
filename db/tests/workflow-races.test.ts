/** Real PostgreSQL lock contention. Synthetic development fixtures only; no DDL or external mail. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import pg from "pg";
import nodemailer from "nodemailer";
import { runtimeDatabaseConfig } from "../../src/lib/server/db-config.ts";

assert(process.argv.includes("--dev") && !process.env.VERCEL, "Development only");
assert.equal(execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim(), "development");
const host = (value: string) => new URL(value).hostname.replace(/-pooler\./, ".");
const owner = process.env.DATABASE_URL!, runtime = process.env.DATABASE_URL_APP || owner;
assert(owner && process.env.DATABASE_URL_PRODUCTION, "Development isolation requires both configured endpoints");
assert.equal(host(owner), host(runtime));
assert.notEqual(host(owner), host(process.env.DATABASE_URL_PRODUCTION));
const application = `workflow-races-${randomUUID()}`;
const pool = new pg.Pool({ ...runtimeDatabaseConfig(owner), max: 4, application_name: `${application}-fixtures` });
const app = new pg.Pool({ ...runtimeDatabaseConfig(runtime), max: 4, application_name: application });
(globalThis as unknown as { __pgPool: pg.Pool }).__pgPool = app;
const originalTransport = nodemailer.createTransport;
nodemailer.createTransport = (() => originalTransport({ jsonTransport: true })) as typeof originalTransport;
process.env.SMTP_HOST = "in-memory.invalid";
process.env.SMTP_USER = "test";
process.env.SMTP_PASS = "test";
const { addTicketMessage, setTicketStatus } = await import("../../src/lib/server/support-tickets.ts");
const { settlePayout } = await import("../../src/lib/server/admin/vendors.ts");
const ids = [randomUUID(), randomUUID(), randomUUID()];
const customer = { id: ids[0], name: "Workflow race test", email: `${ids[0]}@example.invalid`, phone: "", role: "customer", emailVerified: true, createdAt: new Date().toISOString() };
const admin = { ...customer, id: ids[1], role: "admin" };
const ticketIds: string[] = [], payoutIds: string[] = [];
let vendorId: number | undefined, checks = 0;
const pass = (name: string) => { checks++; console.log(`PASS ${name}`); };
async function ticket() {
  const id = randomUUID(); ticketIds.push(id);
  await pool.query("INSERT INTO support_tickets(support_ticket_id,reference,user_id,subject) VALUES($1,$2,$3,'Race regression')", [id, `HELP-${id.replaceAll("-", "").slice(0, 8)}`, ids[0]]);
  return id;
}
async function waiting(count: number) {
  for (let i = 0; i < 80; i++) {
    const r = await pool.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock'", [application]);
    if (r.rows[0].n >= count) return;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  assert.fail(`Expected ${count} application requests waiting on real PostgreSQL locks`);
}
async function ticketState(id: string) {
  return (await pool.query("SELECT status,(SELECT count(*)::int FROM support_ticket_messages WHERE support_ticket_id=$1) AS messages FROM support_tickets WHERE support_ticket_id=$1", [id])).rows[0];
}
try {
  for (const [index, id] of ids.entries()) await pool.query("INSERT INTO users(user_id,name,email,phone,password_hash,role_id) VALUES($1,'Workflow race test',$2,'','disabled',(SELECT role_id FROM roles WHERE name=$3))", [id, `${id}@example.invalid`, index === 1 ? "admin" : "customer"]);
  // Closing holds the row lock first; both customer and staff replies must see closed after waiting.
  for (const viewer of [customer, admin]) {
    const id = await ticket(), guard = await pool.connect();
    let task: ReturnType<typeof addTicketMessage> | undefined;
    try {
      await guard.query("BEGIN");
      await guard.query("UPDATE support_tickets SET status='closed' WHERE support_ticket_id=$1", [id]);
      task = addTicketMessage(id, viewer, "Reply racing closure");
      void task.catch(() => {});
      await waiting(1);
      await guard.query("COMMIT");
      const result = await task;
      assert(!result.ok && result.status === 409);
      assert.deepEqual(await ticketState(id), { status: "closed", messages: 0 });
      assert.equal((await pool.query("SELECT count(*)::int AS n FROM notifications WHERE user_id=$1", [ids[0]])).rows[0].n, 0);
      pass(`close before ${viewer.role} reply: 409, no message or notification`);
    } finally { await guard.query("ROLLBACK"); guard.release(); await task?.catch(() => {}); }
  }
  // Reply queues first, then closure: closure must not be lost after the reply commits.
  {
    const id = await ticket(), guard = await pool.connect();
    const tasks: Promise<unknown>[] = [];
    try {
      await guard.query("BEGIN");
      await guard.query("SELECT 1 FROM support_tickets WHERE support_ticket_id=$1 FOR UPDATE", [id]);
      const reply = addTicketMessage(id, customer, "Reply before closure"); tasks.push(reply); void reply.catch(() => {});
      await waiting(1);
      const close = setTicketStatus(id, "closed", admin.id); tasks.push(close); void close.catch(() => {});
      await waiting(2);
      await guard.query("COMMIT");
      assert((await reply).ok); assert(await close);
      assert.deepEqual(await ticketState(id), { status: "closed", messages: 1 });
      pass("reply before close: one message, final status closed");
    } finally { await guard.query("ROLLBACK"); guard.release(); await Promise.allSettled(tasks); }
  }
  {
    const id = await ticket();
    for (const target of [id, randomUUID()]) {
      const result = await addTicketMessage(target, { ...customer, id: ids[2] }, "Forbidden reply");
      assert(!result.ok && result.status === 404);
    }
    assert.deepEqual(await ticketState(id), { status: "open", messages: 0 });
    // A real FK failure after taking the lock must roll back and release it.
    await assert.rejects(addTicketMessage(id, { ...admin, id: randomUUID() }, "Invalid author"), (e: { code?: string }) => e.code === "23503");
    assert.deepEqual(await ticketState(id), { status: "open", messages: 0 });
    assert((await addTicketMessage(id, customer, "Valid customer reply")).ok);
    assert((await addTicketMessage(id, admin, "Valid staff reply")).ok);
    assert.deepEqual(await ticketState(id), { status: "pending", messages: 2 });
    pass("reply IDOR, missing ticket, rollback/released lock and normal staff/customer replies");
  }
  vendorId = (await pool.query("INSERT INTO vendor_profiles(business_name) VALUES('Workflow race test') RETURNING vendor_profile_id")).rows[0].vendor_profile_id;
  for (const statuses of [["paid", "void"], ["paid", "paid"], ["void", "void"]] as const) {
    const id = randomUUID(); payoutIds.push(id);
    await pool.query("INSERT INTO payouts(payout_id,vendor_profile_id,period_start,period_end,commission_pct,commission_amount,net_amount) VALUES($1,$2,$3,$4,10,10,90)", [id, vendorId, `${2090 + payoutIds.length}-01-01`, `${2090 + payoutIds.length}-02-01`]);
    const guard = await pool.connect(); let tasks: ReturnType<typeof settlePayout>[] = [];
    try {
      await guard.query("BEGIN"); await guard.query("SELECT 1 FROM payouts WHERE payout_id=$1 FOR UPDATE", [id]);
      tasks = statuses.map((status, index) => settlePayout(id, { status, method: `method-${index}`, reference: `reference-${index}` }, admin.id));
      const results = Promise.allSettled(tasks);
      await waiting(2); await guard.query("COMMIT");
      const values = (await results).map(result => { if (result.status === "rejected") throw result.reason; return result.value; });
      const winner = values.findIndex(result => result.ok);
      assert.equal(values.filter(result => result.ok).length, 1);
      assert(values.some(result => !result.ok && result.status === 409));
      const saved = (await pool.query("SELECT status,method,reference FROM payouts WHERE payout_id=$1", [id])).rows[0];
      assert.deepEqual(saved, { status: statuses[winner], method: `method-${winner}`, reference: `reference-${winner}` });
      assert.equal((await pool.query("SELECT count(*)::int AS n FROM activity_logs WHERE action='payout.settle' AND entity_id=$1", [id])).rows[0].n, 1);
      const again = await settlePayout(id, { status: "void", reference: "must-not-overwrite" }, admin.id);
      assert(!again.ok && again.status === 409);
      assert.deepEqual((await pool.query("SELECT status,method,reference FROM payouts WHERE payout_id=$1", [id])).rows[0], saved);
      pass(`concurrent ${statuses.join("/")} settlement: one winner, immutable details, one audit event`);
    } finally { await guard.query("ROLLBACK"); guard.release(); await Promise.allSettled(tasks); }
  }
  for (const id of [randomUUID(), payoutIds[0]]) {
    if (id === payoutIds[0]) await pool.query("UPDATE payouts SET is_deleted=true WHERE payout_id=$1", [id]);
    const result = await settlePayout(id, { status: "paid" }, admin.id);
    assert(!result.ok && result.status === 404);
  }
  pass("missing and soft-deleted payouts remain 404");
  console.log(`PASS ${checks} workflow race regression groups`);
} finally {
  try {
    await pool.query("DELETE FROM notifications WHERE user_id=ANY($1::uuid[])", [ids]);
    await pool.query("DELETE FROM activity_logs WHERE user_id=ANY($1::uuid[])", [ids]);
    await pool.query("DELETE FROM support_tickets WHERE support_ticket_id=ANY($1::uuid[])", [ticketIds]);
    if (vendorId) await pool.query("DELETE FROM vendor_profiles WHERE vendor_profile_id=$1", [vendorId]);
    await pool.query("DELETE FROM users WHERE user_id=ANY($1::uuid[])", [ids]);
    const r = await pool.query(`SELECT (SELECT count(*) FROM users WHERE user_id=ANY($1::uuid[])) + (SELECT count(*) FROM support_tickets WHERE support_ticket_id=ANY($2::uuid[])) + (SELECT count(*) FROM payouts WHERE payout_id=ANY($3::uuid[])) AS n`, [ids, ticketIds, payoutIds]);
    assert.equal(Number(r.rows[0].n), 0);
    console.log("Synthetic development fixtures removed and absence verified; no external messages or production access.");
  } finally { await app.end(); await pool.end(); }
}

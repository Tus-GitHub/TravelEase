/** Read/write permission probes are rolled back. No schema objects are created. */
import assert from "node:assert/strict";
import { randomUUID, randomInt } from "node:crypto";
import pg from "pg";
import { runtimeDatabaseConfig } from "../../src/lib/server/db-config.ts";
import { getPool } from "../../src/lib/server/db.ts";

const endpoint = (s: string) => new URL(s).hostname.replace(/-pooler\./, ".");
assert(process.argv.includes("--dev") && !process.env.VERCEL);
assert(process.env.DATABASE_URL_APP && process.env.DATABASE_URL && process.env.DATABASE_URL_PRODUCTION);
assert.equal(endpoint(process.env.DATABASE_URL_APP), endpoint(process.env.DATABASE_URL));
assert.notEqual(endpoint(process.env.DATABASE_URL_APP), endpoint(process.env.DATABASE_URL_PRODUCTION));
const config = runtimeDatabaseConfig("postgresql://user:secret@example.invalid/db?sslmode=no-verify&ssl=false");
const parsed = new pg.Client(config);
assert.deepEqual(parsed.ssl, {}); // verify-full means Node's default certificate + hostname verification.
assert.equal(new URL(config.connectionString).searchParams.get("sslmode"), "verify-full");
assert.throws(() => runtimeDatabaseConfig("secret-invalid-url"), {message:"Invalid database connection configuration."});
console.log("PASS explicit TLS configuration and redacted validation error");

const pool = getPool();
const client = await pool.connect();
async function denied(sql: string, code = "42501") {
  await client.query("SAVEPOINT denied");
  try { await assert.rejects(client.query(sql), (e: unknown) => (e as {code?:string}).code === code); }
  finally { await client.query("ROLLBACK TO SAVEPOINT denied"); await client.query("RELEASE SAVEPOINT denied"); }
}
try {
  const {rows:[role]} = await client.query(`SELECT current_user AS name,rolcreatedb,rolcreaterole,rolbypassrls,rolsuper,
    has_schema_privilege(current_user,'public','CREATE') AS can_create
    FROM pg_roles WHERE rolname=current_user`);
  assert.equal(role.name,"travel_app_dev");
  for (const key of ["rolcreatedb","rolcreaterole","rolbypassrls","rolsuper","can_create"]) assert.equal(role[key],false);
  const {rows:[settings]} = await client.query(`SELECT current_setting('statement_timeout') AS statement,
    current_setting('lock_timeout') AS lock,current_setting('idle_in_transaction_session_timeout') AS idle`);
  assert.deepEqual(settings,{statement:"15s",lock:"5s",idle:"15s"});
  console.log("PASS app selects restricted role and server enforces configured deadlines");
  await client.query("BEGIN");
  await denied("UPDATE schema_migrations SET migration_id=migration_id WHERE false");
  await denied("DELETE FROM activity_logs WHERE false");
  await denied("UPDATE booking_status_history SET reason=reason WHERE false");
  await denied("INSERT INTO roles(name) VALUES ('hardening-test-forbidden')");
  await denied("SET ROLE neondb_owner");
  console.log("PASS migration, audit mutation, role writes and owner escalation denied");
  const vt = (await client.query("INSERT INTO vehicle_types(slug,title) VALUES($1,'Runtime permission test') RETURNING vehicle_type_id", [randomUUID()])).rows[0].vehicle_type_id;
  await client.query("UPDATE vehicle_types SET title='Updated' WHERE vehicle_type_id=$1", [vt]);
  await client.query("DELETE FROM vehicle_types WHERE vehicle_type_id=$1", [vt]);
  await client.query("SELECT u.user_id FROM users u JOIN roles r ON r.role_id=u.role_id LIMIT 1");
  await client.query("SELECT booking_id FROM bookings LIMIT 0");
  await client.query("SELECT setting_key FROM site_settings LIMIT 0");
  console.log("PASS catalogue CRUD, sequences, triggers, auth and booking reads");
  await client.query("SET LOCAL statement_timeout='25ms'");
  await denied("SELECT pg_sleep(1)","57014");
  await client.query("ROLLBACK");
  console.log("PASS server cancels slow statement; connection recovers after rollback");
  const blocker = await pool.connect();
  try {
    const key = randomInt(1,2 ** 30);
    await blocker.query("BEGIN");
    await blocker.query("SELECT pg_advisory_xact_lock(17829,$1)", [key]);
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout='25ms'");
    await denied(`SELECT pg_advisory_xact_lock(17829,${key})`,"55P03");
    await client.query("ROLLBACK");
    console.log("PASS server bounds lock waits; both transactions released");
  } finally { await blocker.query("ROLLBACK"); blocker.release(); }
} finally {
  await client.query("ROLLBACK");
  client.release();
  await pool.end();
}

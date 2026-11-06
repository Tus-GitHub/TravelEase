// Explicit dev-only operational setup. Never called by migrations or deploys.
import { readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import pg from "pg";
import { runtimeDatabaseConfig } from "../src/lib/server/db-config.ts";

const ROLE = "travel_app_dev";
const envPath = new URL("../.env.local", import.meta.url);
const endpoint = url => new URL(url).hostname.replace(/-pooler\./, ".");
const ident = value => '"' + value.replaceAll('"', '""') + '"';
let owner;
try {
  if (!process.argv.includes("--dev") || process.env.VERCEL) throw new Error("development guard");
  const branch = execFileSync("git", ["branch", "--show-current"], {encoding:"utf8"}).trim();
  if (branch !== "development") throw new Error("development branch required");
  const source = process.env.DATABASE_URL;
  const production = process.env.DATABASE_URL_PRODUCTION;
  if (!source || !production || endpoint(source) === endpoint(production)) throw new Error("database isolation guard");
  const existing = process.env.DATABASE_URL_APP;
  if (existing && (endpoint(existing) !== endpoint(source) || decodeURIComponent(new URL(existing).username) !== ROLE)) {
    throw new Error("existing application URL does not match expected dev role");
  }
  const envText = readFileSync(envPath,"utf8");
  const password = existing ? decodeURIComponent(new URL(existing).password) : randomBytes(36).toString("base64url");
  const appUrl = new URL(source);
  appUrl.username = ROLE;
  appUrl.password = password;
  appUrl.searchParams.set("sslmode","verify-full");
  owner = new pg.Client(runtimeDatabaseConfig(source));
  await owner.connect();
  const {rows:[info]} = await owner.query("SELECT current_user AS owner,current_database() AS db");
  const role = (await owner.query("SELECT 1 FROM pg_roles WHERE rolname=$1", [ROLE])).rows[0];
  if (role && !existing) throw new Error("existing role without local credentials; refusing password replacement");
  await owner.query("BEGIN");
  if (!role) {
    // PostgreSQL utility DDL does not accept parameter placeholders. quote via
    // server format; never print the resulting statement or password.
    const {rows:[ddl]} = await owner.query("SELECT format('CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS', $1::text,$2::text) AS sql", [ROLE,password]);
    await owner.query(ddl.sql);
  }
  await owner.query(`REVOKE CREATE ON SCHEMA public FROM PUBLIC`);
  await owner.query(`GRANT CONNECT ON DATABASE ${ident(info.db)} TO ${ident(ROLE)}`);
  await owner.query(`GRANT USAGE ON SCHEMA public TO ${ident(ROLE)}`);
  await owner.query(`REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ${ident(ROLE)}`);
  const tables = (await owner.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename<>'schema_migrations'")).rows;
  for (const {tablename} of tables) {
    const rights = ["roles","booking_types"].includes(tablename) ? "SELECT"
      : ["activity_logs","booking_status_history","notifications","cms_page_revisions"].includes(tablename) ? "SELECT, INSERT"
      : "SELECT, INSERT, UPDATE, DELETE";
    await owner.query(`GRANT ${rights} ON TABLE public.${ident(tablename)} TO ${ident(ROLE)}`);
  }
  await owner.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${ident(ROLE)}`);
  await owner.query(`ALTER ROLE ${ident(ROLE)} SET statement_timeout='15s'`);
  await owner.query(`ALTER ROLE ${ident(ROLE)} SET lock_timeout='5s'`);
  await owner.query(`ALTER ROLE ${ident(ROLE)} SET idle_in_transaction_session_timeout='15s'`);
  await owner.query("COMMIT");
  const app = new pg.Client(runtimeDatabaseConfig(appUrl.toString()));
  try {
    await app.connect();
    const {rows:[checks]} = await app.query(`SELECT rolcreatedb,rolcreaterole,rolbypassrls,rolsuper,
      has_schema_privilege(current_user,'public','CREATE') AS can_create,
      has_table_privilege(current_user,'schema_migrations','INSERT') AS can_migrate
      FROM pg_roles WHERE rolname=current_user`);
    if (Object.values(checks).some(Boolean)) throw new Error("runtime privileges too broad");
    await app.query("SELECT booking_id FROM bookings LIMIT 0");
  } finally { await app.end(); }
  const line = `DATABASE_URL_APP=${appUrl.toString()}`;
  const updated = /^DATABASE_URL_APP=.*$/m.test(envText)
    ? envText.replace(/^DATABASE_URL_APP=.*$/m, () => line)
    : envText.replace(/\s*$/, "") + "\n\n# Restricted DEVELOPMENT runtime login; owner DATABASE_URL stays for migrations.\n" + line + "\n";
  writeFileSync(envPath,updated,"utf8");
  console.log("Development runtime role verified; DATABASE_URL_APP saved in ignored .env.local. Restart localhost.");
} catch {
  if (owner) { try { await owner.query("ROLLBACK"); } catch {} }
  console.error("Development role setup failed; credentials and SQL suppressed. No production connection was opened.");
  process.exitCode=1;
} finally { if (owner) await owner.end(); }

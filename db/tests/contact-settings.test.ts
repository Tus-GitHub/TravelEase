/** Existing development settings only. All edits rolled back; no email or DDL. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import type { Pool } from "pg";
import { getPool } from "../../src/lib/server/db.ts";
import { getContactInbox } from "../../src/lib/server/site-settings.ts";
import { updateSiteSettings } from "../../src/lib/server/admin/site-settings.ts";

const host = (value: string) => new URL(value).hostname.replace(/-pooler\./, ".");
assert(process.argv.includes("--dev") && !process.env.VERCEL);
assert.equal(execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim(), "development");
assert(process.env.DATABASE_URL_APP && process.env.DATABASE_URL && process.env.DATABASE_URL_PRODUCTION);
assert.equal(host(process.env.DATABASE_URL_APP), host(process.env.DATABASE_URL));
assert.notEqual(host(process.env.DATABASE_URL_APP), host(process.env.DATABASE_URL_PRODUCTION));
const pool = getPool(); const client = await pool.connect();
const globals = globalThis as unknown as { __pgPool: Pool };
globals.__pgPool = { query: client.query.bind(client) } as unknown as Pool;
try {
  await client.query("BEGIN");
  await client.query("DELETE FROM site_settings WHERE setting_key='contact_email'");
  await assert.rejects(getContactInbox(), "missing setting cannot fall back to placeholder");
  const actor = null as unknown as string; // existing nullable updated_by; test-only, rolled back
  await updateSiteSettings({ contactEmail: " first@example.com " }, actor);
  assert.equal(await getContactInbox(), "first@example.com");
  await updateSiteSettings({ contactEmail: "changed@example.com" }, actor);
  assert.equal(await getContactInbox(), "changed@example.com", "delivery reads changes immediately");
  await assert.rejects(updateSiteSettings({ contactEmail: "first@example.com,second@example.com", contactPhone: "must not persist" }, actor));
  assert.equal(await getContactInbox(), "changed@example.com");
  await updateSiteSettings({ contactEmail: "" }, actor); await assert.rejects(getContactInbox());
  await client.query("UPDATE site_settings SET setting_value='Name <bad@example.com>' WHERE setting_key='contact_email'");
  await assert.rejects(getContactInbox(), "bad legacy setting fails safely");
  console.log("PASS raw inbox resolution, immediate admin changes, valid mailboxes, invalid updates rejected before writes, blank/missing/legacy invalid inbox disables delivery.");
} finally {
  await client.query("ROLLBACK"); globals.__pgPool = pool; client.release(); await pool.end();
  console.log("Development settings rolled back. No email, new schema or production connection.");
}

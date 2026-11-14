/** Real localhost handlers + dev session. Invalid input prevents provider calls.
 * Creates one temporary customer/session in existing tables and removes both. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { getPool } from "../../src/lib/server/db.ts";
import { SESSION_COOKIE } from "../../src/lib/server/session.ts";

const host = (value: string) => new URL(value).hostname.replace(/-pooler\./, ".");
assert(process.argv.includes("--dev") && !process.env.VERCEL, "Local development only");
assert.equal(execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim(), "development");
assert(process.env.DATABASE_URL_APP && process.env.DATABASE_URL && process.env.DATABASE_URL_PRODUCTION);
assert.equal(host(process.env.DATABASE_URL_APP), host(process.env.DATABASE_URL));
assert.notEqual(host(process.env.DATABASE_URL_APP), host(process.env.DATABASE_URL_PRODUCTION));
const target = new URL(process.argv.find(value => value.startsWith("--base="))?.slice(7) ?? "http://127.0.0.1:3000");
assert(target.protocol === "http:" && ["localhost", "127.0.0.1"].includes(target.hostname) && target.pathname === "/" && !target.username && !target.password && !target.search && !target.hash, "Local HTTP origin required");
const port = target.port || "80";
const bases = [`http://127.0.0.1:${port}`, `http://localhost:${port}`];
const paths = ["/api/hotels/search", "/api/itineraries/suggest", "/api/routes/optimize"];
const pool = getPool();
const id = randomUUID(), token = randomUUID(), email = `origin-smoke-${id}@example.invalid`;
let created = false;
let checks = 0;
let browser: { close: () => Promise<void> } | undefined;

async function probe(base: string, path: string, expected: number, headers: Record<string, string> = {}, authenticated = true) {
  const response = await fetch(base + path, { method: "POST", redirect: "error", signal: AbortSignal.timeout(60_000),
    headers: { "Content-Type": "application/json", Origin: base, ...(authenticated ? { Cookie: `${SESSION_COOKIE}=${token}` } : {}), ...headers },
    body: "{}", // Always invalid; never enter a provider or a catalogue write.
  });
  assert.equal(response.status, expected, `${path} on ${base}: expected ${expected}, got ${response.status}`);
  if (expected === 403) assert.equal((await response.json()).error, "Invalid origin.");
  checks++;
}

try {
  for (const base of bases) for (const path of paths) await probe(base, path, 401, {}, false);
  // Atomic fixture creation; UUIDs do not consume serial sequences. No email/signup flow.
  const inserted = await pool.query(`WITH fixture AS (
    INSERT INTO users(user_id,name,email,phone,password_hash,role_id,email_verified_at)
      SELECT $1,'Origin smoke fixture',$2,'',$3,role_id,now() FROM roles WHERE name='customer'
      RETURNING user_id
    ) INSERT INTO sessions(token,user_id,expires_at)
      SELECT $4,user_id,now()+interval '5 minutes' FROM fixture`, [id, email, randomUUID(), token]);
  created = true; assert.equal(inserted.rowCount, 1, "Customer role must exist");

  for (const base of bases) {
    const identity = await fetch(base + "/api/auth/me", { headers: { Cookie: `${SESSION_COOKIE}=${token}` }, redirect: "error", signal: AbortSignal.timeout(60_000) });
    assert.equal(identity.status, 200);
    const { user } = await identity.json();
    assert.equal(user?.id, id, "Local server must resolve the development fixture session");
    assert.equal(user.role, "customer");
    for (const path of paths) {
      await probe(base, path, 400, { "Sec-Fetch-Site": "same-origin" });
      await probe(base, path, 403, { Origin: "https://other.invalid" });
      await probe(base, path, 403, { Origin: "https://other.invalid", "X-Forwarded-Host": "other.invalid" });
      await probe(base, path, 403, { Origin: base.replace(`:${port}`, `:${Number(port) === 65535 ? 65534 : Number(port) + 1}`) });
      await probe(base, path, 403, { Origin: base.replace("http:", "https:") });
      await probe(base, path, 403, { Origin: bases.find(value => value !== base)! });
      await probe(base, path, 403, { Origin: "null" });
      await probe(base, path, 403, { "Sec-Fetch-Site": "cross-site" });
    }
  }
  console.log(`PASS ${checks} real HTTP checks: both localhost hosts, anonymous401, authenticated validation400, foreign origin/port/scheme/alias/null and spoofed forwarded-host403.`);

  // Optional browser verification using an already-installed Playwright module.
  // No dependency installation or module path stored in application configuration.
  const browserModule = process.argv.find(value => value.startsWith("--browser-module="))?.slice("--browser-module=".length);
  if (browserModule) {
    const { chromium } = createRequire(import.meta.url)(browserModule);
    const instance = await chromium.launch({ channel: "chrome", headless: true }); browser = instance;
    const context = await instance.newContext();
    await context.addCookies(bases.map(base => ({ name: SESSION_COOKIE, value: token, url: base, httpOnly: true, sameSite: "Lax" })));
    const page = await context.newPage();
    for (const base of bases) {
      await page.goto(base + "/api/auth/me", { waitUntil: "domcontentloaded", timeout: 60_000 });
      const origins: Promise<string | null>[] = [];
      const record = (request: { url(): string; method(): string; headerValue(name: string): Promise<string | null> }) => {
        if (paths.includes(new URL(request.url()).pathname) && request.method() === "POST") origins.push(request.headerValue("origin"));
      };
      page.on("request", record);
      const results = await page.evaluate(async (endpoints: string[]) => Promise.all(endpoints.map(async endpoint => {
        const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: "{}" });
        return { endpoint, status: response.status, body: await response.json() };
      })), paths);
      page.off("request", record);
      assert.deepEqual(await Promise.all(origins), paths.map(() => base), "Browser-generated Origin must match the visited host");
      for (const result of results) {
        assert.equal(result.status, 400, `${result.endpoint}: real browser must pass origin and reach input validation`);
        assert.notEqual(result.body.error, "Invalid origin.");
      }
    }
    console.log("PASS 6 authenticated Chrome requests with browser-generated Origin headers across both localhost hosts; no API mocks.");
  }
} finally {
  try { await browser?.close(); }
  finally {
    try {
      if (created) {
        await pool.query("DELETE FROM sessions WHERE token=$1 AND user_id=$2", [token, id]);
        await pool.query("DELETE FROM users WHERE user_id=$1 AND email=$2", [id, email]);
        const remaining = await pool.query("SELECT (SELECT count(*) FROM sessions WHERE token=$1) + (SELECT count(*) FROM users WHERE user_id=$2) AS n", [token, id]);
        assert.equal(Number(remaining.rows[0].n), 0);
        console.log("Temporary development user/session removed and absence verified. No provider calls, messages, bookings, schema or production changes.");
      }
    } finally { await pool.end(); }
  }
}

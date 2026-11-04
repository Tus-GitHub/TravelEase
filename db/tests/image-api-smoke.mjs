// Against localhost + development only. Creates short-lived test sessions, then removes them.
// No catalogue mutations or external uploads are performed.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";

const connectionString = process.env.DATABASE_URL;
assert.ok(connectionString, "DATABASE_URL required");
assert.notEqual(new URL(connectionString).hostname, new URL(process.env.DATABASE_URL_PRODUCTION).hostname, "Never run against production");
const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
const tokens = [];
await client.connect();
const base = "http://127.0.0.1:3000";
async function check(path, expected, init = {}) {
  const response = await fetch(base + path, { ...init, signal: AbortSignal.timeout(60000) });
  assert.equal(response.status, expected, `${init.method || "GET"} ${path}: ${response.status}`);
  return response;
}
try {
  for (const method of ["GET", "POST", "PATCH"]) await check("/api/admin/images/drivers/1", 401, { method });
  const region = (await client.query("SELECT region_id FROM regions WHERE NOT is_deleted LIMIT 1")).rows[0];
  assert.ok(region, "Need an existing development region");
  const path = `/api/admin/images/regions/${region.region_id}`;
  for (const role of ["customer", "admin"]) {
    const user = (await client.query("SELECT user_id FROM users u JOIN roles r USING(role_id) WHERE r.name=$1 AND NOT u.is_deleted AND u.is_active LIMIT 1", [role])).rows[0];
    assert.ok(user, `Need a development ${role}`);
    const token = randomUUID(); tokens.push(token);
    await client.query("INSERT INTO sessions(token,user_id,expires_at) VALUES ($1,$2,now()+interval '5 minutes')", [token, user.user_id]);
    const headers = { Cookie: `session_token=${token}` };
    if (role === "customer") {
      for (const method of ["GET", "POST", "PATCH"]) await check(path, 403, { method, headers });
      continue;
    }
    const response = await check(path, 200, { headers });
    const data = await response.json(); assert.ok(Array.isArray(data.items));
    await check("/api/admin/images/invalid/1", 400, { headers });
    await check("/api/admin/images/drivers/2147483647", 404, { headers });
    await check(path, 403, { method: "POST", headers: { ...headers, Origin: "https://other.example" } });
    await check(path, 400, { method: "PATCH", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ action: "remove", imageId: 0 }) });
    const form = new FormData(); form.set("file", new Blob(["<svg/>"], { type: "image/png" }), "fake.png");
    await check(path, data.configured ? 400 : 503, { method: "POST", headers, body: form });
  }
  console.log("Image API smoke passed: anonymous/customer guards, admin reads, target validation, origin checks, invalid upload; no catalogue changes.");
} finally {
  if (tokens.length) await client.query("DELETE FROM sessions WHERE token=ANY($1::uuid[])", [tokens]);
  await client.end();
}

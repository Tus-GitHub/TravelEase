/** Real development PostgreSQL contention for Google, account deletion and
 * private confirmation. Synthetic fixtures only; no DDL/provider/external mail. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import pg from "pg";
import ts from "typescript";
import nodemailer from "nodemailer";
import { runtimeDatabaseConfig } from "../../src/lib/server/db-config.ts";
import type { CreateSavedResult } from "../../src/lib/server/saved-itineraries.ts";

assert(process.argv.includes("--dev") && !process.env.VERCEL, "Development only");
assert.equal(execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim(), "development");
const host = (value: string) => new URL(value).hostname.replace(/-pooler\./, ".");
const owner = process.env.DATABASE_URL!, runtime = process.env.DATABASE_URL_APP || owner;
assert(owner && process.env.DATABASE_URL_PRODUCTION, "Require endpoints to prove development isolation");
assert.equal(host(owner), host(runtime));
assert.notEqual(host(owner), host(process.env.DATABASE_URL_PRODUCTION));
const application = `p1-races-${randomUUID()}`;
const pool = new pg.Pool({ ...runtimeDatabaseConfig(owner), max: 5, application_name: `${application}-fixtures` });
const app = new pg.Pool({ ...runtimeDatabaseConfig(runtime), max: 8, application_name: application });
(globalThis as unknown as { __pgPool: pg.Pool }).__pgPool = app;
const originalTransport = nodemailer.createTransport;
nodemailer.createTransport = (() => originalTransport({ jsonTransport: true })) as unknown as typeof originalTransport;
process.env.SMTP_HOST = "in-memory.invalid"; process.env.SMTP_USER = "test"; process.env.SMTP_PASS = "test";
const users = await import("../../src/lib/server/users.ts");
const sessions = await import("../../src/lib/server/session.ts");
const profiles = await import("../../src/lib/server/customer-profile.ts");
const saved = await import("../../src/lib/server/saved-itineraries.ts");
const tokens = await import("../../src/lib/server/auth-tokens.ts");
const accounts = await import("../../src/lib/server/account-write.ts");
const google = await import("../../src/lib/server/google-login.ts");
const providers = await import("../../src/lib/server/auth-providers.ts");
const { verifyPassword, hashPassword } = await import("../../src/lib/server/password.ts");
const { transitionBooking, transitionBookingInTransaction } = await import("../../src/lib/server/bookings.ts");
const { updateVehicle, deleteVehicle } = await import("../../src/lib/server/admin/fleet.ts");
const { protectedResourceMutation } = await import("../../src/lib/server/weekend-resources.ts");
const { DependentRowsError } = await import("../../src/lib/server/db-errors.ts");
const userIds: string[] = [], emails: string[] = [], vehicleIds: number[] = [], typeIds: number[] = [], bookingIds: string[] = [];
const password = `Original!${randomUUID()}`;
const profile = { addressLine1: "Synthetic address", addressLine2: "", city: "Test city", state: "Test state", pincode: "411001", latitude: 18.5, longitude: 73.8, preferredTags: [] };
let checks = 0, cookie = "", bookingType: number, admin: Awaited<ReturnType<typeof newUser>>;
const oauthCookies: Record<string, string> = {};
const pass = (name: string) => { checks++; console.log(`PASS ${name}`); };
const email = () => { const value = `p1-${randomUUID()}@example.invalid`; emails.push(value); return value; };
async function newUser(verified = true) {
  const id = randomUUID(); userIds.push(id);
  const address = email();
  await pool.query(`INSERT INTO users(user_id,name,email,phone,password_hash,email_verified_at)
    VALUES($1,'P1 race test',$2,'9999999999',$3,$4)`, [id, address, hashPassword(password), verified ? new Date() : null]);
  return { id, email: address, name: "P1 race test", phone: "9999999999", role: "customer", emailVerified: verified, createdAt: new Date().toISOString() };
}
async function waiting(count = 1) {
  for (let i = 0; i < 120; i++) {
    const r = await pool.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock'", [application]);
    if (r.rows[0].n >= count) return;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  assert.fail(`Expected ${count} application requests waiting on real PostgreSQL locks`);
}
// Queue operations in a known order, verify actual lock waits, then release.
async function ordered(lock: string, params: unknown[], calls: (() => Promise<unknown>)[]) {
  const guard = await pool.connect(), tasks: Promise<unknown>[] = [];
  try {
    await guard.query("BEGIN"); await guard.query(lock, params);
    for (const call of calls) { const task = call(); tasks.push(task); void task.catch(() => {}); await waiting(tasks.length); }
    await guard.query("COMMIT");
    return await Promise.allSettled(tasks);
  } finally { await guard.query("ROLLBACK"); guard.release(); await Promise.allSettled(tasks); }
}
function fulfilled<T>(value: PromiseSettledResult<unknown>): T {
  if (value.status === "rejected") throw value.reason;
  return value.value as T;
}
async function erased(id: string) {
  const row = (await pool.query("SELECT name,phone,email,password_hash,is_deleted,is_active FROM users WHERE user_id=$1", [id])).rows[0];
  assert.deepEqual(row, { name: "Deleted account", phone: "", email: `deleted+${id}@deleted.invalid`, password_hash: "deleted", is_deleted: true, is_active: false });
  for (const table of ["customer_profiles", "sessions", "email_verification_tokens", "password_reset_tokens", "saved_itineraries"]) {
    assert.equal((await pool.query(`SELECT count(*)::int AS n FROM ${table} WHERE user_id=$1`, [id])).rows[0].n, 0, `${table} must stay empty`);
  }
}
async function privateBooking() {
  const vehicle = (await pool.query("INSERT INTO vehicles(vehicle_type_id,name,seating_capacity,base_price_per_day) VALUES($1,'P1 race vehicle',6,1000) RETURNING vehicle_id", [typeIds[0]])).rows[0].vehicle_id;
  vehicleIds.push(vehicle);
  const id = randomUUID(); bookingIds.push(id);
  await pool.query(`INSERT INTO bookings(booking_id,booking_reference,user_id,booking_type_id,vehicle_type_id,vehicle_id,
    start_datetime,end_datetime,passenger_count,status,total_amount)
    VALUES($1,$2,$3,$4,$5,$6,'2090-01-01T10:00:00Z','2090-01-01T12:00:00Z',4,'PendingPayment',1000)`,
    [id, randomUUID().slice(0,20), admin.id, bookingType, typeIds[0], vehicle]);
  return { id, vehicle };
}
async function bookingState(id: string) {
  return (await pool.query(`SELECT status,
    (SELECT count(*)::int FROM booking_status_history WHERE booking_id=$1) AS history,
    (SELECT count(*)::int FROM vehicle_availability WHERE booking_id=$1 AND NOT is_deleted) AS blocks
    FROM bookings WHERE booking_id=$1`, [id])).rows[0];
}
const confirm = (id: string) => transitionBooking({ bookingId: id, toStatus: "Confirmed", user: admin });
// Evaluate the real route with only Next's request-cookie boundary replaced.
// All authorization/persistence/transaction code below uses the real dev DB.
const require = createRequire(import.meta.url);
function route(file: string, aliases: Record<string, unknown>) {
  const source = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} as Record<string, (...args: unknown[]) => Promise<Response>> };
  new Function("require", "module", "exports", source)((id: string) => {
    if (id === "next/headers") return { cookies: () => ({ get: (name: string) => {
      const value = name === sessions.SESSION_COOKIE ? cookie : oauthCookies[name];
      return value ? { value } : undefined;
    } }) };
    return aliases[id] ?? require(id);
  }, mod, mod.exports);
  return mod.exports;
}
const profileRoute = route("src/app/api/profile/route.ts", {
  "@/lib/server/users": users, "@/lib/server/session": sessions, "@/lib/server/customer-profile": profiles,
  "@/lib/server/account-write": accounts, "@/lib/validation": await import("../../src/lib/validation.ts"),
  "@/lib/travelTags": await import("../../src/lib/travelTags.ts"),
});
const patch = (body: unknown) => profileRoute.PATCH(new Request("http://localhost/api/profile", { method: "PATCH", body: JSON.stringify(body) }));
try {
  admin = { ...await newUser(), role: "admin" };
  await pool.query("UPDATE users SET role_id=(SELECT role_id FROM roles WHERE name='admin') WHERE user_id=$1", [admin.id]);
  bookingType = (await pool.query("SELECT booking_type_id FROM booking_types WHERE code='point_to_point'")).rows[0].booking_type_id;
  for (let i = 0; i < 2; i++) typeIds.push((await pool.query("INSERT INTO vehicle_types(slug,title) VALUES($1,'P1 race type') RETURNING vehicle_type_id", [`p1-${randomUUID()}`])).rows[0].vehicle_type_id);
  {
    const address = email(), subject = randomUUID();
    const results = await Promise.all([google.finishGoogleLogin(subject, address, "New Google"), google.finishGoogleLogin(subject, address, "New Google")]);
    const rows = (await pool.query("SELECT user_id,email_verified_at FROM users WHERE email=$1", [address])).rows;
    assert.equal(rows.length, 1); userIds.push(rows[0].user_id); assert(rows[0].email_verified_at);
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM user_auth_providers WHERE provider_user_id=$1", [subject])).rows[0].n, 1);
    for (const result of results) assert.equal(await sessions.getUserIdForToken(result.token), rows[0].user_id);
    pass("concurrent Google callbacks create one verified account/link and ordinary sessions");
  }
  {
    const u = await newUser(false), subject = randomUUID();
    const reset = await tokens.createAuthToken("password_reset", u.id);
    await tokens.createAuthToken("email_verification", u.id); await sessions.createSession(u.id);
    const login = await google.finishGoogleLogin(subject, u.email.toUpperCase(), "Ignored name");
    const row = await users.findUserById(u.id); assert(row?.email_verified_at); assert(!verifyPassword(password, row!.password_hash));
    assert.equal(await sessions.getUserIdForToken(login.token), u.id);
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM sessions WHERE user_id=$1", [u.id])).rows[0].n, 1);
    assert.equal(await tokens.redeemAuthToken("password_reset", reset, async () => true), null);
    for (const table of ["email_verification_tokens", "password_reset_tokens"]) assert.equal((await pool.query(`SELECT count(*)::int AS n FROM ${table} WHERE user_id=$1`, [u.id])).rows[0].n, 0);
    pass("unverified Google linking retires pre-registered password, old sessions and emailed credentials");
  }
  {
    // Uncommitted signup is invisible to the initial lookup. Google must wait
    // on the unique email, then secure the collision winner in the SAME flow.
    const guard = await pool.connect(), id = randomUUID(), address = email(); userIds.push(id);
    let task: ReturnType<typeof google.finishGoogleLogin> | undefined;
    try {
      await guard.query("BEGIN");
      await guard.query("INSERT INTO users(user_id,name,email,phone,password_hash) VALUES($1,'Concurrent signup',$2,'',$3)", [id,address,hashPassword(password)]);
      task = google.finishGoogleLogin(randomUUID(), address, "Google signup"); void task.catch(() => {});
      await waiting(); await guard.query("COMMIT");
      const login = await task, row = await users.findUserById(id);
      assert(row?.email_verified_at); assert(!verifyPassword(password, row!.password_hash)); assert.equal(await sessions.getUserIdForToken(login.token), id);
      pass("Google / uncommitted password-signup unique-email collision enforces verification and password invalidation");
    } finally { await guard.query("ROLLBACK"); guard.release(); await task?.catch(() => {}); }
  }
  {
    const u = await newUser(), subject = randomUUID();
    await google.finishGoogleLogin(subject, u.email, "Ignored");
    assert(verifyPassword(password, (await users.findUserById(u.id))!.password_hash));
    await pool.query("UPDATE users SET is_active=false WHERE user_id=$1", [u.id]);
    await assert.rejects(google.finishGoogleLogin(subject, email(), "Disabled"), accounts.AccountUnavailableError);
    await pool.query("UPDATE users SET is_active=true WHERE user_id=$1", [u.id]);
    const other = await newUser();
    await assert.rejects(providers.linkProvider(other.id, "google", subject, other.email), /already linked/);
    assert.equal(await providers.findUserIdByProvider("google", subject), u.id);
    await users.deleteAccount(u.id);
    const recreated = await google.finishGoogleLogin(subject, u.email, "Recreated Google");
    const recreatedId = await sessions.getUserIdForToken(recreated.token); assert(recreatedId && recreatedId !== u.id); userIds.push(recreatedId!);
    await erased(u.id);
    pass("verified password retained, disabled login blocked, live identity never repointed; deleted Google identity can recreate safely");
  }
  {
    const u = await newUser(false), guard = await pool.connect();
    let task: ReturnType<typeof google.finishGoogleLogin> | undefined;
    try {
      await guard.query("BEGIN");
      await guard.query("SELECT 1 FROM users WHERE user_id=$1 FOR UPDATE", [u.id]);
      task = google.finishGoogleLogin(randomUUID(), u.email, "Late Google"); void task.catch(() => {});
      await waiting();
      await guard.query("UPDATE users SET is_active=false WHERE user_id=$1", [u.id]); await guard.query("COMMIT");
      await assert.rejects(task, accounts.AccountUnavailableError);
      assert.equal((await pool.query("SELECT count(*)::int AS n FROM sessions WHERE user_id=$1", [u.id])).rows[0].n, 0);
      pass("Google rechecks account eligibility after waiting for the user lock");
    } finally { await guard.query("ROLLBACK"); guard.release(); await task?.catch(() => {}); }
  }
  for (const existing of [true, false]) {
    const u = existing ? await newUser(false) : null, address = u?.email ?? email(), subject = randomUUID();
    const raw = u ? await tokens.createAuthToken("password_reset", u.id) : null;
    const oldSession = u ? await sessions.createSession(u.id) : null;
    const connect = app.connect;
    // Inject a failure AFTER account security/linking, at the session INSERT.
    // All earlier writes are real SQL; no schema/trigger manipulation is used.
    app.connect = (async () => {
      const client = await (connect as () => Promise<pg.PoolClient>).call(app);
      return new Proxy(client, { get(target, key) {
        if (key === "query") return (sql: string, ...args: unknown[]) => {
          if (/INSERT INTO sessions/i.test(sql)) throw new Error("injected Google session failure");
          return Reflect.apply(target.query, target, [sql, ...args]);
        };
        const value = Reflect.get(target, key); return typeof value === "function" ? value.bind(target) : value;
      } });
    }) as typeof app.connect;
    try { await assert.rejects(google.finishGoogleLogin(subject, address, "Rollback Google"), /injected Google session failure/); }
    finally { app.connect = connect; }
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM user_auth_providers WHERE provider_user_id=$1", [subject])).rows[0].n, 0);
    if (u) {
      const row = await users.findUserById(u.id); assert(!row?.email_verified_at); assert(verifyPassword(password, row!.password_hash));
      assert.equal(await sessions.getUserIdForToken(oldSession!.token), u.id);
      assert.equal(await tokens.redeemAuthToken("password_reset", raw, async () => true), true);
    } else assert.equal(await users.findUserByEmail(address), undefined);
    pass(`Google session failure rolls back ${existing ? "link, verification, password and credential retirement" : "new account and link"}`);
  }
  {
    const callback = route("src/app/api/auth/google/callback/route.ts", {
      "@/lib/server/email": await import("../../src/lib/server/email.ts"),
      "@/lib/server/google-login": google, "@/lib/server/session": sessions,
    });
    const u = await newUser(false), fetch = globalThis.fetch;
    const clientId = process.env.GOOGLE_CLIENT_ID, secret = process.env.GOOGLE_CLIENT_SECRET;
    process.env.GOOGLE_CLIENT_ID = "synthetic-google-client"; process.env.GOOGLE_CLIENT_SECRET = "synthetic-only";
    oauthCookies.g_oauth_state = randomUUID(); oauthCookies.g_oauth_nonce = randomUUID();
    let exchanges = 0, verified = true;
    globalThis.fetch = (async (url: string | URL | Request) => {
      assert.equal(String(url), "https://oauth2.googleapis.com/token"); exchanges++;
      const claims = { sub: randomUUID(), email: u.email, email_verified: verified, aud: "synthetic-google-client", iss: "https://accounts.google.com", exp: Date.now()/1000+300, nonce: oauthCookies.g_oauth_nonce };
      return Response.json({ id_token: `synthetic.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.synthetic` });
    }) as typeof globalThis.fetch;
    try {
      const invalid = await callback.GET(new Request("http://localhost/api/auth/google/callback?code=synthetic&state=wrong"));
      assert.equal(new URL(invalid.headers.get("location")!).searchParams.get("notice"), "google-failed"); assert.equal(exchanges, 0);
      verified = false;
      const unverified = await callback.GET(new Request(`http://localhost/api/auth/google/callback?code=synthetic&state=${oauthCookies.g_oauth_state}`));
      assert.equal(new URL(unverified.headers.get("location")!).searchParams.get("notice"), "google-failed");
      verified = true;
      const response = await callback.GET(new Request(`http://localhost/api/auth/google/callback?code=synthetic&state=${oauthCookies.g_oauth_state}`));
      assert.equal(response.status, 307); assert.equal(new URL(response.headers.get("location")!).pathname, "/");
      const setCookie = response.headers.get("set-cookie")!;
      const token = setCookie.match(/session_token=([a-f0-9-]{36})/)?.[1]; assert(token);
      assert.equal(await sessions.getUserIdForToken(token), u.id);
      assert.match(setCookie, /HttpOnly/i); assert.match(setCookie, /SameSite=lax/i); assert.match(setCookie, /Max-Age=2592000/);
      assert((await users.findUserById(u.id))?.email_verified_at); assert(!verifyPassword(password, (await users.findUserById(u.id))!.password_hash));
      pass("real Google callback rejects bad state/unverified claims and issues its ordinary secure cookie after atomic account resolution (provider exchange mocked)");
    } finally {
      globalThis.fetch = fetch;
      if (clientId === undefined) delete process.env.GOOGLE_CLIENT_ID; else process.env.GOOGLE_CLIENT_ID = clientId;
      if (secret === undefined) delete process.env.GOOGLE_CLIENT_SECRET; else process.env.GOOGLE_CLIENT_SECRET = secret;
      delete oauthCookies.g_oauth_state; delete oauthCookies.g_oauth_nonce;
    }
  }
  for (const googleFirst of [true, false]) {
    const u = await newUser(false), raw = await tokens.createAuthToken("password_reset", u.id), replacement = `Reset!${randomUUID()}`;
    const login = () => google.finishGoogleLogin(randomUUID(), u.email, "Google");
    const reset = () => tokens.redeemAuthToken("password_reset", raw, async (id, client) => {
      await users.setUserPassword(id, replacement, client); await users.markEmailVerified(id, client);
      await sessions.destroyAllSessionsForUser(id, client); return true;
    });
    const results = await ordered("SELECT 1 FROM users WHERE user_id=$1 FOR UPDATE", [u.id], googleFirst ? [login, reset] : [reset, login]);
    assert.equal(fulfilled(results[googleFirst ? 1 : 0]), googleFirst ? null : true);
    const row = await users.findUserById(u.id); assert(row?.email_verified_at); assert(!verifyPassword(password, row!.password_hash));
    assert.equal(verifyPassword(replacement, row!.password_hash), !googleFirst);
    const session = fulfilled<Awaited<ReturnType<typeof google.finishGoogleLogin>>>(results[googleFirst ? 0 : 1]);
    assert.equal(await sessions.getUserIdForToken(session.token), u.id);
    pass(`Google / password-reset race: ${googleFirst ? "Google retires the old token" : "completed reset password is preserved"}`);
  }
  const spots = (await pool.query("SELECT tourist_spot_id FROM tourist_spots WHERE NOT is_deleted ORDER BY tourist_spot_id LIMIT 2")).rows.map(r => r.tourist_spot_id);
  assert.equal(spots.length, 2, "Two existing catalogue spots are required for synthetic saved routes");
  const personalWrite = async (id: string) => accounts.withActiveAccount(id, async client => {
    await users.updateUser(id, "New personal name", "9999999999", client);
    await profiles.upsertCustomerProfile(id, profile, client);
    await sessions.createSession(id, true, client);
  });
  for (const deletionFirst of [true, false]) {
    const u = await newUser(); await tokens.createAuthToken("password_reset", u.id);
    await saved.createSavedItinerary(u.id, { kind: "custom", spotIds: spots });
    const calls = deletionFirst ? [() => users.deleteAccount(u.id), () => personalWrite(u.id)] : [() => personalWrite(u.id), () => users.deleteAccount(u.id)];
    const results = await ordered("SELECT 1 FROM users WHERE user_id=$1 FOR UPDATE", [u.id], calls);
    if (deletionFirst) {
      assert.equal(fulfilled(results[0]), true); assert.equal(results[1].status, "rejected");
      assert((results[1] as PromiseRejectedResult).reason instanceof accounts.AccountUnavailableError);
    } else { fulfilled(results[0]); assert.equal(fulfilled(results[1]), true); }
    await erased(u.id);
    for (const write of [() => users.updateUser(u.id, "Must not return", "9999999999"), () => profiles.upsertCustomerProfile(u.id, profile), () => sessions.createSession(u.id), () => users.setUserPassword(u.id, password), () => users.markEmailVerified(u.id)]) await assert.rejects(write(), accounts.AccountUnavailableError);
    const save = await saved.createSavedItinerary(u.id, { kind: "custom", spotIds: spots }); assert(!save.ok && save.status === 401);
    assert.equal(await tokens.createAuthTokenWithCooldown("password_reset", u.id, 0), null);
    assert.equal(await users.deleteAccount(u.id), false); await erased(u.id);
    pass(`${deletionFirst ? "deletion before writers" : "writers before deletion"}: scrubbed PII stays scrubbed, no profile/session/token/saved rows resurrect`);
  }
  for (const deletionFirst of [true, false]) {
    const u = await newUser();
    const calls = deletionFirst ? [() => users.deleteAccount(u.id), () => saved.createSavedItinerary(u.id, { kind: "custom", spotIds: spots }), () => tokens.createAuthTokenWithCooldown("password_reset", u.id, 0)]
      : [() => saved.createSavedItinerary(u.id, { kind: "custom", spotIds: spots }), () => tokens.createAuthTokenWithCooldown("password_reset", u.id, 0), () => users.deleteAccount(u.id)];
    const results = await ordered("SELECT 1 FROM users WHERE user_id=$1 FOR UPDATE", [u.id], calls);
    if (deletionFirst) { const r = fulfilled<CreateSavedResult>(results[1]); assert(!r.ok && r.status === 401); assert.equal(fulfilled(results[2]), null); }
    else { assert(fulfilled<CreateSavedResult>(results[0]).ok); assert(fulfilled(results[1])); }
    await erased(u.id); pass(`saved route and token issuance / deletion serialized in ${deletionFirst ? "delete-first" : "write-first"} order`);
  }
  for (const deletionFirst of [true, false]) {
    const u = await newUser(), subject = randomUUID();
    // Existing link ensures Google waits on the same account rather than
    // starting a legitimately new signup after a completed deletion.
    await providers.linkProvider(u.id, "google", subject, u.email);
    const calls = deletionFirst ? [() => users.deleteAccount(u.id), () => google.finishGoogleLogin(subject, u.email, "Google")]
      : [() => google.finishGoogleLogin(subject, u.email, "Google"), () => users.deleteAccount(u.id)];
    const results = await ordered("SELECT 1 FROM users WHERE user_id=$1 FOR UPDATE", [u.id], calls);
    if (deletionFirst) { assert.equal(results[1].status, "rejected"); assert((results[1] as PromiseRejectedResult).reason instanceof accounts.AccountUnavailableError); }
    else fulfilled(results[0]);
    await erased(u.id); pass(`Google session / deletion serialized in ${deletionFirst ? "delete-first" : "login-first"} order`);
  }
  {
    const u = await newUser(); cookie = (await sessions.createSession(u.id)).token;
    assert.equal((await patch({ name: "Must not persist", profile: { pincode: "bad" } })).status, 400);
    assert.equal((await users.findUserById(u.id))!.name, u.name); assert.equal(await profiles.getCustomerProfile(u.id), null);
    const results = await ordered("SELECT 1 FROM users WHERE user_id=$1 FOR UPDATE", [u.id], [() => patch({ profile: { city: "Merged city" } }), () => patch({ profile: { state: "Merged state" } })]);
    for (const result of results) assert.equal(fulfilled<Response>(result).status, 200);
    const p = await profiles.getCustomerProfile(u.id); assert.equal(p?.city, "Merged city"); assert.equal(p?.state, "Merged state");
    let releaseBody: (value: unknown) => void = () => {}, enteredBody: () => void = () => {};
    const body = new Promise(resolve => { releaseBody = resolve; });
    const entered = new Promise<void>(resolve => { enteredBody = resolve; });
    const stalePatch = profileRoute.PATCH({ json: () => { enteredBody(); return body; } });
    // PATCH has read a valid session, but its body is still arriving.
    await entered;
    assert(await users.deleteAccount(u.id)); releaseBody({ name: "Resurrected PII", profile: profile });
    assert.equal((await stalePatch).status, 401); await erased(u.id);
    pass("real profile PATCH validates before writing, merges concurrent changes and rejects a request authorized before deletion");
  }
  {
    const u = await newUser();
    await assert.rejects(accounts.withActiveAccount(u.id, async client => {
      await users.updateUser(u.id, "Rolled back", "9999999999", client);
      await profiles.upsertCustomerProfile(u.id, profile, client); await sessions.createSession(u.id, false, client);
      throw new Error("injected rollback");
    }), /injected rollback/);
    assert.equal((await users.findUserById(u.id))!.name, u.name); assert.equal(await profiles.getCustomerProfile(u.id), null);
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM sessions WHERE user_id=$1", [u.id])).rows[0].n, 0);
    assert(await users.deleteAccount(u.id)); await erased(u.id);
    pass("personal-data transaction rollback is atomic and releases the account lock");
  }
  for (const edit of ["deleted", "inactive", "unavailable", "type", "capacity"]) {
    const b = await privateBooking();
    const updates: Record<string, string> = { deleted: "is_deleted=true", inactive: "is_active=false", unavailable: "is_available=false", type: `vehicle_type_id=${typeIds[1]}`, capacity: "seating_capacity=3" };
    const results = await ordered(`UPDATE vehicles SET ${updates[edit]} WHERE vehicle_id=$1`, [b.vehicle], [() => confirm(b.id)]);
    const result = fulfilled<Awaited<ReturnType<typeof confirm>>>(results[0]); assert(!result.ok && result.code === "invalid_transition");
    assert.deepEqual(await bookingState(b.id), { status: "PendingPayment", history: 0, blocks: 0 });
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM notifications WHERE booking_id=$1", [b.id])).rows[0].n, 0);
    pass(`private confirmation waits then rejects ${edit} vehicle with no status/history/block writes`);
  }
  for (const editFirst of [true, false]) {
    const b = await privateBooking();
    const edit = () => updateVehicle(b.vehicle, { isAvailable: false }, admin.id);
    const results = await ordered("SELECT 1 FROM vehicles WHERE vehicle_id=$1 FOR UPDATE", [b.vehicle], editFirst ? [edit, () => confirm(b.id)] : [() => confirm(b.id), edit]);
    if (editFirst) {
      assert(fulfilled(results[0])); assert(!fulfilled<Awaited<ReturnType<typeof confirm>>>(results[1]).ok);
      assert.deepEqual(await bookingState(b.id), { status: "PendingPayment", history: 0, blocks: 0 });
    } else {
      assert(fulfilled<Awaited<ReturnType<typeof confirm>>>(results[0]).ok);
      assert.equal(results[1].status, "rejected"); assert((results[1] as PromiseRejectedResult).reason instanceof DependentRowsError);
      assert.deepEqual(await bookingState(b.id), { status: "Confirmed", history: 1, blocks: 1 });
    }
    pass(`fleet availability edit / private confirmation: exactly one winner in ${editFirst ? "edit-first" : "confirm-first"} order`);
  }
  {
    const b = await privateBooking(); assert((await confirm(b.id)).ok);
    for (const status of ["Confirmed", "Ongoing"]) {
      if (status === "Ongoing") assert((await transitionBooking({ bookingId: b.id, toStatus: "Ongoing", user: admin })).ok);
      for (const edit of [() => deleteVehicle(b.vehicle, admin.id), () => updateVehicle(b.vehicle, { isAvailable: false }, admin.id), () => updateVehicle(b.vehicle, { seatingCapacity: 3 }, admin.id), () => updateVehicle(b.vehicle, { vehicleTypeId: typeIds[1] }, admin.id),
        () => protectedResourceMutation("vehicles", b.vehicle, { isActive: false }, db => db.query("UPDATE vehicles SET is_active=false WHERE vehicle_id=$1", [b.vehicle]))]) await assert.rejects(edit(), DependentRowsError);
      assert(await updateVehicle(b.vehicle, { name: "Safe metadata change", seatingCapacity: 8 }, admin.id));
    }
    assert((await transitionBooking({ bookingId: b.id, toStatus: "Completed", user: admin })).ok);
    assert(await updateVehicle(b.vehicle, { isAvailable: false }, admin.id));
    pass("confirmed/ongoing private trips protect vehicle deletion, availability, active flag, type and capacity; safe metadata/increases and completed release allowed");
  }
  {
    const b = await privateBooking(), client = await app.connect();
    try {
      await client.query("BEGIN");
      assert((await transitionBookingInTransaction(client, { bookingId: b.id, toStatus: "Confirmed", user: admin }, [])).ok);
      await client.query("ROLLBACK");
      assert.deepEqual(await bookingState(b.id), { status: "PendingPayment", history: 0, blocks: 0 });
      assert((await confirm(b.id)).ok);
      assert((await transitionBooking({ bookingId: b.id, toStatus: "Cancelled", user: admin })).ok);
      assert.equal((await bookingState(b.id)).blocks, 0); assert(await deleteVehicle(b.vehicle, admin.id));
      pass("private confirmation rollback is atomic; cancellation releases vehicle protection and availability block");
    } finally { await client.query("ROLLBACK"); client.release(); }
  }
  console.log(`PASS ${checks} P1 race regression groups`);
} finally {
  try {
    // Include accounts created by Google before an assertion/failure could track them.
    const extra = (await pool.query("SELECT user_id FROM users WHERE email=ANY($1::text[])", [emails])).rows.map(r => r.user_id);
    const ids = [...new Set([...userIds, ...extra])];
    await pool.query("DELETE FROM notifications WHERE user_id=ANY($1::uuid[]) OR booking_id IN(SELECT booking_id FROM bookings WHERE user_id=ANY($1::uuid[]) OR created_by=ANY($1::uuid[]))", [ids]);
    await pool.query("DELETE FROM activity_logs WHERE user_id=ANY($1::uuid[])", [ids]);
    await pool.query("DELETE FROM bookings WHERE booking_id=ANY($1::uuid[])", [bookingIds]);
    await pool.query("DELETE FROM saved_itineraries WHERE user_id=ANY($1::uuid[])", [ids]);
    await pool.query("DELETE FROM customer_profiles WHERE user_id=ANY($1::uuid[])", [ids]);
    await pool.query("DELETE FROM vehicles WHERE vehicle_id=ANY($1::int[])", [vehicleIds]);
    await pool.query("DELETE FROM vehicle_types WHERE vehicle_type_id=ANY($1::int[])", [typeIds]);
    await pool.query("DELETE FROM users WHERE user_id=ANY($1::uuid[])", [ids]);
    for (const [table, column, values] of [["users", "user_id", ids], ["bookings", "booking_id", bookingIds], ["vehicles", "vehicle_id", vehicleIds], ["vehicle_types", "vehicle_type_id", typeIds]] as const) {
      assert.equal(Number((await pool.query(`SELECT count(*) AS n FROM ${table} WHERE ${column}=ANY($1)`, [values])).rows[0].n), 0);
    }
    console.log("Synthetic fixtures removed and absence verified; no external messages or production access.");
  } finally { nodemailer.createTransport = originalTransport; await app.end(); await pool.end(); }
}

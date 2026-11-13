/** Real browser/API/dev DB auth acceptance. Emails terminate at a loopback sink. */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync, fork } from "node:child_process";
import { createRequire } from "node:module";
import { mkdir, realpath, lstat, unlink, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import pg from "pg";
import { runtimeDatabaseConfig } from "../../src/lib/server/db-config.ts";
import { localMailSink } from "./_local-smtp.mjs";
import { getPool } from "../../src/lib/server/db.ts";
import { createAuthToken, redeemAuthToken } from "../../src/lib/server/auth-tokens.ts";
import { setUserPassword, markEmailVerified } from "../../src/lib/server/users.ts";
import { createSession, destroyAllSessionsForUser } from "../../src/lib/server/session.ts";
import { loginReturnPath } from "../../src/lib/auth-redirect.ts";

assert(process.argv.includes("--dev") && !process.env.VERCEL, "Local development only");
assert.equal(execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim(), "development");
const host = (value: string) => new URL(value).hostname.replace(/-pooler\./, ".");
const owner = process.env.DATABASE_URL!, runtime = process.env.DATABASE_URL_APP!;
assert(owner && runtime && process.env.DATABASE_URL_PRODUCTION);
assert.equal(host(owner), host(runtime));
assert.notEqual(host(owner), host(process.env.DATABASE_URL_PRODUCTION));
const modulePath = process.argv.find(value => value.startsWith("--browser-module="))?.slice(17);
assert(modulePath, "Pass --browser-module=<installed Playwright module>");
const { chromium } = createRequire(import.meta.url)(modulePath);
const artifacts = process.argv.find(value => value.startsWith("--artifacts="))?.slice(12);
const pool = new pg.Pool({ ...runtimeDatabaseConfig(owner), max: 4, application_name: "auth-acceptance-fixtures" });
const runId = randomUUID();
const emails = [0, 1, 2].map(i => `auth-${runId}-${i}@example.invalid`);
const missingEmail = `absent-${runId}@example.invalid`;
const base = "http://127.0.0.1:3103";
const password = `Initial!${randomUUID()}`, replacement = `Updated!${randomUUID()}`;
const hash = (raw: string) => createHash("sha256").update(raw).digest("hex");
let child: ReturnType<typeof fork> | undefined, browser: { close(): Promise<void> } | undefined;
let sink: Awaited<ReturnType<typeof localMailSink>> | undefined, sandbox: string | undefined;
let serverLog = "", checks = 0;
let appPool: pg.Pool | undefined;
const failures: string[] = [];
const redact = (s: string) => s.replace(/postgres(?:ql)?:\/\/\S+/g, "[database URL]").replace(/token=[^\s&"<>]+/g, "token=[redacted]");
async function api(route: string, data?: unknown, cookie?: string, origin = base, method = "POST") {
  return fetch(base + "/api/auth/" + route, { method, redirect: "manual", signal: AbortSignal.timeout(90_000),
    headers: { "Content-Type": "application/json", Origin: origin, ...(cookie ? { Cookie: cookie } : {}) },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
}
async function status(response: Promise<Response>, expected: number, label: string, collect = false) {
  const r = await response; checks++;
  if (collect && r.status !== expected) failures.push(`${label}: expected ${expected}, got ${r.status}`);
  else assert.equal(r.status, expected, label);
  return r;
}
const cookieOf = (r: Response) => r.headers.get("set-cookie")?.split(";")[0];
async function me(cookie?: string) { return (await (await api("me", undefined, cookie, base, "GET")).json()).user; }
async function user(email: string) { return (await pool.query("SELECT * FROM users WHERE email=$1", [email])).rows[0]; }
function links(email: string, route: string): string[] {
  // Nodemailer emits quoted-printable multipart text/html. Decode soft wraps and
  // hex escapes in memory only; never persist the message or the raw auth token.
  return sink!.messages.filter(message => message.to.includes(email)).flatMap(message => {
    const decoded = message.content.replace(/=\r?\n/g, "").replace(/=([\dA-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
    return [...new Set([...decoded.matchAll(/http:\/\/127\.0\.0\.1:3103\/[^\s"<>]+/g)].map(match => match[0]))].filter(url => new URL(url).pathname === route);
  });
}
const tokenOf = (url: string) => new URL(url).searchParams.get("token")!;
async function ageTokens(kind: "email_verification_tokens" | "password_reset_tokens", id: string, expire = false) {
  await pool.query(`UPDATE ${kind} SET created_at=now()-interval '2 minutes'${expire ? ", expires_at=now()-interval '1 second'" : ""} WHERE user_id=$1`, [id]);
}
try {
  sink = await localMailSink(emails);
  child = fork(path.resolve("db/tests/_booking-server.cjs"), [], { execArgv: [], silent: true, windowsHide: true,
    env: { ...process.env, DATABASE_URL_PRODUCTION: undefined, VERCEL_ENV: undefined, DATABASE_URL: runtime,
      BOOKING_SMOKE_BUILD: process.argv.includes("--built") ? "1" : "0", NODE_ENV: process.argv.includes("--built") ? "production" : "development", BOOKING_SMOKE_SERVER: "dev-only", APP_ORIGIN: base,
      AUTHGEAR_MOBILE_ENABLED: "false",
      SMTP_HOST: "127.0.0.1", SMTP_PORT: String(sink.port), SMTP_USER: "test", SMTP_PASS: "test", EMAIL_FROM: "Auth acceptance <test@example.invalid>" } });
  for (const stream of [child.stdout, child.stderr]) stream?.on("data", chunk => { serverLog = (serverLog + chunk.toString()).slice(-6000); });
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Isolated server startup timed out")), process.argv.includes("--built") ? 600_000 : 120_000);
    child!.on("message", (message: { ready?: boolean; sandbox?: string }) => {
      if (message.sandbox) sandbox = message.sandbox;
      if (message.ready) { clearTimeout(timer); resolve(); }
    });
    child!.once("exit", code => { clearTimeout(timer); reject(new Error(`Isolated server exited ${code}`)); });
  });
  console.log("Auth test server ready; only development DB and synthetic local email recipients.");
  const instance = await chromium.launch({ channel: "chrome", headless: true }); browser = instance;
  const context = await instance.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const pageErrors: string[] = [];
  page.on("pageerror", (e: Error) => pageErrors.push(redact(e.message)));
  await page.goto(base + "/login", { waitUntil: "networkidle", timeout: 90_000 });
  await page.getByRole("button", { name: "Mobile + OTP", exact: true }).click();
  await page.getByRole("button", { name: "Continue with mobile OTP", exact: true }).waitFor();
  assert.equal(await page.getByRole("link", { name: "Continue with Google", exact: true }).count(), 1);
  if (artifacts) {
    await mkdir(artifacts, { recursive: true });
    await page.screenshot({ path: path.join(artifacts, "mobile-login-choice.png"), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
    await page.screenshot({ path: path.join(artifacts, "mobile-login-phone.png"), fullPage: true });
    await page.setViewportSize({ width: 1280, height: 900 });
  }
  await page.getByRole("button", { name: "Continue with mobile OTP", exact: true }).click();
  await page.getByText("Mobile OTP is currently unavailable. Please use email and password or Google.", { exact: true }).waitFor();
  await page.getByLabel("Email", { exact: true }).waitFor();
  await page.getByLabel("Password", { exact: true }).waitFor();
  await status(api("mobile", undefined, undefined, "https://outside.example"), 403, "Mobile linking rejects foreign origin");
  await status(api("mobile/status", undefined, undefined, base, "GET"), 401, "Mobile settings require login");
  await status(api("mobile/status", undefined, undefined, "https://outside.example", "DELETE"), 403, "Mobile removal rejects foreign origin");
  const invalidMobile = await status(api("mobile/callback?code=forged&state=forged", undefined, undefined, base, "GET"), 303, "Missing mobile flow cannot create a session");
  assert(!invalidMobile.headers.get("set-cookie")?.includes("session_token="));
  console.log("PASS mobile choice, unavailable-SMS fallback, Google presence, and mobile endpoint guards.");
  await page.goto(base + "/signup", { waitUntil: "networkidle", timeout: 90_000 });
  await page.getByLabel("Full name", { exact: true }).fill("Auth acceptance");
  await page.getByLabel("Email", { exact: true }).fill(emails[0]);
  await page.getByLabel("Phone number", { exact: true }).fill("9999999999");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await page.getByText("Please confirm your password.", { exact: true }).waitFor();
  assert.equal(await user(emails[0]), undefined, "Missing password confirmation must not create an account");
  await page.getByLabel(/^Confirm password/).fill(password);
  const signupResponse = page.waitForResponse((r: { url(): string }) => r.url() === base + "/api/auth/signup");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  assert.equal((await signupResponse).status(), 201); checks++;
  await page.getByRole("heading", { name: "Confirm your email", exact: true }).waitFor();
  assert(!(await context.cookies()).some((c: { name: string }) => c.name === "session_token"));
  await page.route("**/api/auth/resend-verification", (route: { fulfill(options: object): Promise<void> }) => route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"test unavailable"}' }));
  await page.getByRole("button", { name: "Resend verification email", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "Couldn't request a verification email. Please try again." }).waitFor();
  assert.equal(sink.messages.length, 1);
  await page.unroute("**/api/auth/resend-verification");
  const main = await user(emails[0]); assert(main); assert.equal(main.email_verified_at, null); assert.equal(main.role_id, 1);
  const verification = links(emails[0], "/api/auth/verify-email")[0]; assert(verification, "Verification email contains local link");
  const savedToken = (await pool.query("SELECT token_hash FROM email_verification_tokens WHERE user_id=$1", [main.user_id])).rows[0];
  assert.equal(savedToken.token_hash, hash(tokenOf(verification))); assert.notEqual(savedToken.token_hash, tokenOf(verification));
  await status(api("login", { email: emails[0], password }), 403, "Unverified login blocked");
  const beforeResend = sink.messages.length;
  await status(api("resend-verification", { email: emails[0] }), 200, "Immediate resend neutral");
  assert.equal(sink.messages.length, beforeResend, "Immediate resend throttled");
  await page.goto(verification, { waitUntil: "networkidle", timeout: 90_000 });
  assert.equal(new URL(page.url()).searchParams.get("verified"), "1");
  const sessionCookie = (await context.cookies()).find((c: { name: string }) => c.name === "session_token");
  assert(sessionCookie?.httpOnly); assert.equal(sessionCookie.sameSite, "Lax"); assert.equal(sessionCookie.expires, -1);
  const firstCookie = `session_token=${sessionCookie.value}`;
  assert.equal((await me(firstCookie)).id, main.user_id);
  assert((await user(emails[0])).email_verified_at);
  const reused = await status(fetch(verification, { redirect: "manual" }), 307, "Reused verification redirects");
  assert.equal(new URL(reused.headers.get("location")!).searchParams.get("verify"), "invalid");
  assert.equal(reused.headers.get("set-cookie"), null);
  console.log("PASS browser signup -> captured verification link -> verified session; unverified login blocked and link single-use.");

  await page.goto(base + "/profile", { waitUntil: "networkidle", timeout: 90_000 });
  await page.getByRole("heading", { name: "Mobile OTP login", exact: true }).waitFor();
  await page.getByText("Mobile OTP setup is not available yet.", { exact: true }).waitFor();
  await page.locator("section").getByRole("button", { name: "Logout", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await page.route("**/api/auth/logout", (route: { fulfill(options: object): Promise<void> }) => route.fulfill({ status: 503 }));
  await dialog.getByRole("button", { name: "Log out", exact: true }).click();
  await dialog.getByRole("alert").waitFor();
  assert.equal((await me(firstCookie)).id, main.user_id, "Failed logout keeps authenticated state");
  await page.unroute("**/api/auth/logout");
  const logoutResponse = page.waitForResponse((r: { url(): string }) => r.url() === base + "/api/auth/logout");
  await dialog.getByRole("button", { name: "Log out", exact: true }).click();
  assert.equal((await logoutResponse).status(), 200); checks++;
  await page.waitForURL((url: URL) => url.origin === base && ["/", "/login"].includes(url.pathname));
  assert.equal(await me(firstCookie), null);
  await page.goto(base + "/login?redirect=%2Fprofile", { waitUntil: "networkidle", timeout: 90_000 });
  await page.getByLabel("Email", { exact: true }).fill(emails[0].toUpperCase());
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Keep me signed in").check();
  const loginResponse = page.waitForResponse((r: { url(): string }) => r.url() === base + "/api/auth/login");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  assert.equal((await loginResponse).status(), 200); checks++;
  await page.waitForURL(base + "/profile", { timeout: 90_000 });
  const remembered = (await context.cookies()).find((c: { name: string }) => c.name === "session_token");
  assert(remembered.expires > Date.now() / 1000 + 29 * 86400);
  const rememberedCookie = `session_token=${remembered.value}`;
  const otherSession = await status(api("login", { email: emails[0], password }), 200, "Second device login");
  const secondCookie = cookieOf(otherSession)!; assert(secondCookie);
  assert(!otherSession.headers.get("set-cookie")!.includes("Max-Age"));
  await status(api("login", { email: emails[0], password: "wrong-password" }), 401, "Wrong password");
  await status(api("login", { email: missingEmail, password }), 401, "Unknown account");

  await page.goto(base + "/forgot-password", { waitUntil: "networkidle", timeout: 90_000 });
  await page.getByLabel("Email", { exact: true }).fill(emails[0]);
  for (const failure of ["http", "network", "malformed"]) {
    await page.route("**/api/auth/forgot-password", (route: { fulfill(options: object): Promise<void>; abort(): Promise<void> }) => failure === "network"
      ? route.abort() : route.fulfill({ status: failure === "http" ? 503 : 200, contentType: "application/json", body: "{}" }));
    await page.getByRole("button", { name: "Send reset link", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "Couldn't request a reset link. Please try again." }).waitFor();
    assert.equal(await page.getByLabel("Email", { exact: true }).inputValue(), emails[0]);
    assert.equal(await page.getByRole("heading", { name: "Reset link on its way", exact: true }).count(), 0);
    await page.unroute("**/api/auth/forgot-password");
  }
  const forgotResponse = page.waitForResponse((r: { url(): string }) => r.url() === base + "/api/auth/forgot-password");
  await page.getByRole("button", { name: "Send reset link", exact: true }).click();
  assert.equal((await forgotResponse).status(), 200); checks++;
  await page.getByRole("heading", { name: "Reset link on its way", exact: true }).waitFor();
  const firstReset = links(emails[0], "/reset-password")[0]; assert(firstReset);
  await ageTokens("password_reset_tokens", main.user_id);
  await status(api("forgot-password", { email: emails[0] }), 200, "Second reset after cooldown");
  const secondReset = links(emails[0], "/reset-password").at(-1)!; assert.notEqual(firstReset, secondReset);
  await page.goto(secondReset, { waitUntil: "networkidle", timeout: 90_000 });
  await page.getByLabel("New password", { exact: true }).fill(replacement);
  await page.getByLabel("Confirm new password", { exact: true }).fill(replacement);
  const resetResponse = page.waitForResponse((r: { url(): string }) => r.url() === base + "/api/auth/reset-password");
  await page.getByRole("button", { name: "Update password", exact: true }).click();
  assert.equal((await resetResponse).status(), 200); checks++;
  await page.waitForURL(base + "/login?reset=1");
  await page.getByText("Your password has been updated. Sign in with your new password.", { exact: true }).waitFor();
  assert.equal(await me(rememberedCookie), null); assert.equal(await me(secondCookie), null);
  await status(api("login", { email: emails[0], password }), 401, "Old password rejected");
  await status(api("login", { email: emails[0], password: replacement }), 200, "New password works");
  await status(api("reset-password", { token: tokenOf(secondReset), password }), 400, "Reset token replay rejected");
  await status(api("reset-password", { token: tokenOf(firstReset), password: replacement }), 400, "Older reset link invalidated", true);
  if (artifacts) { await mkdir(artifacts, { recursive: true }); await page.screenshot({ path: path.join(artifacts, "auth-reset-complete.png"), fullPage: true }); }
  console.log("PASS browser logout/login/remember-me/reset; old password and pre-reset sessions invalidated.");

  const signupData = { name: "Auth acceptance", email: emails[1], phone: "9999999999", password, role: "admin", roleId: 3, emailVerified: true };
  await status(api("signup", signupData), 201, "API signup ignores privileged fields");
  const other = await user(emails[1]); assert.equal(other.role_id, 1); assert.equal(other.email_verified_at, null);
  const otherVerification = links(emails[1], "/api/auth/verify-email")[0]; assert(otherVerification);
  await ageTokens("email_verification_tokens", other.user_id, true);
  const expired = await status(fetch(otherVerification, { redirect: "manual" }), 307, "Expired verification");
  assert.equal(new URL(expired.headers.get("location")!).searchParams.get("verify"), "invalid"); assert.equal(expired.headers.get("set-cookie"), null);
  const mailCount = sink.messages.length;
  for (const route of ["resend-verification", "forgot-password"]) {
    assert.deepEqual(await (await status(api(route, { email: missingEmail }), 200, "Unknown email neutral")).json(), { ok: true });
  }
  assert.equal(sink.messages.length, mailCount);
  await Promise.all(Array.from({ length: 5 }, () => status(api("resend-verification", { email: emails[1] }), 200, "Concurrent resend neutral")));
  if (sink.messages.length !== mailCount + 1) failures.push(`Concurrent resend sent ${sink.messages.length - mailCount} emails instead of one`);
  const freshVerification = links(emails[1], "/api/auth/verify-email").at(-1)!;
  await status(api("forgot-password", { email: emails[1] }), 200, "Reset for unverified account");
  const expiredReset = links(emails[1], "/reset-password").at(-1)!;
  await ageTokens("password_reset_tokens", other.user_id, true);
  await status(api("reset-password", { token: tokenOf(expiredReset), password }), 400, "Expired reset rejected");
  await status(api("forgot-password", { email: emails[1] }), 200, "Fresh reset after expiry");
  const freshReset = links(emails[1], "/reset-password").at(-1)!;
  await status(api("reset-password", { token: tokenOf(freshReset), password: "short" }), 400, "Short password preserves token");
  const resets = await Promise.all([0, 1].map(() => api("reset-password", { token: tokenOf(freshReset), password: replacement })));
  assert.deepEqual(resets.map(r => r.status).sort(), [200, 400]); checks += 2;
  assert((await user(emails[1])).email_verified_at);
  const oldVerify = await fetch(freshVerification, { redirect: "manual" }); checks++;
  if (new URL(oldVerify.headers.get("location")!).searchParams.get("verify") !== "invalid") failures.push("Pre-reset verification link still creates a session");
  const inactiveResetStart = await api("forgot-password", { email: emails[1] }); assert.equal(inactiveResetStart.status, 200);
  // Cooldown may suppress a new link; age rows and request again deterministically.
  await ageTokens("password_reset_tokens", other.user_id);
  await status(api("forgot-password", { email: emails[1] }), 200, "Reset before suspension");
  const disabledReset = links(emails[1], "/reset-password").at(-1)!;
  await pool.query("UPDATE users SET is_active=false WHERE user_id=$1", [other.user_id]);
  await status(api("login", { email: emails[1], password: replacement }), 401, "Disabled account login blocked");
  await status(api("reset-password", { token: tokenOf(disabledReset), password }), 400, "Disabled account reset blocked", true);

  const simultaneousSignups = await Promise.all([0, 1].map(() => api("signup", { ...signupData, email: emails[2] })));
  assert.deepEqual(simultaneousSignups.map(r => r.status).sort(), [201, 409]); checks += 2;
  assert.equal(Number((await pool.query("SELECT count(*) n FROM users WHERE email=$1", [emails[2]])).rows[0].n), 1);
  // A failure after changing credentials and sessions must leave all of them,
  // including the consumed token, unchanged. Exercise real rollback, no DDL.
  const third = await user(emails[2]);
  appPool = getPool();
  const rollbackToken = await createAuthToken("password_reset", third.user_id);
  const priorSession = await createSession(third.user_id);
  await assert.rejects(redeemAuthToken("password_reset", rollbackToken, async (id, client) => {
    await setUserPassword(id, replacement, client);
    await markEmailVerified(id, client);
    await destroyAllSessionsForUser(id, client);
    await createSession(id, false, client);
    throw new Error("Injected transaction failure");
  }), /Injected transaction failure/);
  assert.equal((await user(emails[2])).password_hash, third.password_hash);
  assert.equal((await user(emails[2])).email_verified_at, null);
  assert.equal((await pool.query("SELECT consumed_at FROM password_reset_tokens WHERE token_hash=$1", [hash(rollbackToken)])).rows[0].consumed_at, null);
  const keptSessions = (await pool.query("SELECT token FROM sessions WHERE user_id=$1", [third.user_id])).rows;
  assert.equal(keptSessions.length, 1); assert.equal(keptSessions[0].token, priorSession.token);
  const siblingToken = await createAuthToken("password_reset", third.user_id);
  const siblingResets = await Promise.all([rollbackToken, siblingToken].map(token => api("reset-password", { token, password: replacement })));
  assert.deepEqual(siblingResets.map(r => r.status).sort(), [200, 400]); checks += 2;
  assert.equal(Number((await pool.query("SELECT count(*) n FROM sessions WHERE user_id=$1", [third.user_id])).rows[0].n), 0);
  console.log("PASS injected rollback preserves credentials/token/sessions; simultaneous different reset links have one winner.");
  let racePassword = replacement;
  for (let i = 0; i < 3; i++) {
    const token = await createAuthToken("password_reset", third.user_id), nextPassword = `Race!${randomUUID()}`;
    const [login1, reset, login2] = await Promise.all([
      api("login", { email: emails[2], password: racePassword }),
      api("reset-password", { token, password: nextPassword }),
      api("login", { email: emails[2], password: racePassword }),
    ]);
    assert.equal(reset.status, 200); checks += 3;
    for (const login of [login1, login2]) {
      assert([200, 401].includes(login.status));
      if (login.status === 200) assert.equal(await me(cookieOf(login)), null, "A login using the old password must not survive reset");
    }
    racePassword = nextPassword;
  }
  console.log("PASS competing logins cannot retain a session authenticated with the pre-reset password.");
  for (const route of ["signup", "login", "forgot-password", "resend-verification", "reset-password"]) {
    for (const data of [null, [], { email: 123, name: {}, phone: [], password: {} }, { email: "a".repeat(21000) }]) {
      await status(api(route, data), 400, `${route} rejects malformed/oversized fields`, true);
    }
    await status(api(route, {}, undefined, "https://outside.example"), 403, `${route} rejects foreign origin`, true);
  }
  await status(api("logout", undefined, undefined, "https://outside.example"), 403, "Logout rejects foreign origin", true);
  const expiring = cookieOf(await status(api("login", { email: emails[0], password: replacement }), 200, "Session expiry fixture"))!;
  await pool.query("UPDATE sessions SET expires_at=now()-interval '1 second' WHERE token=$1", [expiring.split("=")[1]]);
  assert.equal(await me(expiring), null); assert.equal(await me("session_token=not-a-uuid"), null);
  for (const raw of [null, "https://outside.example", "//outside.example", "/\\outside.example", "/\n/outside.example", "javascript:alert(1)"]) assert.equal(loginReturnPath(raw), "/");
  assert.equal(loginReturnPath("/profile?tab=bookings"), "/profile?tab=bookings");
  assert.deepEqual(pageErrors, []); assert.deepEqual(sink.rejected, []);
  if (failures.length) throw new Error("Auth acceptance failures:\n" + failures.join("\n"));
  console.log(`PASS ${checks} HTTP checks plus browser/DB assertions; ${sink.messages.length} emails captured locally. No external mail or production access.`);
} catch (error) {
  console.error("Recent isolated log:", redact(serverLog)); throw error;
} finally {
  try { await browser?.close(); }
  finally {
    if (child && child.exitCode === null) await new Promise<void>(resolve => {
      const timer = setTimeout(() => { child?.kill(); resolve(); }, 20_000);
      child!.once("exit", () => { clearTimeout(timer); resolve(); });
      if (child!.connected) child!.send("stop"); else child!.kill();
    });
    await sink?.close();
    try {
      const ids = (await pool.query("SELECT user_id FROM users WHERE email=ANY($1::text[])", [emails])).rows.map(row => row.user_id);
      await pool.query("DELETE FROM activity_logs WHERE user_id=ANY($1::uuid[])", [ids]);
      await pool.query("DELETE FROM users WHERE user_id=ANY($1::uuid[]) AND email=ANY($2::text[])", [ids, emails]);
      const remaining = (await pool.query(`SELECT (SELECT count(*) FROM users WHERE email=ANY($1::text[])) +
        (SELECT count(*) FROM sessions WHERE user_id=ANY($2::uuid[])) + (SELECT count(*) FROM email_verification_tokens WHERE user_id=ANY($2::uuid[])) +
        (SELECT count(*) FROM password_reset_tokens WHERE user_id=ANY($2::uuid[])) + (SELECT count(*) FROM activity_logs WHERE user_id=ANY($2::uuid[])) AS n`, [emails, ids])).rows[0];
      assert.equal(Number(remaining.n), 0);
      console.log("Synthetic accounts, sessions, tokens and audit rows removed and absence verified.");
    } finally {
      await pool.end(); await appPool?.end();
      if (sandbox) {
        const resolved = await realpath(sandbox), tempRoot = await realpath(os.tmpdir());
        assert.equal(path.dirname(resolved), tempRoot); assert(path.basename(resolved).startsWith("travel-booking-acceptance-"));
        const dependencies = path.join(resolved, "node_modules"), link = await lstat(dependencies).catch(() => null);
        if (link) { assert(link.isSymbolicLink()); assert.equal(await realpath(dependencies), await realpath("node_modules")); await unlink(dependencies); }
        await rm(resolved, { recursive: true, force: true, maxRetries: 6, retryDelay: 500 });
        console.log("Isolated server, email sink and temporary app removed; normal localhost untouched.");
      }
    }
  }
}

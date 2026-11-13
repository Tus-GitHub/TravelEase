/** Development-only real transaction checks; uses disposable synthetic accounts, no SMS or DDL. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import pg from "pg";
import { getPool } from "../../src/lib/server/db";
import { runtimeDatabaseConfig } from "../../src/lib/server/db-config";
import { hashPassword } from "../../src/lib/server/password";
import { createSession } from "../../src/lib/server/session";
import { newMobileFlow } from "../../src/lib/server/authgear";
import { finishMobileLogin, unlinkMobile, MobileAccountError } from "../../src/lib/server/mobile-login";

assert(process.argv.includes("--dev") && !process.env.VERCEL, "Development only");
assert.equal(execFileSync("git", ["-c", "safe.directory=C:/my/projects/Travel_Agent", "branch", "--show-current"], { encoding: "utf8" }).trim(), "development");
const host = (value: string) => new URL(value).hostname.replace(/-pooler\./, ".");
const owner = process.env.DATABASE_URL!, runtime = process.env.DATABASE_URL_APP!, production = process.env.DATABASE_URL_PRODUCTION!;
assert(owner && runtime && production);
assert.equal(host(owner), host(runtime)); assert.notEqual(host(owner), host(production));
// Exercise app operations with the runtime login even on the published db.ts,
// which does not include the unrelated local DATABASE_URL_APP rollout.
process.env.DATABASE_URL = runtime;
const pool = new pg.Pool({ ...runtimeDatabaseConfig(owner), max: 3 });
const ids = [randomUUID(), randomUUID()];
const emails = ids.map(id => `mobile-${id}@example.invalid`);
const identity = `test-${randomUUID()}`;
let checks = 0;
async function rejects(work: Promise<unknown>, message: string) {
  await assert.rejects(work, (error: unknown) => error instanceof MobileAccountError && error.message === message); checks++;
}
try {
  for (let i = 0; i < ids.length; i++) await pool.query(
    `INSERT INTO users(user_id,name,email,phone,password_hash,email_verified_at) VALUES($1,'Mobile auth test',$2,'9999999999',$3,now())`,
    [ids[i], emails[i], hashPassword(randomUUID())]);
  const first = await createSession(ids[0]), second = await createSession(ids[1]);
  const link = newMobileFlow("/profile", { userId: ids[0], token: first.token });
  const other = newMobileFlow("/profile", { userId: ids[1], token: second.token });
  await rejects(finishMobileLogin(identity, newMobileFlow("/")), "unlinked");
  await rejects(finishMobileLogin(identity, link, second.token), "session");
  assert.equal((await finishMobileLogin(identity, link, first.token)).linked, true); checks++;
  await rejects(finishMobileLogin(identity, other, second.token), "conflict");
  assert.equal((await pool.query("SELECT user_id FROM user_auth_providers WHERE provider='authgear' AND provider_user_id=$1", [identity])).rows[0].user_id, ids[0]); checks++;
  const signedIn = await finishMobileLogin(identity, newMobileFlow("/bookings"));
  assert.equal(signedIn.linked, false);
  assert.equal(signedIn.role, "customer");
  if (signedIn.linked) throw new Error("Expected login");
  assert.equal((await pool.query("SELECT user_id FROM sessions WHERE token=$1", [signedIn.token])).rows[0].user_id, ids[0]); checks++;
  await pool.query("UPDATE users SET is_active=false WHERE user_id=$1", [ids[0]]);
  await rejects(finishMobileLogin(identity, newMobileFlow("/")), "account");
  await pool.query("UPDATE users SET is_active=true,email_verified_at=NULL WHERE user_id=$1", [ids[0]]);
  await rejects(finishMobileLogin(identity, newMobileFlow("/")), "account");
  await pool.query("UPDATE users SET email_verified_at=now() WHERE user_id=$1", [ids[0]]);
  await pool.query("UPDATE sessions SET expires_at=now()-interval '1 second' WHERE token=$1", [first.token]);
  await rejects(finishMobileLogin(identity, link, first.token), "session");
  await pool.query("UPDATE sessions SET expires_at=now()+interval '1 hour' WHERE token=$1", [first.token]);
  const replacement = `${identity}-replacement`;
  await finishMobileLogin(replacement, link, first.token);
  await rejects(finishMobileLogin(identity, newMobileFlow("/")), "unlinked");
  assert.equal(Number((await pool.query("SELECT count(*) n FROM sessions WHERE user_id=$1", [ids[0]])).rows[0].n), 1); checks++;
  await pool.query("UPDATE users SET is_deleted=true WHERE user_id=$1", [ids[0]]);
  await rejects(finishMobileLogin(replacement, newMobileFlow("/")), "account");
  await rejects(finishMobileLogin(replacement, other, second.token), "conflict");
  await pool.query("UPDATE users SET is_deleted=false WHERE user_id=$1", [ids[0]]);
  const race = await Promise.allSettled([finishMobileLogin(replacement, newMobileFlow("/")), unlinkMobile(ids[0], first.token)]);
  assert.equal(race[1].status, "fulfilled");
  assert.equal(Number((await pool.query("SELECT count(*) n FROM sessions WHERE user_id=$1 AND token<>$2", [ids[0], first.token])).rows[0].n), 0); checks++;
  await rejects(finishMobileLogin(replacement, newMobileFlow("/")), "unlinked");
  assert.equal(await unlinkMobile(ids[0], second.token), false); checks++;
  console.log(`PASS ${checks} mobile account/session checks, including identity ownership, rollback, replacement, closed accounts and concurrent unlink/login.`);
} finally {
  try {
    await pool.query("DELETE FROM users WHERE user_id=ANY($1::uuid[]) AND email=ANY($2::text[])", [ids, emails]);
    assert.equal(Number((await pool.query(`SELECT (SELECT count(*) FROM users WHERE user_id=ANY($1::uuid[])) +
      (SELECT count(*) FROM sessions WHERE user_id=ANY($1::uuid[])) +
      (SELECT count(*) FROM user_auth_providers WHERE user_id=ANY($1::uuid[])) n`, [ids])).rows[0].n), 0);
    console.log("Synthetic mobile fixtures removed; absence verified. No production access, messages or schema changes.");
  } finally { await pool.end(); await getPool().end(); }
}

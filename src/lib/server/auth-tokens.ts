import { createHash, randomBytes } from "crypto";
import type { PoolClient } from "pg";
import { getPool } from "./db";

/**
 * Single-use, hashed, expiring tokens for email verification and password reset
 * (plan.md §24). The raw token is returned once — to embed in an email link —
 * and never stored; only its SHA-256 hex lands in the table. Redemption is
 * atomic: redemption, account changes and session changes commit together.
 * Issuance/redemption lock the owning user first, including different tokens
 * for the same account, so parallel requests cannot reuse a retired link.
 */
export type AuthTokenKind = "email_verification" | "password_reset";

// Fixed identifiers — a caller value is never interpolated into SQL.
const TABLE: Record<AuthTokenKind, string> = {
  email_verification: "email_verification_tokens",
  password_reset: "password_reset_tokens",
};

const TTL_MS: Record<AuthTokenKind, number> = {
  email_verification: 24 * 60 * 60 * 1000, // 24 hours
  password_reset: 60 * 60 * 1000, // 1 hour
};

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** Creates the initial signup token; no raw token is stored. */
export async function createAuthToken(
  kind: AuthTokenKind,
  userId: string,
): Promise<string> {
  const raw = await createAuthTokenWithCooldown(kind, userId, 0);
  if (!raw) throw new Error("Account is unavailable for email verification");
  return raw;
}

/**
 * One email per cooldown even across concurrent server instances. Counts used
 * tokens too: clicking a link must not bypass the resend limit. A transport
 * failure retains the cooldown so retries cannot flood the mailbox.
 */
export async function createAuthTokenWithCooldown(
  kind: AuthTokenKind,
  userId: string,
  withinSeconds: number,
): Promise<string | null> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const user = await client.query(`SELECT email_verified_at FROM users WHERE user_id=$1 AND is_active AND NOT is_deleted FOR UPDATE`, [userId]);
    if (!user.rows[0] || (kind === "email_verification" && user.rows[0].email_verified_at != null)) {
      await client.query("ROLLBACK"); return null;
    }
    if (withinSeconds > 0) {
      const recent = await client.query(`SELECT 1 FROM ${TABLE[kind]} WHERE user_id=$1 AND created_at > now() - ($2 * interval '1 second') LIMIT 1`, [userId, withinSeconds]);
      if (recent.rowCount) { await client.query("ROLLBACK"); return null; }
    }
    const raw = randomBytes(32).toString("hex");
    await client.query(`INSERT INTO ${TABLE[kind]} (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`, [userId, hashToken(raw), new Date(Date.now() + TTL_MS[kind])]);
    await client.query("COMMIT");
    return raw;
  } catch (error) {
    await client.query("ROLLBACK"); throw error;
  } finally { client.release(); }
}

/**
 * Reject expired/used links and unavailable accounts. The supplied effect must
 * use this client, so a failure rolls back the token as well as account changes.
 * Successful reset retires every outstanding reset/verification link; successful
 * verification retires sibling verification links so they cannot sign in again.
 */
export async function redeemAuthToken<T>(
  kind: AuthTokenKind,
  rawToken: string | null | undefined,
  apply: (userId: string, client: PoolClient) => Promise<T>,
): Promise<T | null> {
  if (typeof rawToken !== "string" || !/^[a-f0-9]{64}$/.test(rawToken)) return null;
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const tokenHash = hashToken(rawToken);
    const owner = await client.query(`SELECT u.user_id FROM users u JOIN roles r ON r.role_id=u.role_id
      JOIN ${TABLE[kind]} t ON t.user_id=u.user_id
      WHERE t.token_hash=$1 AND t.consumed_at IS NULL AND t.expires_at > now()
        AND u.is_active AND NOT u.is_deleted
        AND (r.name <> 'driver' OR EXISTS (SELECT 1 FROM drivers d WHERE d.user_id=u.user_id AND d.is_active AND NOT d.is_deleted))
      FOR UPDATE OF u`, [tokenHash]);
    const userId = owner.rows[0]?.user_id as string | undefined;
    if (!userId) { await client.query("ROLLBACK"); return null; }
    // Recheck after acquiring the user lock: a sibling redemption may have
    // retired this token while this transaction was waiting for that lock.
    const consumed = await client.query(`UPDATE ${TABLE[kind]} SET consumed_at=now()
      WHERE token_hash=$1 AND user_id=$2 AND consumed_at IS NULL AND expires_at > clock_timestamp() RETURNING user_id`, [tokenHash, userId]);
    if (!consumed.rowCount) { await client.query("ROLLBACK"); return null; }
    const result = await apply(userId, client);
    await client.query(`UPDATE ${TABLE[kind]} SET consumed_at=now() WHERE user_id=$1 AND consumed_at IS NULL`, [userId]);
    if (kind === "password_reset") await client.query("UPDATE email_verification_tokens SET consumed_at=now() WHERE user_id=$1 AND consumed_at IS NULL", [userId]);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK"); throw error;
  } finally { client.release(); }
}

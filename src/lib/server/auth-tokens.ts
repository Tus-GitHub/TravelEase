import { createHash, randomBytes } from "crypto";
import { getPool } from "./db";

/**
 * Single-use, hashed, expiring tokens for email verification and password reset
 * (plan.md §24). The raw token is returned once — to embed in an email link —
 * and never stored; only its SHA-256 hex lands in the table. Redemption is
 * atomic: `consumeAuthToken` flips `consumed_at` in the same statement that
 * checks it, so a link works exactly once even under concurrent clicks.
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

/** Creates a token row and returns the raw token to put in a link. */
export async function createAuthToken(
  kind: AuthTokenKind,
  userId: string,
): Promise<string> {
  const raw = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + TTL_MS[kind]);
  await getPool().query(
    `INSERT INTO ${TABLE[kind]} (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
    [userId, hashToken(raw), expiresAt],
  );
  return raw;
}

/**
 * Atomically redeems a token. Returns the owning user id, or null when the token
 * is unknown, already used, or expired.
 */
export async function consumeAuthToken(
  kind: AuthTokenKind,
  rawToken: string | null | undefined,
): Promise<{ userId: string } | null> {
  if (!rawToken) return null;
  const result = await getPool().query(
    `UPDATE ${TABLE[kind]}
        SET consumed_at = now()
      WHERE token_hash = $1 AND consumed_at IS NULL AND expires_at > now()
      RETURNING user_id`,
    [hashToken(rawToken)],
  );
  return result.rows[0] ? { userId: result.rows[0].user_id } : null;
}

/**
 * True when an unconsumed, unexpired token for this user was created within the
 * last `withinSeconds` — used to throttle resend / forgot-password requests.
 */
export async function hasRecentToken(
  kind: AuthTokenKind,
  userId: string,
  withinSeconds: number,
): Promise<boolean> {
  const result = await getPool().query(
    `SELECT 1 FROM ${TABLE[kind]}
      WHERE user_id = $1
        AND consumed_at IS NULL
        AND created_at > now() - ($2 || ' seconds')::interval
      LIMIT 1`,
    [userId, String(withinSeconds)],
  );
  return (result.rowCount ?? 0) > 0;
}

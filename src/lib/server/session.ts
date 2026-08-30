import { randomUUID } from "crypto";
import { getPool } from "./db";

export const SESSION_COOKIE = "session_token";

// Plain sessions expire quickly server-side; "remember me" sessions get a
// long-lived cookie too. Without "remember me" the cookie itself is a
// browser-session cookie (no Max-Age), so it disappears when the browser closes.
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 1 day
const REMEMBERED_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export async function createSession(
  userId: string,
  remember = false,
): Promise<{ token: string; maxAge: number | undefined }> {
  const ttl = remember ? REMEMBERED_SESSION_TTL_MS : SESSION_TTL_MS;
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + ttl);

  const pool = getPool();
  await pool.query("INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)", [
    token,
    userId,
    expiresAt,
  ]);

  return { token, maxAge: remember ? ttl / 1000 : undefined };
}

const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getUserIdForToken(token: string | undefined): Promise<string | null> {
  if (!token || !GUID_RE.test(token)) return null;

  const pool = getPool();
  const result = await pool.query("SELECT user_id, expires_at FROM sessions WHERE token = $1", [
    token,
  ]);

  const session = result.rows[0];
  if (!session) return null;

  if (new Date(session.expires_at).getTime() < Date.now()) {
    await destroySession(token);
    return null;
  }

  return session.user_id;
}

export async function destroySession(token: string | undefined): Promise<void> {
  if (!token || !GUID_RE.test(token)) return;
  const pool = getPool();
  await pool.query("DELETE FROM sessions WHERE token = $1", [token]);
}

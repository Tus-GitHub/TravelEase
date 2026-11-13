import { getPool } from "./db";
import { createSession } from "./session";
import { sessionHash, type MobileFlow } from "./authgear";

export class MobileAccountError extends Error {}

/** Local roles, active status and sessions remain authoritative; profile phones are never matched. */
export async function finishMobileLogin(identity: string, flow: MobileFlow, currentToken?: string) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    let userId: string;
    if (flow.userId) {
      if (!currentToken || flow.sessionHash !== sessionHash(currentToken)) throw new MobileAccountError("session");
      userId = flow.userId;
    } else {
      const link = await client.query(
        "SELECT user_id FROM user_auth_providers WHERE provider = 'authgear' AND provider_user_id = $1", [identity]);
      if (!link.rows[0]) throw new MobileAccountError("unlinked");
      userId = link.rows[0].user_id;
    }
    // Same user lock as password login/reset; don't create a session for disabled/deleted staff.
    const user = await client.query(
      `SELECT u.user_id, r.name AS role FROM users u JOIN roles r ON r.role_id = u.role_id
       WHERE u.user_id = $1 AND u.is_active AND NOT u.is_deleted AND u.email_verified_at IS NOT NULL
       AND (r.name <> 'driver' OR EXISTS (SELECT 1 FROM drivers d WHERE d.user_id=u.user_id AND d.is_active AND NOT d.is_deleted))
       FOR UPDATE OF u`, [userId]);
    if (!user.rows[0]) throw new MobileAccountError("account");
    if (flow.userId) {
      const session = await client.query(
        "SELECT 1 FROM sessions WHERE token=$1 AND user_id=$2 AND expires_at > now()", [currentToken, userId]);
      if (!session.rows[0]) throw new MobileAccountError("session");
      // Conflict never repoints a different owner's identity, even for a closed account.
      const linked = await client.query(
        `INSERT INTO user_auth_providers (user_id, provider, provider_user_id)
         VALUES ($1, 'authgear', $2) ON CONFLICT (provider, provider_user_id)
         DO UPDATE SET email = NULL WHERE user_auth_providers.user_id = EXCLUDED.user_id RETURNING user_id`,
        [userId, identity]);
      if (!linked.rows[0]) throw new MobileAccountError("conflict");
      await client.query("DELETE FROM user_auth_providers WHERE user_id=$1 AND provider='authgear' AND provider_user_id<>$2", [userId, identity]);
      await client.query("DELETE FROM sessions WHERE user_id=$1 AND token<>$2", [userId, currentToken]);
      await client.query("COMMIT");
      return { linked: true as const, userId, role: user.rows[0].role as string };
    }
    // Recheck after acquiring the user lock; unlink/relink also acquires this lock.
    const link = await client.query(
      "SELECT 1 FROM user_auth_providers WHERE user_id=$1 AND provider='authgear' AND provider_user_id=$2", [userId, identity]);
    if (!link.rows[0]) throw new MobileAccountError("unlinked");
    const session = await createSession(userId, false, client);
    await client.query("COMMIT");
    return { linked: false as const, userId, role: user.rows[0].role as string, ...session };
  } catch (error) {
    await client.query("ROLLBACK"); throw error;
  } finally { client.release(); }
}

export async function unlinkMobile(userId: string, token: string): Promise<boolean> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const user = await client.query("SELECT 1 FROM users WHERE user_id=$1 AND is_active AND NOT is_deleted FOR UPDATE", [userId]);
    const session = await client.query("SELECT 1 FROM sessions WHERE token=$1 AND user_id=$2 AND expires_at>now()", [token, userId]);
    if (!user.rows[0] || !session.rows[0]) { await client.query("ROLLBACK"); return false; }
    await client.query("DELETE FROM user_auth_providers WHERE user_id=$1 AND provider='authgear'", [userId]);
    // Revoke other sessions, including any issued through this mobile identity.
    await client.query("DELETE FROM sessions WHERE user_id=$1 AND token<>$2", [userId, token]);
    await client.query("COMMIT"); return true;
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}

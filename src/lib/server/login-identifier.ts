import type { PoolClient } from "pg";
import { isContactMailbox } from "../contact";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
interface LoginConfig { identifier: string; userId: string; recoveryEmail?: unknown }
async function loginConfig(db: Pick<PoolClient, "query">): Promise<LoginConfig | null> {
  const { rows } = await db.query("SELECT setting_value FROM site_settings WHERE setting_key='admin_login_alias'");
  try {
    const value = JSON.parse(rows[0]?.setting_value ?? "null");
    return value && typeof value.identifier === "string" && isContactMailbox(value.identifier) &&
      typeof value.userId === "string" && UUID.test(value.userId) ? value : null;
  } catch { return null; }
}

/** App-only identifiers cannot receive recovery, booking or support email.
 * Resolve the actual recipient under the event's transaction before freezing it.
 */
export async function accountMailbox(db: Pick<PoolClient, "query">, userId: string, email: string): Promise<string | null> {
  const config = await loginConfig(db);
  if (!config || config.identifier.toLowerCase() !== email.toLowerCase()) return email;
  if (config.userId !== userId || typeof config.recoveryEmail !== "string" || !isContactMailbox(config.recoveryEmail) ||
      config.recoveryEmail.toLowerCase() === config.identifier.toLowerCase()) return null;
  return config.recoveryEmail;
}

/** An operator-managed login label, never an email recipient or OAuth identity.
 * Uses the existing settings store; passwords, roles and sessions remain on users.
 */
export async function resolveLoginIdentifier(db: Pick<PoolClient, "query">, input: string): Promise<{
  email: string | null;
  aliasUserId: string | null;
}> {
  const email = input.trim().toLowerCase();
  const config = await loginConfig(db);
  if (!config || config.identifier.toLowerCase() !== email) {
    return { email, aliasUserId: null };
  }
  const target = await db.query(
    `SELECT u.email FROM users u JOIN roles r ON r.role_id=u.role_id
     WHERE u.user_id=$1 AND r.name='admin' AND u.is_active AND NOT u.is_deleted
       AND u.email_verified_at IS NOT NULL`, [config.userId],
  );
  const address = target.rows[0]?.email;
  return { email: typeof address === "string" && isContactMailbox(address) ? address : null, aliasUserId: config.userId };
}

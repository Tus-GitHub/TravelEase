import { getPool } from "./db";

/**
 * External auth identities linked to a Jagdamba Travellers user (plan.md §22). A thin
 * layer over `user_auth_providers`; the actual user row still comes from
 * `users.ts`. Jagdamba Travellers owns the User / Role / Session — a provider only
 * proves "this person controls that Google account".
 */
export type AuthProvider = "google";

/**
 * Returns the linked user's id, or null if this provider identity is unknown —
 * or points at a soft-deleted account (a closed account must not be reachable
 * again through its old Google link).
 */
export async function findUserIdByProvider(
  provider: AuthProvider,
  providerUserId: string,
): Promise<string | null> {
  const result = await getPool().query(
    `SELECT p.user_id
       FROM user_auth_providers p
       JOIN users u ON u.user_id = p.user_id
      WHERE p.provider = $1 AND p.provider_user_id = $2 AND u.is_deleted = false`,
    [provider, providerUserId],
  );
  return result.rows[0]?.user_id ?? null;
}

/**
 * Links a provider identity to a user. Reaching here means the provider already
 * proved control of `providerUserId` (a completed OAuth round trip), so on
 * conflict we re-point the link to the resolved user rather than no-op — this
 * self-heals a stale row left behind by a closed-and-recreated account.
 */
export async function linkProvider(
  userId: string,
  provider: AuthProvider,
  providerUserId: string,
  email: string | null,
): Promise<void> {
  await getPool().query(
    `INSERT INTO user_auth_providers (user_id, provider, provider_user_id, email)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (provider, provider_user_id)
     DO UPDATE SET user_id = EXCLUDED.user_id, email = EXCLUDED.email`,
    [userId, provider, providerUserId, email],
  );
}

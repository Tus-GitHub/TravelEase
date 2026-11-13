import type { PoolClient } from "pg";
import { getPool } from "./db";

export class AccountUnavailableError extends Error {
  constructor() {
    super("Account is no longer available.");
    this.name = "AccountUnavailableError";
  }
}

/** All personal-data writers lock the account before touching its child rows.
 * Deletion takes the same lock, then removes children using fresh snapshots.
 * A supplied client must already be inside the caller's transaction. */
export async function withActiveAccount<T>(
  userId: string,
  work: (client: PoolClient) => Promise<T>,
  existingClient?: PoolClient,
): Promise<T> {
  const client = existingClient ?? await getPool().connect();
  try {
    if (!existingClient) await client.query("BEGIN");
    const account = await client.query(
      "SELECT user_id FROM users WHERE user_id=$1 AND is_active AND NOT is_deleted FOR UPDATE",
      [userId],
    );
    if (!account.rowCount) throw new AccountUnavailableError();
    const result = await work(client);
    if (!existingClient) await client.query("COMMIT");
    return result;
  } catch (error) {
    if (!existingClient) await client.query("ROLLBACK");
    throw error;
  } finally {
    if (!existingClient) client.release();
  }
}

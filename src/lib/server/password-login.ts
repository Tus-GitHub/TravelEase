import { getPool } from "./db";
import { verifyCredentials, type PublicUser } from "./users";
import { createSession } from "./session";
import { resolveLoginIdentifier } from "./login-identifier";

/** Password validation and session issuance serialize with password reset. */
export async function passwordLogin(email: string, password: string, remember: boolean): Promise<
  | { ok: true; user: PublicUser; token: string; maxAge: number | undefined }
  | { ok: false; reason: "invalid" | "unverified" }
> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    // Supplying a transaction locks this user before checking the hash. If a
    // reset wins first, we read its new hash; if login wins, reset deletes this
    // session when it subsequently acquires the same lock.
    const identifier = await resolveLoginIdentifier(client, email);
    const user = identifier.email ? await verifyCredentials(identifier.email, password, client) : null;
    // Recheck binding/role after verifyCredentials acquired the account lock.
    // A demotion or reassignment cannot turn an alias into another account.
    if (identifier.aliasUserId && (user?.id !== identifier.aliasUserId || user.role !== "admin")) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "invalid" };
    }
    if (!user || !user.emailVerified) {
      await client.query("ROLLBACK");
      return { ok: false, reason: user ? "unverified" : "invalid" };
    }
    const session = await createSession(user.id, remember, client);
    await client.query("COMMIT");
    return { ok: true, user, ...session };
  } catch (error) {
    await client.query("ROLLBACK"); throw error;
  } finally { client.release(); }
}

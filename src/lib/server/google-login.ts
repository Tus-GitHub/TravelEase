import { randomBytes } from "crypto";
import { getPool } from "./db";
import { AccountUnavailableError } from "./account-write";
import { createFederatedUser, findUserByEmail, findUserById, markEmailVerified, setUserPassword } from "./users";
import { linkProvider } from "./auth-providers";
import { createSession, destroyAllSessionsForUser } from "./session";

/** Called only after the callback validates Google's verified identity.
 * Resolve collisions, secure an unverified signup, link and issue the session
 * in one transaction, serialized with account deletion and token redemption. */
export async function finishGoogleLogin(subject: string, email: string, name: string) {
  email = email.trim().toLowerCase();
  if (!subject || subject.length > 255 || !email || email.length > 320) {
    throw new Error("Invalid Google identity.");
  }
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    // There may not be a provider row yet. Serialize callbacks for this subject
    // without inventing a second account/identity system or a new table.
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`google:${subject}`]);
    const linked = (await client.query(
      `SELECT p.user_id, u.is_deleted FROM user_auth_providers p
       JOIN users u ON u.user_id=p.user_id
       WHERE p.provider='google' AND p.provider_user_id=$1`, [subject],
    )).rows[0];

    let user;
    if (linked && !linked.is_deleted) {
      // A disabled/deleted-while-waiting linked account cannot fall through to
      // email matching and accidentally acquire a fresh session.
      user = await findUserById(linked.user_id, client);
    } else {
      user = await findUserByEmail(email, client);
      if (!user) {
        await createFederatedUser(name.trim().slice(0, 200), email, client);
        // ON CONFLICT waits for a concurrent signup without aborting this
        // transaction. Every winner takes the same security checks below.
        user = await findUserByEmail(email, client);
      }
    }
    if (!user) throw new AccountUnavailableError();
    if (user.email_verified_at == null) {
      if (user.email !== email) throw new AccountUnavailableError();
      await setUserPassword(user.user_id, randomBytes(32).toString("hex"), client);
      await markEmailVerified(user.user_id, client);
      // A pre-registrant must not retain an old credential, login session or
      // emailed token after Google proves control of this unverified email.
      await destroyAllSessionsForUser(user.user_id, client);
      await client.query("DELETE FROM password_reset_tokens WHERE user_id=$1", [user.user_id]);
      await client.query("DELETE FROM email_verification_tokens WHERE user_id=$1", [user.user_id]);
    }
    await linkProvider(user.user_id, "google", subject, email, client);
    const session = await createSession(user.user_id, true, client);
    await client.query("COMMIT");
    return session;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

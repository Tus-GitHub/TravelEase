import { randomBytes } from "crypto";
import { getPool } from "./db";
import { hashPassword, verifyPassword } from "./password";

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  emailVerified: boolean;
  createdAt: string;
}

interface UserRow {
  user_id: string;
  name: string;
  email: string;
  phone: string;
  password_hash: string;
  role: string;
  email_verified_at: Date | null;
  created_at: Date;
}

const USER_SELECT = `
  SELECT u.user_id, u.name, u.email, u.phone, u.password_hash, u.created_at,
         u.email_verified_at, r.name AS role
  FROM users u
  JOIN roles r ON r.role_id = u.role_id
`;

function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.user_id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    emailVerified: row.email_verified_at != null,
    createdAt: row.created_at.toISOString(),
  };
}

export async function findUserByEmail(email: string): Promise<UserRow | undefined> {
  const pool = getPool();
  const result = await pool.query(
    `${USER_SELECT} WHERE u.email = $1 AND u.is_deleted = false`,
    [email.trim().toLowerCase()],
  );
  return result.rows[0];
}

export async function findUserById(id: string): Promise<UserRow | undefined> {
  const pool = getPool();
  const result = await pool.query(
    `${USER_SELECT} WHERE u.user_id = $1 AND u.is_deleted = false`,
    [id],
  );
  return result.rows[0];
}

// New accounts always land on the default 'customer' role (role_id 1) — signup
// intentionally has no way to self-assign 'agent'/'admin'; that's a separate,
// privileged operation to add later.
export async function createUser(
  name: string,
  email: string,
  phone: string,
  password: string,
): Promise<PublicUser> {
  const pool = getPool();
  const result = await pool.query(
    `INSERT INTO users (name, email, phone, password_hash)
     VALUES ($1, $2, $3, $4)
     RETURNING user_id, name, email, phone, created_at`,
    [name.trim(), email.trim().toLowerCase(), phone.trim(), hashPassword(password)],
  );
  const row = result.rows[0];
  return {
    id: row.user_id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: "customer",
    // Email/password signups start unverified; login is gated until they click
    // the verification link (plan.md §24).
    emailVerified: false,
    createdAt: row.created_at.toISOString(),
  };
}

/**
 * Creates a user from a federated identity (Google, plan.md §21). No password is
 * chosen by the user, so `password_hash` is a random unusable value — they can
 * set a real one later via "forgot password". The provider already asserted the
 * email, so it lands verified. Always role 'customer' — OAuth can never mint an
 * agent/admin. The caller links the provider row (see `auth-providers.ts`).
 */
export async function createFederatedUser(
  name: string,
  email: string,
): Promise<PublicUser> {
  const pool = getPool();
  const result = await pool.query(
    `INSERT INTO users (name, email, phone, password_hash, email_verified_at)
     VALUES ($1, $2, '', $3, now())
     RETURNING user_id, name, email, phone, created_at`,
    [
      name.trim() || "Traveller",
      email.trim().toLowerCase(),
      hashPassword(randomBytes(24).toString("hex")),
    ],
  );
  const row = result.rows[0];
  return {
    id: row.user_id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: "customer",
    emailVerified: true,
    createdAt: row.created_at.toISOString(),
  };
}

/** Marks the account's email confirmed. No-op if it was already verified. */
export async function markEmailVerified(userId: string): Promise<void> {
  const pool = getPool();
  await pool.query(
    `UPDATE users SET email_verified_at = now()
     WHERE user_id = $1 AND email_verified_at IS NULL`,
    [userId],
  );
}

/** Overwrites the password hash (password-reset flow). Caller proves ownership. */
export async function setUserPassword(userId: string, password: string): Promise<void> {
  const pool = getPool();
  await pool.query(`UPDATE users SET password_hash = $1 WHERE user_id = $2`, [
    hashPassword(password),
    userId,
  ]);
}

// Self-service profile edit: name/phone only. Email is the login identity and
// role is privileged — neither is touched here. `updated_at` is maintained by a
// DB trigger. Caller must already be the authenticated owner of `userId`.
export async function updateUser(
  userId: string,
  name: string,
  phone: string,
): Promise<PublicUser | null> {
  const pool = getPool();
  await pool.query(`UPDATE users SET name = $1, phone = $2 WHERE user_id = $3`, [
    name.trim(),
    phone.trim(),
    userId,
  ]);
  const row = await findUserById(userId);
  return row ? toPublicUser(row) : null;
}

export async function verifyCredentials(
  email: string,
  password: string,
): Promise<PublicUser | null> {
  const user = await findUserByEmail(email);
  if (!user || !verifyPassword(password, user.password_hash)) return null;
  return toPublicUser(user);
}

/**
 * Irreversible self-service account deletion. One atomic statement:
 *   - drops the customer_profiles row (address, map pin, preferred tags — gone);
 *   - drops every session (signed out everywhere);
 *   - drops any outstanding email-verification / password-reset tokens;
 *   - soft-deletes the users row, scrubs the PII, and frees the email address so
 *     it can be registered again as a brand-new account.
 * `password_hash` is set to a value `verifyPassword()` can never match, so the
 * dead row can't authenticate even if an `is_deleted` filter is ever missed.
 * Returns false when there was no live account with that id.
 */
export async function deleteAccount(userId: string): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query(
    `WITH drop_profile AS (
       DELETE FROM customer_profiles WHERE user_id = $1
     ),
     drop_sessions AS (
       DELETE FROM sessions WHERE user_id = $1
     ),
     drop_verify AS (
       DELETE FROM email_verification_tokens WHERE user_id = $1
     ),
     drop_reset AS (
       DELETE FROM password_reset_tokens WHERE user_id = $1
     )
     UPDATE users SET
       is_deleted    = true,
       is_active     = false,
       name          = 'Deleted account',
       phone         = '',
       email         = 'deleted+' || user_id::text || '@deleted.invalid',
       password_hash = 'deleted'
     WHERE user_id = $1 AND is_deleted = false
     RETURNING user_id`,
    [userId],
  );
  return (result.rowCount ?? 0) > 0;
}

export { toPublicUser };
export type { UserRow };

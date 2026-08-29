import { getPool } from "./db-pg";
import { hashPassword, verifyPassword } from "./password";

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  createdAt: string;
}

interface UserRow {
  user_id: string;
  name: string;
  email: string;
  phone: string;
  password_hash: string;
  role: string;
  created_at: Date;
}

const USER_SELECT = `
  SELECT u.user_id, u.name, u.email, u.phone, u.password_hash, u.created_at, r.name AS role
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
    createdAt: row.created_at.toISOString(),
  };
}

export async function findUserByEmail(email: string): Promise<UserRow | undefined> {
  const pool = getPool();
  const result = await pool.query(`${USER_SELECT} WHERE u.email = $1`, [
    email.trim().toLowerCase(),
  ]);
  return result.rows[0];
}

export async function findUserById(id: string): Promise<UserRow | undefined> {
  const pool = getPool();
  const result = await pool.query(`${USER_SELECT} WHERE u.user_id = $1`, [id]);
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
    createdAt: row.created_at.toISOString(),
  };
}

export async function verifyCredentials(
  email: string,
  password: string,
): Promise<PublicUser | null> {
  const user = await findUserByEmail(email);
  if (!user || !verifyPassword(password, user.password_hash)) return null;
  return toPublicUser(user);
}

export { toPublicUser };
export type { UserRow };

import { getPool } from "../db";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  createdAt: string;
}

const ROLE_NAMES = ["customer", "agent", "admin"] as const;
export type RoleName = (typeof ROLE_NAMES)[number];

export function isRoleName(value: string): value is RoleName {
  return (ROLE_NAMES as readonly string[]).includes(value);
}

const SELECT = `
  SELECT u.user_id, u.name, u.email, u.phone, u.created_at, ro.name AS role
  FROM users u
  JOIN roles ro ON ro.role_id = u.role_id
`;

function toAdminUser(row: {
  user_id: string;
  name: string;
  email: string;
  phone: string;
  created_at: Date;
  role: string;
}): AdminUser {
  return {
    id: row.user_id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    createdAt: row.created_at.toISOString(),
  };
}

export async function listUsers(): Promise<AdminUser[]> {
  const pool = getPool();
  const result = await pool.query(`${SELECT} ORDER BY u.created_at DESC`);
  return result.rows.map(toAdminUser);
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function setUserRole(
  userId: string,
  role: RoleName,
): Promise<AdminUser | null> {
  // A non-UUID id can't match any row; bail before Postgres rejects the cast
  // (22P02) and turns a plain "not found" into a 500.
  if (!UUID_RE.test(userId)) return null;

  const pool = getPool();
  const updated = await pool.query(
    `UPDATE users
     SET role_id = (SELECT role_id FROM roles WHERE name = $1)
     WHERE user_id = $2
     RETURNING user_id`,
    [role, userId],
  );
  if (!updated.rows[0]) return null;

  const result = await pool.query(`${SELECT} WHERE u.user_id = $1`, [userId]);
  return result.rows[0] ? toAdminUser(result.rows[0]) : null;
}

import { getPool, sql } from "./db";
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
  UserId: string;
  Name: string;
  Email: string;
  Phone: string;
  PasswordHash: string;
  Role: string;
  CreatedAt: Date;
}

const USER_SELECT = `
  SELECT u.UserId, u.Name, u.Email, u.Phone, u.PasswordHash, u.CreatedAt, r.Name AS Role
  FROM dbo.Users u
  JOIN dbo.Roles r ON r.RoleId = u.RoleId
`;

function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.UserId,
    name: row.Name,
    email: row.Email,
    phone: row.Phone,
    role: row.Role,
    createdAt: row.CreatedAt.toISOString(),
  };
}

export async function findUserByEmail(email: string): Promise<UserRow | undefined> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("email", sql.NVarChar, email.trim().toLowerCase())
    .query(`${USER_SELECT} WHERE u.Email = @email`);
  return result.recordset[0];
}

export async function findUserById(id: string): Promise<UserRow | undefined> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("id", sql.UniqueIdentifier, id)
    .query(`${USER_SELECT} WHERE u.UserId = @id`);
  return result.recordset[0];
}

// New accounts always land on the default 'customer' role (RoleId 1) — signup
// intentionally has no way to self-assign 'agent'/'admin'; that's a separate,
// privileged operation to add later.
export async function createUser(
  name: string,
  email: string,
  phone: string,
  password: string,
): Promise<PublicUser> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("name", sql.NVarChar, name.trim())
    .input("email", sql.NVarChar, email.trim().toLowerCase())
    .input("phone", sql.NVarChar, phone.trim())
    .input("passwordHash", sql.NVarChar, hashPassword(password))
    .query(`
      INSERT INTO dbo.Users (Name, Email, Phone, PasswordHash)
      OUTPUT INSERTED.UserId, INSERTED.Name, INSERTED.Email, INSERTED.Phone, INSERTED.PasswordHash, INSERTED.CreatedAt
      VALUES (@name, @email, @phone, @passwordHash)
    `);
  const row = result.recordset[0];
  return {
    id: row.UserId,
    name: row.Name,
    email: row.Email,
    phone: row.Phone,
    role: "customer",
    createdAt: row.CreatedAt.toISOString(),
  };
}

export async function verifyCredentials(
  email: string,
  password: string,
): Promise<PublicUser | null> {
  const user = await findUserByEmail(email);
  if (!user || !verifyPassword(password, user.PasswordHash)) return null;
  return toPublicUser(user);
}

export { toPublicUser };
export type { UserRow };

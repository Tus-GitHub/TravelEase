import { getPool } from "../db";

export type PermissionRole = "agent" | "customer";
export type AdminSection =
  | "users"
  | "vehicles"
  | "geography"
  | "packages"
  | "bookings"
  | "coupons"
  | "reviews"
  | "seasonal";

export const PERMISSION_ROLES: PermissionRole[] = ["agent", "customer"];
export const ADMIN_SECTIONS: AdminSection[] = [
  "users",
  "vehicles",
  "geography",
  "packages",
  "bookings",
  "coupons",
  "reviews",
  "seasonal",
];

export type PermissionMatrix = Record<PermissionRole, Record<AdminSection, boolean>>;

export function isPermissionRole(value: string): value is PermissionRole {
  return value === "agent" || value === "customer";
}

export function isAdminSection(value: string): value is AdminSection {
  return (ADMIN_SECTIONS as string[]).includes(value);
}

function emptyMatrix(): PermissionMatrix {
  const off = {
    users: false,
    vehicles: false,
    geography: false,
    packages: false,
    bookings: false,
    coupons: false,
    reviews: false,
    seasonal: false,
  };
  return { agent: { ...off }, customer: { ...off } };
}

export async function getPermissionMatrix(): Promise<PermissionMatrix> {
  const result = await getPool().query(`
    SELECT ro.name AS role, rp.section, rp.is_allowed
    FROM role_permissions rp
    JOIN roles ro ON ro.role_id = rp.role_id
    WHERE ro.name IN ('agent', 'customer')
  `);
  const matrix = emptyMatrix();
  for (const row of result.rows) {
    const role = String(row.role);
    const section = String(row.section);
    if (isPermissionRole(role) && isAdminSection(section)) {
      matrix[role][section] = Boolean(row.is_allowed);
    }
  }
  return matrix;
}

export async function setPermission(
  role: PermissionRole,
  section: AdminSection,
  isAllowed: boolean,
  actorId: string,
): Promise<PermissionMatrix> {
  await getPool().query(
    `INSERT INTO role_permissions (role_id, section, is_allowed, updated_by)
     VALUES ((SELECT role_id FROM roles WHERE name = $1), $2, $3, $4)
     ON CONFLICT (role_id, section)
     DO UPDATE SET is_allowed = EXCLUDED.is_allowed, updated_by = EXCLUDED.updated_by`,
    [role, section, isAllowed, actorId],
  );
  return getPermissionMatrix();
}

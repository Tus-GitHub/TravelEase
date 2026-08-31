import { getPool } from "../db";

export interface AdminOverview {
  counts: {
    users: number;
    vehicles: number;
    vehicleTypes: number;
    packages: number;
    regions: number;
    newSignups7d: number;
  };
  recentSignups: {
    id: string;
    name: string;
    email: string;
    role: string;
    createdAt: string;
  }[];
}

export async function getOverview(): Promise<AdminOverview> {
  const pool = getPool();
  const [counts, recent] = await Promise.all([
    pool.query(`
      SELECT
        (SELECT count(*) FROM users)                                              AS users,
        (SELECT count(*) FROM vehicles       WHERE is_deleted = false)            AS vehicles,
        (SELECT count(*) FROM vehicle_types  WHERE is_deleted = false)            AS vehicle_types,
        (SELECT count(*) FROM packages       WHERE is_deleted = false)            AS packages,
        (SELECT count(*) FROM regions        WHERE is_deleted = false)            AS regions,
        (SELECT count(*) FROM users WHERE created_at > now() - interval '7 days') AS new_signups_7d
    `),
    pool.query(`
      SELECT u.user_id, u.name, u.email, u.created_at, ro.name AS role
      FROM users u JOIN roles ro ON ro.role_id = u.role_id
      ORDER BY u.created_at DESC
      LIMIT 5
    `),
  ]);

  const c = counts.rows[0];
  return {
    counts: {
      users: Number(c.users),
      vehicles: Number(c.vehicles),
      vehicleTypes: Number(c.vehicle_types),
      packages: Number(c.packages),
      regions: Number(c.regions),
      newSignups7d: Number(c.new_signups_7d),
    },
    recentSignups: recent.rows.map((r) => ({
      id: r.user_id,
      name: r.name,
      email: r.email,
      role: r.role,
      createdAt: r.created_at.toISOString(),
    })),
  };
}

import { Pool } from "pg";

// Kept on `globalThis` so the pool survives Next.js dev-mode module reloads
// (Fast Refresh) instead of opening a fresh pool on every edit.
const globalForDb = globalThis as unknown as { __pgPool?: Pool };

export function getPool(): Pool {
  if (!globalForDb.__pgPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set");
    }
    globalForDb.__pgPool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
    });
  }
  return globalForDb.__pgPool;
}

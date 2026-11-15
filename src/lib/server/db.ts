import { Pool } from "pg";
import { attachDatabasePool } from "@vercel/functions/db-connections";
import { runtimeDatabaseConfig } from "./db-config";

// Kept on `globalThis` so the pool survives Next.js dev-mode module reloads
// (Fast Refresh) instead of opening a fresh pool on every edit.
const globalForDb = globalThis as unknown as { __pgPool?: Pool };

export function getPool(): Pool {
  if (!globalForDb.__pgPool) {
    const connectionString = process.env.DATABASE_URL_APP || process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set");
    }
    // DATABASE_URL_APP is the restricted runtime login; DATABASE_URL remains
    // the migration connection. Older environments retain their existing URL
    // until a separately authorised credential rollout.
    globalForDb.__pgPool = new Pool(runtimeDatabaseConfig(connectionString));
    // Fluid can freeze timers between invocations. Let Vercel close idle
    // sockets before suspension rather than reusing dead sockets on resume.
    if (process.env.VERCEL === "1") attachDatabasePool(globalForDb.__pgPool);
    globalForDb.__pgPool.on("error", (error: Error & { code?: string }) => {
      // Do not log messages/configuration: server errors can contain private data.
      const code = /^[A-Z0-9_]{2,32}$/.test(error.code ?? "") ? error.code : "UNKNOWN";
      console.error("Database idle connection error", { code });
    });
  }
  return globalForDb.__pgPool;
}

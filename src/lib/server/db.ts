import sql from "mssql/msnodesqlv8";

// Kept on `globalThis` so the pool survives Next.js dev-mode module reloads
// (Fast Refresh) instead of opening a fresh connection pool on every edit.
const globalForDb = globalThis as unknown as { __sqlPool?: Promise<sql.ConnectionPool> };

function createPool(): Promise<sql.ConnectionPool> {
  const server = process.env.DB_SERVER ?? "localhost";
  const database = process.env.DB_NAME ?? "TravelAgentDB";

  const pool = new sql.ConnectionPool({
    connectionString: `Driver={ODBC Driver 17 for SQL Server};Server=${server};Database=${database};Trusted_Connection=Yes;`,
  } as unknown as sql.config);

  return pool.connect();
}

export function getPool(): Promise<sql.ConnectionPool> {
  return (globalForDb.__sqlPool ??= createPool());
}

export { sql };

/** Explicit TLS verification and bounded waits for web requests. Maintenance
 * tools keep their own connection settings and owner credentials. */
export function runtimeDatabaseConfig(connectionString: string) {
  let url: URL;
  try {
    url = new URL(connectionString);
    if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname) throw new Error();
  } catch {
    throw new Error("Invalid database connection configuration.");
  }
  // pg connection-string SSL settings override the ssl object. Make the URL
  // explicit too, including across future pg SSL compatibility changes.
  url.searchParams.delete("ssl");
  url.searchParams.delete("uselibpqcompat");
  url.searchParams.set("sslmode", "verify-full");
  return {
    connectionString: url.toString(),
    ssl: { rejectUnauthorized: true },
    max: 3,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 10_000,
    statement_timeout: 15_000,
    lock_timeout: 5_000,
    idle_in_transaction_session_timeout: 15_000,
    application_name: "travelease-web",
  };
}

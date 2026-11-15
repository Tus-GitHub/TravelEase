// Only the two public CMS SELECTs use this recovery path. Never replay a
// booking, password change, payment, or any transaction after an uncertain error.
const CONNECTION_CODES = new Set(["ECONNRESET", "EPIPE", "ETIMEDOUT", "08000", "08001", "08003", "08006", "57P01", "57P02", "57P03"]);
const CONNECTION_MESSAGES = new Set([
  "Connection terminated unexpectedly",
  "Connection terminated due to connection timeout",
  "timeout exceeded when trying to connect",
  "Client has encountered a connection error and is not queryable",
]);

export async function retryCmsRead<T>(read: () => Promise<T>): Promise<T> {
  try { return await read(); }
  catch (error) {
    if (!error || typeof error !== "object") throw error;
    const failure = error as { code?: unknown; message?: unknown };
    const reconnect = typeof failure.code === "string" ? CONNECTION_CODES.has(failure.code) :
      typeof failure.message === "string" && CONNECTION_MESSAGES.has(failure.message);
    if (!reconnect) throw error;
    // pg removes the failed client; a single new attempt can now get a fresh
    // connection. Existing connect/statement deadlines still bound both attempts.
    await new Promise(resolve => setTimeout(resolve, 100));
    return read();
  }
}

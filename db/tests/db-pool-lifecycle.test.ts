import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { getPool } from "../../src/lib/server/db.ts";
import { runtimeDatabaseConfig } from "../../src/lib/server/db-config.ts";

test("Vercel pool cleanup keeps the request alive until actual pg idle clients close", async () => {
  const keys = ["VERCEL", "VERCEL_URL", "VERCEL_REGION", "DATABASE_URL", "DATABASE_URL_APP"] as const;
  const before = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  const symbol = Symbol.for("@vercel/request-context");
  const globals = globalThis as typeof globalThis & { __pgPool?: ReturnType<typeof getPool>; [symbol: symbol]: unknown };
  const previousContext = globals[symbol];
  const pending: Promise<unknown>[] = [];
  let closed = 0;
  class Client extends EventEmitter {
    _queryable = true;
    _ending = false;
    connect(callback: (error?: Error) => void) { queueMicrotask(() => callback()); }
    end(callback?: () => void) { this._ending = true; closed++; callback?.(); }
  }
  process.env.VERCEL = "1"; process.env.VERCEL_URL = "test.example.invalid"; process.env.VERCEL_REGION = "sin1";
  process.env.DATABASE_URL_APP = "postgresql://fixture:fixture@example.invalid/fixture";
  globals[symbol] = { get: () => ({ waitUntil: (promise: Promise<unknown>) => pending.push(promise) }) };
  const pool = getPool();
  try {
    assert.equal(getPool(), pool);
    assert.equal(pool.listenerCount("release"), 1, "one lifecycle attachment for the shared pool");
    assert.equal(pool.options.max, 3);
    assert.equal(pool.options.idleTimeoutMillis, 5000);
    assert.equal(pool.options.connectionTimeoutMillis, 10000);
    assert.equal(pool.options.keepAlive, true);
    // Exercise the real pg pool/SDK with a local fake socket client; no network.
    (pool as unknown as { Client: typeof Client }).Client = Client;
    pool.options.idleTimeoutMillis = 20;
    const client = await pool.connect(); client.release();
    assert.equal(pool.idleCount, 1);
    assert.equal(pending.length, 1, "Fluid must retain the invocation for cleanup");
    await Promise.all(pending);
    assert.equal(closed, 1); assert.equal(pool.totalCount, 0);
    await new Promise<void>((resolve, reject) => pool.connect((error, callbackClient, release) => {
      if (error) return reject(error);
      assert(callbackClient); release(); resolve();
    }));
    await Promise.all(pending);
    assert.equal(closed, 2, "callback-based checkouts also close before suspension");
  } finally {
    await pool.end(); delete globals.__pgPool; globals[symbol] = previousContext;
    for (const key of keys) { if (before[key] === undefined) delete process.env[key]; else process.env[key] = before[key]; }
  }
});

test("pool lifecycle changes retain certificate verification and SQL/lock deadlines", () => {
  const config = runtimeDatabaseConfig("postgresql://fixture:fixture@example.invalid/db?sslmode=no-verify&ssl=false");
  assert.equal(new URL(config.connectionString).searchParams.get("sslmode"), "verify-full");
  assert.equal(new URL(config.connectionString).searchParams.has("ssl"), false);
  assert.deepEqual(config.ssl, { rejectUnauthorized: true });
  assert.equal(config.statement_timeout, 15000); assert.equal(config.lock_timeout, 5000);
  assert.equal(config.idle_in_transaction_session_timeout, 15000);
});

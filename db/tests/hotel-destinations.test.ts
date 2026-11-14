/** Existing development tables only; fixture data is rolled back. No DDL. */
import assert from "node:assert/strict";
import { randomInt } from "node:crypto";
import { execFileSync } from "node:child_process";
import type { Pool } from "pg";
import { getPool } from "../../src/lib/server/db.ts";
import { listHotelDestinations, resolveHotelDestination } from "../../src/lib/server/hotel-destinations.ts";

const endpoint = (value: string) => new URL(value).hostname.replace(/-pooler\./, ".");
assert(process.argv.includes("--dev") && !process.env.VERCEL);
assert.equal(execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim(), "development");
assert(process.env.DATABASE_URL_APP && process.env.DATABASE_URL && process.env.DATABASE_URL_PRODUCTION);
assert.equal(endpoint(process.env.DATABASE_URL_APP), endpoint(process.env.DATABASE_URL));
assert.notEqual(endpoint(process.env.DATABASE_URL_APP), endpoint(process.env.DATABASE_URL_PRODUCTION));
const pool = getPool(); const client = await pool.connect();
const globals = globalThis as unknown as { __pgPool: Pool };
globals.__pgPool = { query: client.query.bind(client) } as unknown as Pool;
const id = randomInt(1_000_000_000, 1_900_000_000);
try {
  await client.query("BEGIN");
  await client.query("INSERT INTO regions(region_id,name,state,display_order) VALUES($1,'Hotel fixture','Test',-1000)", [id]);
  await client.query("INSERT INTO cities(city_id,region_id,name,latitude,longitude) VALUES($1,$1,'Pinned city',28.6139,77.209),($2,$1,'Unpinned city',NULL,NULL)", [id, id + 1]);
  const destination = await resolveHotelDestination(id);
  assert.equal(destination.name, "Pinned city"); assert.equal(destination.regionId, id);
  assert.equal(destination.latitude, 28.6139); assert.equal(destination.longitude, 77.209);
  assert.ok((await listHotelDestinations()).some(city => city.id === id));
  assert.ok(!(await listHotelDestinations()).some(city => city.id === id + 1));
  await assert.rejects(resolveHotelDestination(id + 1)); await assert.rejects(resolveHotelDestination(id + 2));
  console.log("PASS canonical coordinates and names; unpinned and unknown cities excluded");
  for (const table of ["cities", "regions"]) {
    const pk = table === "cities" ? "city_id" : "region_id";
    for (const flag of ["is_active", "is_deleted"]) {
      await client.query("SAVEPOINT flags");
      await client.query(`UPDATE ${table} SET ${flag}=$1 WHERE ${pk}=$2`, [flag === "is_deleted", id]);
      assert.ok(!(await listHotelDestinations()).some(city => city.id === id));
      await assert.rejects(resolveHotelDestination(id));
      await client.query("ROLLBACK TO SAVEPOINT flags");
    }
  }
  console.log("PASS inactive/deleted cities and parent regions excluded; fresh resolution rejects withdrawal");
} finally {
  await client.query("ROLLBACK"); globals.__pgPool = pool; client.release(); await pool.end();
  console.log("Development fixtures rolled back; no schema change or production connection.");
}

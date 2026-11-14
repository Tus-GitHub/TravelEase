/** Dev-only catalogue checks. All fixtures and flag changes are rolled back; no DDL. */
import assert from "node:assert/strict";
import { randomInt } from "node:crypto";
import { execFileSync } from "node:child_process";
import type { Pool } from "pg";
import { getPool } from "../../src/lib/server/db.ts";
import { loadItineraryCatalogue, checkItineraryCatalogue } from "../../src/lib/server/itinerary-catalogue.ts";
import { listPublicRegions } from "../../src/lib/server/catalogue.ts";

const endpoint = (value: string) => new URL(value).hostname.replace(/-pooler\./, ".");
assert(process.argv.includes("--dev") && !process.env.VERCEL);
assert.equal(execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim(), "development");
assert(process.env.DATABASE_URL_APP && process.env.DATABASE_URL && process.env.DATABASE_URL_PRODUCTION);
assert.equal(endpoint(process.env.DATABASE_URL_APP), endpoint(process.env.DATABASE_URL));
assert.notEqual(endpoint(process.env.DATABASE_URL_APP), endpoint(process.env.DATABASE_URL_PRODUCTION));
const pool = getPool();
const client = await pool.connect();
const globals = globalThis as unknown as { __pgPool: Pool };
globals.__pgPool = { query: client.query.bind(client) } as unknown as Pool;
const base = randomInt(1_000_000_000, 1_900_000_000);
try {
  await client.query("BEGIN");
  // Explicit IDs avoid consuming serial sequence values even on rollback.
  await client.query("INSERT INTO regions(region_id,name,state) VALUES($1,'AI catalogue fixture','Test'),($2,'Other fixture','Test')", [base, base + 1]);
  await client.query("INSERT INTO cities(city_id,region_id,name) VALUES($1,$1,'Test city'),($2,$2,'Other city')", [base, base + 1]);
  await client.query("INSERT INTO tourist_spots(tourist_spot_id,city_id,name,tag,description) VALUES($1,$1,'First','Nature','Canonical description'),($2,$1,'Second','Heritage','Second description'),($3,$2,'Other region','Culture','Other')", [base, base + 1, base + 2]);
  let spots = await loadItineraryCatalogue(base);
  assert.deepEqual(spots.map(spot => spot.id), [String(base), String(base + 1)]);
  assert.equal(spots[0].description, "Canonical description");
  assert.equal(spots[0].cityName, "Test city");
  assert.ok(spots[0].imageUrl.startsWith("https://"));
  assert.deepEqual((await loadItineraryCatalogue(base, [base + 1, base + 2])).map(spot => spot.id), [String(base + 1)]);
  console.log("PASS region isolation, canonical metadata, fallback image and selected-ID resolution");

  for (const table of ["tourist_spots", "cities", "regions"]) {
    const pk = { tourist_spots: "tourist_spot_id", cities: "city_id", regions: "region_id" }[table];
    for (const flag of ["is_active", "is_deleted"]) {
      await client.query("SAVEPOINT flags");
      await client.query(`UPDATE ${table} SET ${flag}=$1 WHERE ${pk}=$2`, [flag === "is_deleted", base]);
      spots = await loadItineraryCatalogue(base);
      assert.ok(!spots.some(spot => spot.id === String(base)), `${table}.${flag} excluded from AI`);
      const publicRegion = (await listPublicRegions()).find(region => region.id === base);
      assert.ok(!publicRegion?.spots.some(spot => spot.id === base), `${table}.${flag} excluded from picker`);
      assert.throws(() => checkItineraryCatalogue({ regionId: base, stopCount: 2, keepIds: [base], interests: [] }, spots));
      await client.query("ROLLBACK TO SAVEPOINT flags");
    }
  }
  console.log("PASS inactive/deleted spots and parents excluded from AI and public picker; fresh checks reject withdrawn stops");
  await client.query("INSERT INTO tourist_spots(tourist_spot_id,city_id,name) SELECT $1::int + n, $1::int, 'Extra ' || n FROM generate_series(3,61) AS n", [base]);
  await assert.rejects(loadItineraryCatalogue(base), (error: unknown) => (error as {status?: number}).status === 422);
  assert.equal((await loadItineraryCatalogue(base, [base, base + 1])).length, 2);
  console.log("PASS oversized catalogue fails explicitly without silent truncation");
} finally {
  await client.query("ROLLBACK");
  globals.__pgPool = pool;
  client.release();
  await pool.end();
  console.log("Development fixtures rolled back; no schema changes or production connection.");
}

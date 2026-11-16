import type { Pool, PoolClient } from "pg";
import { getPool } from "../db";
import { DependentRowsError } from "../db-errors";

type Db = Pool | PoolClient;
const tables = new Set(["regions", "states", "cities", "tourist_spots", "packages", "package_stops", "vehicle_types", "vehicles", "vendor_profiles"]);
export const isCatalogueTable = (table: string) => tables.has(table);

/** Short admin catalogue writes share one lock, before any resource/row lock.
 * Parent checks, child counts and writes then use fresh snapshots on one client.
 * This avoids introducing conflicting lock orders across the catalogue graph. */
export async function catalogueWrite<T>(table: string, work: (db: Db) => Promise<T>): Promise<T> {
  if (!tables.has(table)) return work(getPool());
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('admin-catalogue-relations',0))");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}

const references: Record<string, readonly (readonly [string, string, string, boolean?])[]> = {
  states: [["regionId", "regions", "region_id"]],
  cities: [["stateId", "states", "state_id"], ["regionId", "regions", "region_id"]],
  tourist_spots: [["cityId", "cities", "city_id"]],
  packages: [["regionId", "regions", "region_id"], ["vehicleTypeId", "vehicle_types", "vehicle_type_id"]],
  package_stops: [["packageId", "packages", "package_id"], ["touristSpotId", "tourist_spots", "tourist_spot_id"]],
  vehicles: [["vehicleTypeId", "vehicle_types", "vehicle_type_id"], ["vendorProfileId", "vendor_profiles", "vendor_profile_id", true]],
};
export async function assertCatalogueParents(db: Db, table: string, input: Record<string, unknown>): Promise<void> {
  for (const [key, parent, column, nullable] of references[table] ?? []) {
    if (input[key] === undefined || (input[key] === null && nullable)) continue;
    if (!(await db.query(`SELECT 1 FROM ${parent} WHERE ${column}=$1 AND NOT is_deleted FOR SHARE`, [input[key]])).rowCount) {
      // Preserve the API's existing foreign-key error mapping for absent parents.
      throw Object.assign(new Error("The referenced catalogue record is no longer available."), { code: "23503" });
    }
  }
}

const children: Record<string, readonly (readonly [string, string, string])[]> = {
  regions: [["states", "region_id", "states"], ["cities", "region_id", "cities"], ["packages", "region_id", "packages"]],
  states: [["cities", "state_id", "cities"]],
  cities: [["tourist_spots", "city_id", "tourist spots"]],
  tourist_spots: [["package_stops", "tourist_spot_id", "package stops"]],
  vehicle_types: [["vehicles", "vehicle_type_id", "vehicles"], ["packages", "vehicle_type_id", "packages"]],
  vendor_profiles: [["vehicles", "vendor_profile_id", "vehicles"]],
};
export async function assertCatalogueDelete(db: Db, table: string, id: number): Promise<void> {
  for (const [child, column, label] of children[table] ?? []) {
    const count = (await db.query(`SELECT count(*)::int AS n FROM ${child} WHERE ${column}=$1 AND NOT is_deleted`, [id])).rows[0].n;
    if (count) throw new DependentRowsError(`This record still has ${count} ${label}. Move or delete them first.`);
  }
}

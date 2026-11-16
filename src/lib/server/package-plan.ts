import { createHash } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { getPool } from "./db";
import { validatePackageContent, selectPackageRoute, type PackageContent, type PackagePlanSnapshot } from "../package-content";
import { TripError } from "../weekend-trips";

type Db = Pool | PoolClient;
export async function planSpotNames(db: Db, ids: number[], lock = false): Promise<Map<number, string>> {
  if (!ids.length) return new Map();
  const rows = await db.query(`SELECT ts.tourist_spot_id,ts.name FROM tourist_spots ts
    JOIN cities c ON c.city_id=ts.city_id JOIN states s ON s.state_id=c.state_id JOIN regions r ON r.region_id=s.region_id
    WHERE ts.tourist_spot_id=ANY($1::int[]) AND NOT ts.is_deleted AND ts.is_active
      AND NOT c.is_deleted AND c.is_active AND NOT s.is_deleted AND s.is_active AND NOT r.is_deleted AND r.is_active
    ORDER BY ts.tourist_spot_id ${lock ? "FOR SHARE OF ts,c,s,r" : ""}`, [ids]);
  return new Map(rows.rows.map(row => [row.tourist_spot_id, row.name]));
}
export async function assertPlanDestinations(db: Db, content: PackageContent | null | undefined) {
  const ids = content?.routeTree?.nodes.map(node => node.spotId) ?? [];
  if ((await planSpotNames(db, ids, true)).size !== ids.length) throw new TripError("Choose active destinations with active cities, states and regions for every route branch.");
}
export async function resolvePrivatePackage(input: { packageId?: unknown; packageSlug?: unknown; guidedPath?: unknown }, db: Db = getPool(), lock = false) {
  const id = typeof input.packageId === "number" && Number.isSafeInteger(input.packageId) && input.packageId > 0 && input.packageId <= 2147483647 ? input.packageId : null;
  const slug = typeof input.packageSlug === "string" && input.packageSlug.length <= 180 ? input.packageSlug : null;
  const pkg = (await db.query(`SELECT p.package_id,p.slug,p.name,p.vehicle_type_id,p.price_per_person,p.duration_days,p.max_persons,p.trip_content
    FROM packages p JOIN regions r USING(region_id) JOIN vehicle_types vt USING(vehicle_type_id)
    WHERE p.is_active AND NOT p.is_deleted AND p.booking_mode IN ('private','both')
      AND r.is_active AND NOT r.is_deleted AND vt.is_active AND NOT vt.is_deleted
      AND (($1::int IS NOT NULL AND p.package_id=$1) OR ($1::int IS NULL AND p.slug=$2))
    LIMIT 1 ${lock ? "FOR SHARE OF p,r,vt" : ""}`, [id, slug])).rows[0];
  if (!pkg) throw new TripError("Package not found or unavailable.", 404);
  if (id !== null && slug !== null && slug !== pkg.slug) throw new TripError("The package identifier and name do not match.");
  const content = pkg.trip_content == null ? null : validatePackageContent(pkg.trip_content);
  const stops = (await db.query(`SELECT ps.tourist_spot_id,ps.stop_order,ps.nights_here FROM package_stops ps
    WHERE ps.package_id=$1 AND NOT ps.is_deleted ORDER BY ps.stop_order,ps.package_stop_id ${lock ? "FOR SHARE" : ""}`, [pkg.package_id])).rows as { tourist_spot_id: number; stop_order: number; nights_here: number }[];
  const names = await planSpotNames(db, content?.routeTree?.nodes.map(node => node.spotId) ?? stops.map(stop => stop.tourist_spot_id), lock);
  const selectedRoute = content?.routeTree ? selectPackageRoute(content.routeTree, input.guidedPath, Number(pkg.price_per_person), names) : undefined;
  if (!content?.routeTree && Array.isArray(input.guidedPath) && input.guidedPath.length) throw new TripError("This route plan has changed. Review the package again.", 409);
  if (!content?.routeTree && stops.some(stop => !names.has(stop.tourist_spot_id))) throw new TripError("A destination in this package is temporarily unavailable.", 422);
  if (content && !(Number(pkg.price_per_person) > 0)) throw new TripError("The administrator needs to set this package’s price before it can be booked.", 422);
  const fingerprint = createHash("sha256").update(JSON.stringify({ id: pkg.package_id, name: pkg.name, type: pkg.vehicle_type_id, price: pkg.price_per_person, days: pkg.duration_days, capacity: pkg.max_persons, content, stops, path: selectedRoute?.stops.map(stop => ({ id: stop.spotId, name: stop.name })) })).digest("hex");
  const snapshot: PackagePlanSnapshot | undefined = content ? { version: 1, name: pkg.name, content: { ...content, routeTree: undefined }, ...(selectedRoute ? { selectedRoute } : {}), fingerprint } : undefined;
  return { id: pkg.package_id as number, vehicleTypeId: pkg.vehicle_type_id as number, maxPersons: pkg.max_persons as number,
    pricePerPerson: selectedRoute?.pricePerPerson ?? Number(pkg.price_per_person), days: selectedRoute?.days ?? Number(pkg.duration_days),
    nights: selectedRoute?.nights ?? Math.max(0, Number(pkg.duration_days) - 1),
    stops: selectedRoute ? selectedRoute.stops.map((stop, i) => ({ tourist_spot_id: stop.spotId, stop_order: i + 1 })) : stops,
    fingerprint, snapshot };
}

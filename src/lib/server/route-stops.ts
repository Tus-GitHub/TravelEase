import { getPool } from "./db";
import { RoutingError } from "./road-matrix";
import { validateStopIds } from "../route-optimization";

/** Public catalogue coordinates only: never trust client locations or inactive parents. */
export async function resolveRouteLocations(ids: number[]): Promise<[number, number][]> {
  validateStopIds(ids);
  const result = await getPool().query(
    `SELECT ts.tourist_spot_id AS id, ts.latitude, ts.longitude, c.region_id
     FROM tourist_spots ts JOIN cities c ON c.city_id = ts.city_id
     JOIN regions r ON r.region_id = c.region_id
     WHERE ts.tourist_spot_id = ANY($1::int[]) AND NOT ts.is_deleted AND ts.is_active
       AND NOT c.is_deleted AND c.is_active AND NOT r.is_deleted AND r.is_active`, [ids],
  );
  if (result.rows.length !== ids.length || new Set(result.rows.map(row => row.region_id)).size !== 1) {
    throw new RoutingError("Choose available tourist spots from one region.", 400);
  }
  const rows = ids.map(id => result.rows.find(row => row.id === id)!);
  if (rows.some(row => row.latitude == null || row.longitude == null)) {
    throw new RoutingError("Some stops do not have a map pin yet. Please arrange this trip manually for now.", 422);
  }
  return rows.map(row => [Number(row.longitude), Number(row.latitude)]);
}

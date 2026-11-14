import { getPool } from "./db";
import { HotelError, type HotelDestination } from "../hotels";

const SELECT = `SELECT c.city_id, c.name, c.latitude, c.longitude, r.region_id, r.name AS region_name
  FROM cities c JOIN regions r ON r.region_id = c.region_id
  WHERE c.is_active AND NOT c.is_deleted AND r.is_active AND NOT r.is_deleted
    AND c.latitude BETWEEN -90 AND 90 AND c.longitude BETWEEN -180 AND 180`;
const destination = (row: Record<string, unknown>): HotelDestination => ({
  id: Number(row.city_id), name: String(row.name), regionId: Number(row.region_id), regionName: String(row.region_name),
});
export async function listHotelDestinations(): Promise<HotelDestination[]> {
  const result = await getPool().query(`${SELECT} ORDER BY r.display_order, c.display_order, c.city_id LIMIT 500`);
  return result.rows.map(destination);
}
export async function resolveHotelDestination(id: number) {
  const result = await getPool().query(`${SELECT} AND c.city_id = $1`, [id]);
  if (!result.rows[0]) throw new HotelError("This city is unavailable or does not have a verified map location. Choose another city.", 404);
  return { ...destination(result.rows[0]), latitude: Number(result.rows[0].latitude), longitude: Number(result.rows[0].longitude) };
}

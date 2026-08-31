import { getPool } from "../db";
import { applyPartialUpdate, softDelete } from "./_util";

// ─── Regions ───────────────────────────────────────────────────────────────────

export interface Region {
  id: number;
  name: string;
  state: string;
  isActive: boolean;
}

const R_SELECT = `SELECT region_id, name, state, is_active FROM regions`;

function toRegion(r: {
  region_id: number;
  name: string;
  state: string;
  is_active: boolean;
}): Region {
  return { id: r.region_id, name: r.name, state: r.state, isActive: r.is_active };
}

export async function listRegions(): Promise<Region[]> {
  const result = await getPool().query(
    `${R_SELECT} WHERE is_deleted = false ORDER BY display_order, region_id`,
  );
  return result.rows.map(toRegion);
}

async function getRegion(id: number): Promise<Region | null> {
  const result = await getPool().query(
    `${R_SELECT} WHERE region_id = $1 AND is_deleted = false`,
    [id],
  );
  return result.rows[0] ? toRegion(result.rows[0]) : null;
}

export interface RegionInput {
  name: string;
  state: string;
}

export async function createRegion(input: RegionInput, actorId: string): Promise<Region> {
  const result = await getPool().query(
    `INSERT INTO regions (name, state, created_by, updated_by)
     VALUES ($1, $2, $3, $3) RETURNING region_id`,
    [input.name, input.state, actorId],
  );
  return (await getRegion(result.rows[0].region_id))!;
}

export async function updateRegion(
  id: number,
  input: Partial<RegionInput & { isActive: boolean }>,
  actorId: string,
): Promise<Region | null> {
  const ok = await applyPartialUpdate(
    "regions",
    "region_id",
    id,
    input,
    { name: "name", state: "state", isActive: "is_active" },
    actorId,
  );
  return ok ? getRegion(id) : null;
}

export function deleteRegion(id: number, actorId: string): Promise<boolean> {
  return softDelete("regions", "region_id", id, actorId);
}

// ─── Cities ────────────────────────────────────────────────────────────────────

export interface City {
  id: number;
  regionId: number;
  regionName: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  isPickupPoint: boolean;
  isAirport: boolean;
}

interface CityRow {
  city_id: number;
  region_id: number;
  region_name: string;
  name: string;
  latitude: string | null;
  longitude: string | null;
  is_pickup_point: boolean;
  is_airport: boolean;
}

function toCity(r: CityRow): City {
  return {
    id: r.city_id,
    regionId: r.region_id,
    regionName: r.region_name,
    name: r.name,
    latitude: r.latitude != null ? Number(r.latitude) : null,
    longitude: r.longitude != null ? Number(r.longitude) : null,
    isPickupPoint: r.is_pickup_point,
    isAirport: r.is_airport,
  };
}

const C_SELECT = `
  SELECT c.city_id, c.region_id, r.name AS region_name, c.name,
         c.latitude, c.longitude, c.is_pickup_point, c.is_airport
  FROM cities c
  JOIN regions r ON r.region_id = c.region_id
`;

export async function listCities(): Promise<City[]> {
  const result = await getPool().query(
    `${C_SELECT} WHERE c.is_deleted = false ORDER BY c.display_order, c.city_id`,
  );
  return result.rows.map(toCity);
}

async function getCity(id: number): Promise<City | null> {
  const result = await getPool().query(
    `${C_SELECT} WHERE c.city_id = $1 AND c.is_deleted = false`,
    [id],
  );
  return result.rows[0] ? toCity(result.rows[0]) : null;
}

export interface CityInput {
  regionId: number;
  name: string;
  latitude: number | null;
  longitude: number | null;
  isPickupPoint: boolean;
  isAirport: boolean;
}

export async function createCity(input: CityInput, actorId: string): Promise<City> {
  const result = await getPool().query(
    `INSERT INTO cities
       (region_id, name, latitude, longitude, is_pickup_point, is_airport, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $7) RETURNING city_id`,
    [
      input.regionId,
      input.name,
      input.latitude,
      input.longitude,
      input.isPickupPoint,
      input.isAirport,
      actorId,
    ],
  );
  return (await getCity(result.rows[0].city_id))!;
}

export async function updateCity(
  id: number,
  input: Partial<CityInput>,
  actorId: string,
): Promise<City | null> {
  const ok = await applyPartialUpdate(
    "cities",
    "city_id",
    id,
    input,
    {
      regionId: "region_id",
      name: "name",
      latitude: "latitude",
      longitude: "longitude",
      isPickupPoint: "is_pickup_point",
      isAirport: "is_airport",
    },
    actorId,
  );
  return ok ? getCity(id) : null;
}

export function deleteCity(id: number, actorId: string): Promise<boolean> {
  return softDelete("cities", "city_id", id, actorId);
}

// ─── Tourist spots ─────────────────────────────────────────────────────────────

export interface TouristSpot {
  id: number;
  cityId: number;
  cityName: string;
  name: string;
  tag: string;
  description: string;
  displayOrder: number;
}

interface TouristSpotRow {
  tourist_spot_id: number;
  city_id: number;
  city_name: string;
  name: string;
  tag: string | null;
  description: string | null;
  display_order: number;
}

function toTouristSpot(r: TouristSpotRow): TouristSpot {
  return {
    id: r.tourist_spot_id,
    cityId: r.city_id,
    cityName: r.city_name,
    name: r.name,
    tag: r.tag ?? "",
    description: r.description ?? "",
    displayOrder: r.display_order,
  };
}

const TS_SELECT = `
  SELECT ts.tourist_spot_id, ts.city_id, c.name AS city_name, ts.name, ts.tag,
         ts.description, ts.display_order
  FROM tourist_spots ts
  JOIN cities c ON c.city_id = ts.city_id
`;

export async function listTouristSpots(): Promise<TouristSpot[]> {
  const result = await getPool().query(
    `${TS_SELECT} WHERE ts.is_deleted = false ORDER BY ts.city_id, ts.display_order, ts.tourist_spot_id`,
  );
  return result.rows.map(toTouristSpot);
}

async function getTouristSpot(id: number): Promise<TouristSpot | null> {
  const result = await getPool().query(
    `${TS_SELECT} WHERE ts.tourist_spot_id = $1 AND ts.is_deleted = false`,
    [id],
  );
  return result.rows[0] ? toTouristSpot(result.rows[0]) : null;
}

export interface TouristSpotInput {
  cityId: number;
  name: string;
  tag: string;
  description: string;
}

export async function createTouristSpot(
  input: TouristSpotInput,
  actorId: string,
): Promise<TouristSpot> {
  const result = await getPool().query(
    `INSERT INTO tourist_spots (city_id, name, tag, description, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $5) RETURNING tourist_spot_id`,
    [input.cityId, input.name, input.tag || null, input.description || null, actorId],
  );
  return (await getTouristSpot(result.rows[0].tourist_spot_id))!;
}

export async function updateTouristSpot(
  id: number,
  input: Partial<TouristSpotInput>,
  actorId: string,
): Promise<TouristSpot | null> {
  const ok = await applyPartialUpdate(
    "tourist_spots",
    "tourist_spot_id",
    id,
    input,
    { cityId: "city_id", name: "name", tag: "tag", description: "description" },
    actorId,
  );
  return ok ? getTouristSpot(id) : null;
}

export function deleteTouristSpot(id: number, actorId: string): Promise<boolean> {
  return softDelete("tourist_spots", "tourist_spot_id", id, actorId);
}

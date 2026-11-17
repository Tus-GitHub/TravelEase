import type { Pool, PoolClient } from "pg";
import { catalogueWrite, assertCatalogueParents } from "./_catalogue";
import { getPool } from "../db";
import { applyPartialUpdate, softDelete } from "./_util";

// ─── Regions ───────────────────────────────────────────────────────────────────

export interface Region {
  id: number;
  name: string;
  state: string;
  isActive: boolean;
}

const R_SELECT = `SELECT r.region_id, r.name, r.is_active,
  COALESCE((SELECT string_agg(s.name, ' · ' ORDER BY s.name) FROM states s WHERE s.region_id=r.region_id AND NOT s.is_deleted),'') AS state FROM regions r`;

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
  state?: string;
}

export async function createRegion(input: RegionInput, actorId: string): Promise<Region> {
  const result = await getPool().query(
    `INSERT INTO regions (name, state, created_by, updated_by)
     VALUES ($1, $2, $3, $3) RETURNING region_id`,
    [input.name, input.state ?? "", actorId],
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

export async function deleteRegion(id: number, actorId: string): Promise<boolean> {
  return softDelete("regions", "region_id", id, actorId);
}

// ─── States ──────────────────────────────────────────────────────────────────
export interface State { id: number; regionId: number; regionName: string; name: string; isActive: boolean }
export interface StateInput { regionId: number; name: string; isActive?: boolean }
const S_SELECT = `SELECT s.state_id AS id,s.region_id AS "regionId",r.name AS "regionName",s.name,s.is_active AS "isActive"
  FROM states s JOIN regions r USING(region_id)`;
export async function listStates(): Promise<State[]> {
  return (await getPool().query(`${S_SELECT} WHERE NOT s.is_deleted ORDER BY r.display_order,s.display_order,s.state_id`)).rows;
}
async function getState(id: number, db: Pool | PoolClient = getPool()): Promise<State | null> {
  return (await db.query(`${S_SELECT} WHERE s.state_id=$1 AND NOT s.is_deleted`,[id])).rows[0] ?? null;
}
export async function createState(input: StateInput, actorId: string): Promise<State> {
  return catalogueWrite("states", async db => {
    await assertCatalogueParents(db,"states",{...input});
    const row=(await db.query(`INSERT INTO states(region_id,name,created_by,updated_by) VALUES($1,$2,$3,$3) RETURNING state_id`,[input.regionId,input.name,actorId])).rows[0];
    return (await getState(row.state_id,db))!;
  });
}
export async function updateState(id: number,input: Partial<StateInput>,actorId: string): Promise<State | null> {
  const changed=await applyPartialUpdate("states","state_id",id,input,{regionId:"region_id",name:"name",isActive:"is_active"},actorId);
  return changed ? getState(id) : null;
}
export async function deleteState(id: number,actorId: string): Promise<boolean> { return softDelete("states","state_id",id,actorId); }

// ─── Cities ────────────────────────────────────────────────────────────────────

export interface City {
  id: number;
  stateId: number;
  stateName: string;
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
  state_id: number;
  state_name: string;
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
    stateId: r.state_id,
    stateName: r.state_name,
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
  SELECT c.city_id, c.state_id, s.name AS state_name, s.region_id, r.name AS region_name, c.name,
         c.latitude, c.longitude, c.is_pickup_point, c.is_airport
  FROM cities c
  JOIN states s ON s.state_id=c.state_id
  JOIN regions r ON r.region_id = s.region_id
`;

export async function listCities(): Promise<City[]> {
  const result = await getPool().query(
    `${C_SELECT} WHERE c.is_deleted = false ORDER BY c.display_order, c.city_id`,
  );
  return result.rows.map(toCity);
}

async function getCity(id: number, client?: Pool | PoolClient): Promise<City | null> {
  const result = await (client ?? getPool()).query(
    `${C_SELECT} WHERE c.city_id = $1 AND c.is_deleted = false`,
    [id],
  );
  return result.rows[0] ? toCity(result.rows[0]) : null;
}

export interface CityInput {
  stateId?: number;
  /** Compatibility for the prior client, only if its region has one state. */
  regionId?: number;
  name: string;
  latitude: number | null;
  longitude: number | null;
  isPickupPoint: boolean;
  isAirport: boolean;
}

export async function createCity(input: CityInput, actorId: string): Promise<City> {
  return catalogueWrite("cities", async db => {
    await assertCatalogueParents(db, "cities", { ...input });
    const result = await db.query(
      `INSERT INTO cities
         (region_id, name, latitude, longitude, is_pickup_point, is_airport, created_by, updated_by,state_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7,$8) RETURNING city_id`,
      [
        input.regionId ?? null,
        input.name,
        input.latitude,
        input.longitude,
        input.isPickupPoint,
        input.isAirport,
        actorId,
        input.stateId ?? null,
      ],
    );
    return (await getCity(result.rows[0].city_id, db))!;
  });
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
      stateId: "state_id",
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

export async function deleteCity(id: number, actorId: string): Promise<boolean> {
  return softDelete("cities", "city_id", id, actorId);
}

// ─── Tourist spots ─────────────────────────────────────────────────────────────

export interface TouristSpot {
  latitude: number | null;
  longitude: number | null;
  id: number;
  cityId: number;
  cityName: string;
  stateName: string;
  regionName: string;
  name: string;
  tag: string;
  description: string;
  displayOrder: number;
  regionId: number;
  isActive: boolean;
  imageUrl: string | null;
}

interface TouristSpotRow {
  state_name: string;
  region_name: string;
  latitude: number | null;
  longitude: number | null;
  tourist_spot_id: number;
  city_id: number;
  city_name: string;
  name: string;
  tag: string | null;
  description: string | null;
  display_order: number;
  region_id: number;
  is_active: boolean;
  image_url: string | null;
}

function toTouristSpot(r: TouristSpotRow): TouristSpot {
  return {
    regionId: r.region_id,
    isActive: r.is_active,
    latitude: r.latitude,
    longitude: r.longitude,
    id: r.tourist_spot_id,
    cityId: r.city_id,
    cityName: r.city_name,
    stateName: r.state_name,
    regionName: r.region_name,
    name: r.name,
    tag: r.tag ?? "",
    description: r.description ?? "",
    displayOrder: r.display_order,
    imageUrl: r.image_url ?? null,
  };
}

const TS_SELECT = `
  SELECT ts.tourist_spot_id, ts.city_id, c.region_id, ts.is_active, c.name AS city_name, s.name AS state_name, r.name AS region_name, ts.name, ts.tag,
         ts.description, ts.display_order, ts.latitude, ts.longitude,
         COALESCE(
           NULLIF(ts.image_url, ''),
           (SELECT ts2.image_url FROM tourist_spots ts2
            WHERE ts2.city_id = ts.city_id AND ts2.is_deleted = false AND ts2.image_url IS NOT NULL AND ts2.image_url <> ''
            ORDER BY ts2.display_order, ts2.tourist_spot_id LIMIT 1)
         ) AS image_url
  FROM tourist_spots ts
  JOIN cities c ON c.city_id = ts.city_id
  JOIN states s ON s.state_id=c.state_id
  JOIN regions r ON r.region_id=s.region_id
`;

export async function listTouristSpots(): Promise<TouristSpot[]> {
  const result = await getPool().query(
    `${TS_SELECT} WHERE ts.is_deleted = false ORDER BY ts.city_id, ts.display_order, ts.tourist_spot_id`,
  );
  return result.rows.map(toTouristSpot);
}

async function getTouristSpot(id: number, client?: Pool | PoolClient): Promise<TouristSpot | null> {
  const result = await (client ?? getPool()).query(
    `${TS_SELECT} WHERE ts.tourist_spot_id = $1 AND ts.is_deleted = false`,
    [id],
  );
  return result.rows[0] ? toTouristSpot(result.rows[0]) : null;
}

export interface TouristSpotInput {
  latitude?: number | null;
  longitude?: number | null;
  cityId: number;
  name: string;
  tag: string;
  description: string;
}

export async function createTouristSpot(
  input: TouristSpotInput,
  actorId: string,
): Promise<TouristSpot> {
  return catalogueWrite("tourist_spots", async db => {
    await assertCatalogueParents(db, "tourist_spots", { ...input });
    const result = await db.query(
      `INSERT INTO tourist_spots (city_id, name, tag, description, created_by, updated_by, latitude, longitude)
       VALUES ($1, $2, $3, $4, $5, $5, $6, $7) RETURNING tourist_spot_id`,
      [input.cityId, input.name, input.tag || null, input.description || null, actorId, input.latitude ?? null, input.longitude ?? null],
    );
    return (await getTouristSpot(result.rows[0].tourist_spot_id, db))!;
  });
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
    { cityId: "city_id", name: "name", tag: "tag", description: "description", latitude: "latitude", longitude: "longitude" },
    actorId,
  );
  return ok ? getTouristSpot(id) : null;
}

export async function deleteTouristSpot(id: number, actorId: string): Promise<boolean> {
  return softDelete("tourist_spots", "tourist_spot_id", id, actorId);
}

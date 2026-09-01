import { getPool } from "../db";
import { DependentRowsError } from "../db-errors";
import { applyPartialUpdate, countActiveChildren, plural, softDelete } from "./_util";

// ─── Vehicle types ─────────────────────────────────────────────────────────────

export interface VehicleType {
  id: number;
  slug: string;
  title: string;
  description: string;
  displayOrder: number;
  isActive: boolean;
}

interface VehicleTypeRow {
  vehicle_type_id: number;
  slug: string;
  title: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
}

function toVehicleType(r: VehicleTypeRow): VehicleType {
  return {
    id: r.vehicle_type_id,
    slug: r.slug,
    title: r.title,
    description: r.description ?? "",
    displayOrder: r.display_order,
    isActive: r.is_active,
  };
}

const VT_SELECT = `
  SELECT vehicle_type_id, slug, title, description, display_order, is_active
  FROM vehicle_types
`;

export async function listVehicleTypes(): Promise<VehicleType[]> {
  const result = await getPool().query(
    `${VT_SELECT} WHERE is_deleted = false ORDER BY display_order, vehicle_type_id`,
  );
  return result.rows.map(toVehicleType);
}

async function getVehicleType(id: number): Promise<VehicleType | null> {
  const result = await getPool().query(
    `${VT_SELECT} WHERE vehicle_type_id = $1 AND is_deleted = false`,
    [id],
  );
  return result.rows[0] ? toVehicleType(result.rows[0]) : null;
}

export interface VehicleTypeInput {
  slug: string;
  title: string;
  description: string;
}

export async function createVehicleType(
  input: VehicleTypeInput,
  actorId: string,
): Promise<VehicleType> {
  const result = await getPool().query(
    `INSERT INTO vehicle_types (slug, title, description, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $4)
     RETURNING vehicle_type_id`,
    [input.slug, input.title, input.description || null, actorId],
  );
  return (await getVehicleType(result.rows[0].vehicle_type_id))!;
}

const VT_COLUMNS = {
  slug: "slug",
  title: "title",
  description: "description",
  isActive: "is_active",
} as const;

export async function updateVehicleType(
  id: number,
  input: Partial<VehicleTypeInput & { isActive: boolean }>,
  actorId: string,
): Promise<VehicleType | null> {
  const ok = await applyPartialUpdate(
    "vehicle_types",
    "vehicle_type_id",
    id,
    input,
    VT_COLUMNS,
    actorId,
  );
  return ok ? getVehicleType(id) : null;
}

export async function deleteVehicleType(id: number, actorId: string): Promise<boolean> {
  const children = await countActiveChildren("vehicles", "vehicle_type_id", id);
  if (children > 0) {
    throw new DependentRowsError(
      `This vehicle type still has ${plural(children, "vehicle")}. Move or delete ${children === 1 ? "it" : "them"} first.`,
    );
  }
  return softDelete("vehicle_types", "vehicle_type_id", id, actorId);
}

// ─── Vehicles ──────────────────────────────────────────────────────────────────

export interface Vehicle {
  id: number;
  vehicleTypeId: number;
  vehicleTypeTitle: string;
  name: string;
  registrationNumber: string;
  seatingCapacity: number;
  features: string[];
  basePricePerDay: number;
  rating: number | null;
  isAvailable: boolean;
}

interface VehicleRow {
  vehicle_id: number;
  vehicle_type_id: number;
  vehicle_type_title: string;
  name: string;
  registration_number: string | null;
  seating_capacity: number;
  features: string[] | null;
  base_price_per_day: string;
  rating: string | null;
  is_available: boolean;
}

function toVehicle(r: VehicleRow): Vehicle {
  return {
    id: r.vehicle_id,
    vehicleTypeId: r.vehicle_type_id,
    vehicleTypeTitle: r.vehicle_type_title,
    name: r.name,
    registrationNumber: r.registration_number ?? "",
    seatingCapacity: r.seating_capacity,
    features: Array.isArray(r.features) ? r.features : [],
    basePricePerDay: Number(r.base_price_per_day),
    rating: r.rating != null ? Number(r.rating) : null,
    isAvailable: r.is_available,
  };
}

const V_SELECT = `
  SELECT v.vehicle_id, v.vehicle_type_id, vt.title AS vehicle_type_title,
         v.name, v.registration_number, v.seating_capacity, v.features,
         v.base_price_per_day, v.rating, v.is_available
  FROM vehicles v
  JOIN vehicle_types vt ON vt.vehicle_type_id = v.vehicle_type_id
`;

export async function listVehicles(): Promise<Vehicle[]> {
  const result = await getPool().query(
    `${V_SELECT} WHERE v.is_deleted = false ORDER BY v.display_order, v.vehicle_id`,
  );
  return result.rows.map(toVehicle);
}

async function getVehicle(id: number): Promise<Vehicle | null> {
  const result = await getPool().query(
    `${V_SELECT} WHERE v.vehicle_id = $1 AND v.is_deleted = false`,
    [id],
  );
  return result.rows[0] ? toVehicle(result.rows[0]) : null;
}

export interface VehicleInput {
  vehicleTypeId: number;
  name: string;
  registrationNumber: string;
  seatingCapacity: number;
  features: string[];
  basePricePerDay: number;
}

export async function createVehicle(
  input: VehicleInput,
  actorId: string,
): Promise<Vehicle> {
  const result = await getPool().query(
    `INSERT INTO vehicles
       (vehicle_type_id, name, registration_number, seating_capacity, features,
        base_price_per_day, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $7)
     RETURNING vehicle_id`,
    [
      input.vehicleTypeId,
      input.name,
      input.registrationNumber || null,
      input.seatingCapacity,
      JSON.stringify(input.features ?? []),
      input.basePricePerDay,
      actorId,
    ],
  );
  return (await getVehicle(result.rows[0].vehicle_id))!;
}

const V_COLUMNS = {
  vehicleTypeId: "vehicle_type_id",
  name: "name",
  registrationNumber: "registration_number",
  seatingCapacity: "seating_capacity",
  basePricePerDay: "base_price_per_day",
  isAvailable: "is_available",
} as const;

export async function updateVehicle(
  id: number,
  input: Partial<VehicleInput & { isAvailable: boolean }>,
  actorId: string,
): Promise<Vehicle | null> {
  const { features, ...rest } = input;
  const ok = await applyPartialUpdate(
    "vehicles",
    "vehicle_id",
    id,
    features !== undefined ? { ...rest, features: JSON.stringify(features) } : rest,
    { ...V_COLUMNS, features: "features" },
    actorId,
  );
  return ok ? getVehicle(id) : null;
}

export function deleteVehicle(id: number, actorId: string): Promise<boolean> {
  return softDelete("vehicles", "vehicle_id", id, actorId);
}

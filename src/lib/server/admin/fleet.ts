import type { Pool, PoolClient } from "pg";
import { catalogueWrite, assertCatalogueParents } from "./_catalogue";
import { getPool } from "../db";
import { applyPartialUpdate, softDelete } from "./_util";
import { protectedResourceMutation } from "../weekend-resources";
import { saveVehicleKmRate } from "./pricing";
import { logActivity } from "../activity-log";

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
  return softDelete("vehicle_types", "vehicle_type_id", id, actorId);
}

// ─── Vehicles ──────────────────────────────────────────────────────────────────

export interface Vehicle {
  perKmRate: number | null;
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
  /** null = Jagdamba-owned; set = owned by this vendor (chunk 3.5). */
  vendorProfileId: number | null;
  vendorBusinessName: string | null;
}

interface VehicleRow {
  per_km_rate: string | null;
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
  vendor_profile_id: number | null;
  vendor_business_name: string | null;
}

function toVehicle(r: VehicleRow): Vehicle {
  return {
    perKmRate: r.per_km_rate === null ? null : Number(r.per_km_rate),
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
    vendorProfileId: r.vendor_profile_id,
    vendorBusinessName: r.vendor_business_name,
  };
}

const V_SELECT = `
  SELECT v.vehicle_id, v.vehicle_type_id, vt.title AS vehicle_type_title,
         v.name, v.registration_number, v.seating_capacity, v.features,
         v.base_price_per_day, v.rating, v.is_available,
         v.vendor_profile_id, vp.business_name AS vendor_business_name,
         (SELECT p.per_km_rate FROM pricing_rules p JOIN booking_types b USING(booking_type_id)
          WHERE p.vehicle_id=v.vehicle_id AND b.code='point_to_point' AND NOT p.is_deleted AND p.is_active
          ORDER BY p.priority DESC,p.pricing_rule_id LIMIT 1) AS per_km_rate
  FROM vehicles v
  JOIN vehicle_types vt ON vt.vehicle_type_id = v.vehicle_type_id
  LEFT JOIN vendor_profiles vp ON vp.vendor_profile_id = v.vendor_profile_id
`;

export async function listVehicles(): Promise<Vehicle[]> {
  const result = await getPool().query(
    `${V_SELECT} WHERE v.is_deleted = false ORDER BY v.display_order, v.vehicle_id`,
  );
  return result.rows.map(toVehicle);
}

async function getVehicle(id: number, client?: Pool | PoolClient): Promise<Vehicle | null> {
  const result = await (client ?? getPool()).query(
    `${V_SELECT} WHERE v.vehicle_id = $1 AND v.is_deleted = false`,
    [id],
  );
  return result.rows[0] ? toVehicle(result.rows[0]) : null;
}

export interface VehicleInput {
  perKmRate?: number;
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
  return catalogueWrite("vehicles", async db => {
    await assertCatalogueParents(db, "vehicles", { ...input });
    const result = await db.query(
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
    const id = result.rows[0].vehicle_id;
    if (input.perKmRate !== undefined) await saveVehicleKmRate(db, id, input.perKmRate, actorId);
    return (await getVehicle(id, db))!;
  });
}

const V_COLUMNS = {
  vehicleTypeId: "vehicle_type_id",
  name: "name",
  registrationNumber: "registration_number",
  seatingCapacity: "seating_capacity",
  basePricePerDay: "base_price_per_day",
  isAvailable: "is_available",
  vendorProfileId: "vendor_profile_id",
} as const;

export async function updateVehicle(
  id: number,
  input: Partial<VehicleInput & { isAvailable: boolean; vendorProfileId: number | null }>,
  actorId: string,
): Promise<Vehicle | null> {
  const { features, perKmRate, ...rest } = input;
  if (perKmRate !== undefined) {
    const result = await catalogueWrite("vehicles", async client => {
      await assertCatalogueParents(client, "vehicles", input);
      return protectedResourceMutation("vehicles", id, input, async db => {
        const values: unknown[] = [], columns: string[] = [];
        for (const [key, column] of Object.entries(V_COLUMNS)) {
          const value = rest[key as keyof typeof rest];
          if (value !== undefined) { values.push(value); columns.push(`${column}=$${values.length}`); }
        }
        if (features !== undefined) { values.push(JSON.stringify(features)); columns.push(`features=$${values.length}::jsonb`); }
        values.push(actorId); columns.push(`updated_by=$${values.length}`); values.push(id);
        const updated = await db.query(`UPDATE vehicles SET ${columns.join(",")} WHERE vehicle_id=$${values.length} AND NOT is_deleted RETURNING vehicle_id`, values);
        if (!updated.rowCount) return null;
        await saveVehicleKmRate(db, id, perKmRate, actorId);
        return getVehicle(id, db);
      }, client as PoolClient);
    });
    if (result) await logActivity({ userId: actorId, action: "admin.update", entityType: "vehicles", entityId: id, details: { fields: Object.keys(input) } });
    return result;
  }
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

import { getPool } from "../db";
import { logActivity } from "../activity-log";
import { resolveBookingTypeId } from "../pricing-rules";
import type { BookingTypeCode } from "../pricing";
import type { Pool, PoolClient } from "pg";

export class PricingError extends Error { status:number; constructor(message: string, status = 400) { super(message); this.status=status; } }
const fields = { baseAmount: "base_amount", perKmRate: "per_km_rate", perHourRate: "per_hour_rate", includedKm: "included_km",
  extraKmRate: "extra_km_rate", perDayRate: "per_day_rate", driverAllowancePerDay: "driver_allowance_per_day",
  nightCharge: "night_charge", flatRate: "flat_rate", taxPercent: "tax_percent", minKm: "min_km", minHours: "min_hours",
  emptyReturnPerKmRate: "empty_return_per_km_rate" } as const;
export type PricingValues = Record<keyof typeof fields, number>;
export async function listPricing() {
  const [rules, vehicles, types, bookingTypes] = await Promise.all([
    getPool().query(`SELECT p.*, b.code AS booking_type, v.name AS vehicle_name, t.title AS vehicle_type_name
      FROM pricing_rules p JOIN booking_types b USING(booking_type_id) LEFT JOIN vehicles v USING(vehicle_id)
      LEFT JOIN vehicle_types t ON t.vehicle_type_id=p.vehicle_type_id WHERE NOT p.is_deleted
      ORDER BY p.vehicle_id NULLS LAST,b.code,p.priority DESC,p.pricing_rule_id`),
    getPool().query("SELECT vehicle_id AS id,name,vehicle_type_id FROM vehicles WHERE NOT is_deleted AND is_active ORDER BY name"),
    getPool().query("SELECT vehicle_type_id AS id,title FROM vehicle_types WHERE NOT is_deleted AND is_active ORDER BY title"),
    getPool().query("SELECT code,name FROM booking_types ORDER BY booking_type_id"),
  ]);
  return { rules: rules.rows.map(row => ({ id: row.pricing_rule_id, name: row.name, bookingType: row.booking_type,
    vehicleId: row.vehicle_id, vehicleTypeId: row.vehicle_type_id, vehicleName: row.vehicle_name, vehicleTypeName: row.vehicle_type_name,
    isActive: row.is_active, emptyReturnEnabled: row.empty_return_enabled, priority: row.priority, effectiveFrom: row.effective_from, effectiveTo: row.effective_to,
    ...Object.fromEntries(Object.entries(fields).map(([key, column]) => [key, Number(row[column] ?? 0)])) })),
    vehicles: vehicles.rows, vehicleTypes: types.rows, bookingTypes: bookingTypes.rows };
}
export async function savePricing(input: Record<string, unknown>, actor: string) {
  const codes = ["point_to_point", "outstation", "hourly", "airport_transfer", "package"];
  if (typeof input.bookingType !== "string" || !codes.includes(input.bookingType)) throw new PricingError("Choose a trip type.");
  const id = input.id == null ? null : input.id;
  const vehicleId = input.vehicleId == null ? null : input.vehicleId;
  const vehicleTypeId = vehicleId !== null ? null : input.vehicleTypeId ?? null;
  for (const value of [id, vehicleId, vehicleTypeId]) if (value !== null && (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0 || value > 2147483647)) throw new PricingError("Invalid pricing target.");
  if (typeof input.isActive !== "boolean") throw new PricingError("Choose whether the rate is active.");
  const emptyReturnEnabled = input.emptyReturnEnabled ?? false;
  if (typeof emptyReturnEnabled !== "boolean") throw new PricingError("Choose whether empty-return charges apply.");
  if (emptyReturnEnabled && (vehicleId === null || !["point_to_point", "airport_transfer"].includes(input.bookingType))) throw new PricingError("Empty-return charges require an individual car and a one-way or airport trip.");
  const values = Object.keys(fields).map(key => {
    const value = key === "emptyReturnPerKmRate" ? input[key] ?? 0 : input[key];
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > (key === "taxPercent" ? 100 : 999999) || (key === "minHours" && !Number.isInteger(value)) || (key === "emptyReturnPerKmRate" && Math.abs(value * 100 - Math.round(value * 100)) > 0.00001)) throw new PricingError(`Invalid ${key}.`);
    return value;
  });
  if (emptyReturnEnabled && !(Number(input.emptyReturnPerKmRate) > 0)) throw new PricingError("Enter a positive empty-return rate per km.");
  const priority = input.priority ?? 0;
  if (typeof priority !== "number" || !Number.isInteger(priority) || Math.abs(priority) > 10000) throw new PricingError("Invalid priority.");
  if (input.isActive) {
    if (["point_to_point", "airport_transfer"].includes(input.bookingType) && !input.perKmRate && !input.flatRate) throw new PricingError("Enter a per-km rate or flat fare.");
    if (input.bookingType === "outstation" && !input.perKmRate) throw new PricingError("Enter an outstation per-km rate.");
    if (input.bookingType === "hourly" && !input.perHourRate) throw new PricingError("Enter an hourly rate.");
    if (input.bookingType === "package" && !input.perDayRate) throw new PricingError("Enter a per-day rate.");
  }
  const bookingTypeId = await resolveBookingTypeId(input.bookingType as BookingTypeCode);
  if (!bookingTypeId) throw new PricingError("Trip type not configured.");
  const client = await getPool().connect();
  let savedId: number;
  try {
    await client.query("BEGIN");
    let target = "All vehicles";
    if (vehicleId !== null) {
      const vehicle = (await client.query("SELECT name FROM vehicles WHERE vehicle_id=$1 AND is_active AND NOT is_deleted FOR UPDATE", [vehicleId])).rows[0];
      if (!vehicle) throw new PricingError("Choose an active vehicle.");
      target = vehicle.name;
    } else if (vehicleTypeId !== null) {
      const type = (await client.query("SELECT title FROM vehicle_types WHERE vehicle_type_id=$1 AND is_active AND NOT is_deleted FOR KEY SHARE", [vehicleTypeId])).rows[0];
      if (!type) throw new PricingError("Choose an active vehicle type.");
      target = type.title;
    }
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`pricing:${vehicleId ?? `type-${vehicleTypeId}`}:${bookingTypeId}`]);
    const existing = id !== null
      ? (await client.query("SELECT pricing_rule_id FROM pricing_rules WHERE pricing_rule_id=$1 AND NOT is_deleted FOR UPDATE", [id])).rows[0]
      : (await client.query(`SELECT pricing_rule_id FROM pricing_rules WHERE booking_type_id=$1 AND vehicle_id IS NOT DISTINCT FROM $2::integer
          AND vehicle_type_id IS NOT DISTINCT FROM $3::integer AND NOT is_deleted ORDER BY priority DESC,pricing_rule_id LIMIT 1 FOR UPDATE`, [bookingTypeId, vehicleId, vehicleTypeId])).rows[0];
    if (id !== null && !existing) throw new PricingError("Pricing rule not found.", 404);
    const columns = Object.values(fields);
    const args = [bookingTypeId, vehicleId, vehicleTypeId, `${target} – ${input.bookingType}`.slice(0,150), ...values, input.isActive, priority, actor, emptyReturnEnabled];
    if (existing) {
      args.push(existing.pricing_rule_id);
      await client.query(`UPDATE pricing_rules SET booking_type_id=$1,vehicle_id=$2,vehicle_type_id=$3,name=$4,
        ${columns.map((column,i) => `${column}=$${i+5}`).join(",")},is_active=$18,priority=$19,updated_by=$20,empty_return_enabled=$21 WHERE pricing_rule_id=$22`, args);
      savedId = existing.pricing_rule_id;
    } else {
      const result = await client.query(`INSERT INTO pricing_rules(booking_type_id,vehicle_id,vehicle_type_id,name,${columns.join(",")},is_active,priority,created_by,empty_return_enabled,updated_by)
        VALUES(${Array.from({length:21},(_,i) => `$${i+1}`).join(",")},$20) RETURNING pricing_rule_id`, args);
      savedId = result.rows[0].pricing_rule_id;
    }
    await client.query("COMMIT");
  } catch(error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
  await logActivity({ userId: actor, action: "admin.update", entityType: "pricing_rule", entityId: savedId });
  return savedId;
}

/** Fleet Add/Edit owns the vehicle lock and transaction. Keep advanced charges unless the rate changes. */
export async function saveVehicleKmRate(db: Pool|PoolClient, vehicleId:number, rate:number, actor:string) {
  if(!Number.isFinite(rate)||rate<=0||rate>999999)throw new PricingError("Price per km must be greater than zero.");
  const current=(await db.query(`SELECT p.per_km_rate FROM pricing_rules p JOIN booking_types b USING(booking_type_id)
    WHERE p.vehicle_id=$1 AND b.code='point_to_point' AND NOT p.is_deleted AND p.is_active
    ORDER BY p.priority DESC,p.pricing_rule_id LIMIT 1`,[vehicleId])).rows[0];
  if(current&&Number(current.per_km_rate)===rate)return;
  const types=(await db.query("SELECT booking_type_id,code FROM booking_types WHERE code IN ('point_to_point','outstation','airport_transfer') ORDER BY booking_type_id")).rows;
  for(const type of types){
    await db.query("SELECT pg_advisory_xact_lock(hashtext($1))",[`pricing:${vehicleId}:${type.booking_type_id}`]);
    const existing=(await db.query(`SELECT pricing_rule_id FROM pricing_rules WHERE vehicle_id=$1 AND booking_type_id=$2 AND NOT is_deleted ORDER BY priority DESC,pricing_rule_id LIMIT 1 FOR UPDATE`,[vehicleId,type.booking_type_id])).rows[0];
    if(existing)await db.query("UPDATE pricing_rules SET per_km_rate=$1,flat_rate=0,is_active=true,updated_by=$2 WHERE pricing_rule_id=$3",[rate,actor,existing.pricing_rule_id]);
    else await db.query("INSERT INTO pricing_rules(vehicle_id,booking_type_id,name,per_km_rate,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$5)",[vehicleId,type.booking_type_id,`Car ${vehicleId} ${type.code}`,rate,actor]);
  }
}

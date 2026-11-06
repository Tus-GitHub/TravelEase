import type { PoolClient, QueryResultRow } from "pg";
import { getPool } from "./db";
import { logActivity } from "./activity-log";
import { TripError, tripUuid, validateDeparture, validateGuide, hotelCapacity, type AdminDeparture, type DepartureInput, type Guide, type StayInput } from "@/lib/weekend-trips";

export async function tripTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try { await client.query("BEGIN"); const result = await work(client); await client.query("COMMIT"); return result; }
  catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
const departureColumns = { packageId: "package_id", slug: "slug", title: "title", startsAt: "starts_at", endsAt: "ends_at", pickupCityId: "pickup_city_id", pickupAddress: "pickup_address", returnAddress: "return_address", vehicleId: "vehicle_id", driverId: "driver_id", guideId: "guide_id", capacity: "capacity", staffReservedSeats: "staff_reserved_seats", minTravellers: "min_travellers", pricePerPerson: "price_per_person", taxPercent: "tax_percent", bookingOpensAt: "booking_opens_at", bookingClosesAt: "booking_closes_at", decisionDeadline: "decision_deadline", paymentHoldMinutes: "payment_hold_minutes", content: "content", privateNotes: "private_notes", isFeatured: "is_featured", displayOrder: "display_order" } as const;
const stayColumns = { hotelName: "hotel_name", hotelAddress: "hotel_address", cityId: "city_id", imageUrl: "image_url", checkIn: "check_in", checkOut: "check_out", roomType: "room_type", roomsReserved: "rooms_reserved", occupancyPerRoom: "occupancy_per_room", staffBedsReserved: "staff_beds_reserved", mealPlan: "meal_plan", confirmationStatus: "confirmation_status", supplierReference: "supplier_reference", contactName: "contact_name", contactPhone: "contact_phone", supplierCost: "supplier_cost", publicNotes: "public_notes", privateNotes: "private_notes" } as const;
const departureKeys = Object.keys(departureColumns) as (keyof typeof departureColumns)[];
const stayKeys = Object.keys(stayColumns) as (keyof typeof stayColumns)[];
const values = (data: DepartureInput) => departureKeys.map(key => key === "content" ? JSON.stringify(data.content) : data[key]);
const iso = (value: Date | string) => new Date(value).toISOString();
export function stayFromRow(row: QueryResultRow): StayInput {
  const stay = Object.fromEntries(stayKeys.map(key => [key, row[stayColumns[key]] ?? (key === "cityId" || key === "supplierCost" ? null : "")])) as unknown as StayInput;
  return { ...stay, id: row.stay_id, checkIn: typeof row.check_in === "string" ? row.check_in : iso(row.check_in).slice(0, 10), checkOut: typeof row.check_out === "string" ? row.check_out : iso(row.check_out).slice(0, 10), supplierCost: row.supplier_cost == null ? null : Number(row.supplier_cost) };
}
export async function tripSeats(client: PoolClient | ReturnType<typeof getPool>, id: string) {
  const { rows: [row] } = await client.query(`SELECT
    COALESCE(sum(passenger_count) FILTER (WHERE status IN ('Confirmed','Ongoing','Completed')),0)::int AS confirmed,
    COALESCE(sum(passenger_count) FILTER (WHERE status='PendingPayment' AND seat_hold_expires_at > clock_timestamp()),0)::int AS held
    FROM bookings WHERE departure_id=$1 AND NOT is_deleted`, [id]);
  return row as { confirmed: number; held: number };
}
export async function lockDeparture(client: PoolClient, id: string) {
  const { rows: [row] } = await client.query("SELECT * FROM trip_departures WHERE departure_id=$1 AND NOT is_deleted FOR UPDATE", [tripUuid(id)]);
  if (!row) throw new TripError("Trip not found.", 404);
  return row;
}
export async function getAdminDeparture(id: string, db: PoolClient | ReturnType<typeof getPool> = getPool()): Promise<AdminDeparture> {
  const { rows: [row] } = await db.query(`SELECT d.*,p.name AS package_name,c.name AS pickup_city FROM trip_departures d JOIN packages p USING(package_id) JOIN cities c ON c.city_id=d.pickup_city_id WHERE d.departure_id=$1 AND NOT d.is_deleted`, [tripUuid(id)]);
  if (!row) throw new TripError("Trip not found.", 404);
  // DATE is a calendar value, not an instant. Keep it as text so the local
  // PostgreSQL parser cannot move India-midnight into the preceding UTC day.
  const stays = (await db.query("SELECT *,check_in::text AS check_in,check_out::text AS check_out FROM trip_stays WHERE departure_id=$1 AND NOT is_deleted AND is_active ORDER BY trip_stays.check_in,hotel_name,stay_id", [id])).rows.map(stayFromRow);
  const seats = await tripSeats(db, id);
  const input = Object.fromEntries(departureKeys.map(key => [key, row[departureColumns[key]]])) as unknown as DepartureInput;
  return { ...input, startsAt: iso(row.starts_at), endsAt: iso(row.ends_at), bookingOpensAt: iso(row.booking_opens_at), bookingClosesAt: iso(row.booking_closes_at), decisionDeadline: iso(row.decision_deadline), pricePerPerson: Number(row.price_per_person), taxPercent: Number(row.tax_percent), privateNotes: row.private_notes ?? "", stays, id, version: row.version, status: row.status, confirmedSeats: seats.confirmed, heldSeats: seats.held, packageName: row.package_name, pickupCity: row.pickup_city };
}
export async function listAdminDepartures() {
  return (await getPool().query(`SELECT d.departure_id AS id,d.title,d.starts_at AS "startsAt",d.ends_at AS "endsAt",d.status,d.capacity,d.price_per_person AS "pricePerPerson",d.version,
    c.name AS "pickupCity",d.content->>'imageUrl' AS "imageUrl",
    COALESCE((SELECT sum(b.passenger_count) FROM bookings b WHERE b.departure_id=d.departure_id AND NOT b.is_deleted AND (b.status IN ('Confirmed','Ongoing','Completed') OR (b.status='PendingPayment' AND b.seat_hold_expires_at>now()))),0)::int AS "reservedSeats"
    FROM trip_departures d JOIN cities c ON c.city_id=d.pickup_city_id WHERE NOT d.is_deleted ORDER BY d.starts_at DESC LIMIT 200`)).rows;
}
export interface TripOptions { packages: { id: number; name: string; mode: string; days: number; price: number; capacity: number }[]; cities: { id: number; name: string }[]; vehicles: { id: number; name: string; capacity: number }[]; drivers: { id: number; name: string }[]; guides: { id: number; name: string }[] }
export async function tripOptions(): Promise<TripOptions> {
  const db = getPool();
  const [packages, cities, vehicles, drivers, guides] = await Promise.all([
    db.query("SELECT package_id AS id,name,booking_mode AS mode,duration_days AS days,price_per_person::float8 AS price,max_persons AS capacity FROM packages WHERE NOT is_deleted AND is_active ORDER BY name"),
    db.query("SELECT city_id AS id,name FROM cities WHERE NOT is_deleted AND is_active ORDER BY name"),
    db.query("SELECT vehicle_id AS id,name,seating_capacity AS capacity FROM vehicles WHERE NOT is_deleted AND is_active ORDER BY name"),
    db.query("SELECT driver_id AS id,name FROM drivers WHERE NOT is_deleted AND is_active ORDER BY name"),
    db.query("SELECT guide_id AS id,name FROM tour_guides WHERE NOT is_deleted AND is_active ORDER BY name")]);
  return { packages: packages.rows, cities: cities.rows, vehicles: vehicles.rows, drivers: drivers.rows, guides: guides.rows };
}
export async function checkReferences(client: PoolClient, data: DepartureInput) {
  for (const [table, column, id, label] of [["packages", "package_id", data.packageId, "template"], ["cities", "city_id", data.pickupCityId, "pickup city"], ["vehicles", "vehicle_id", data.vehicleId, "vehicle"], ["drivers", "driver_id", data.driverId, "driver"], ["tour_guides", "guide_id", data.guideId, "guide"]] as const) {
    if (id == null) continue;
    if (!(await client.query(`SELECT 1 FROM ${table} WHERE ${column}=$1 AND NOT is_deleted AND is_active FOR SHARE`, [id])).rowCount) throw new TripError(`Choose an active ${label}.`);
  }
  if (data.vehicleId) {
    const vehicle = (await client.query("SELECT seating_capacity,is_available FROM vehicles WHERE vehicle_id=$1", [data.vehicleId])).rows[0];
    if (!vehicle.is_available) throw new TripError("Choose an available vehicle before assigning the trip.");
    if (data.capacity + data.staffReservedSeats > vehicle.seating_capacity) throw new TripError("Customer and staff seats exceed the vehicle capacity.");
  }
  for (const stay of data.stays) if (stay.cityId && !(await client.query("SELECT 1 FROM cities WHERE city_id=$1 AND NOT is_deleted AND is_active", [stay.cityId])).rowCount) throw new TripError("Choose an active hotel city.");
}
export async function saveDeparture(raw: unknown, actorId: string, id?: string, version?: unknown): Promise<AdminDeparture> {
  const data = validateDeparture(raw);
  const saved = await tripTransaction(async client => {
    if (id) {
      const current = await lockDeparture(client, id);
      if (current.version !== version) throw new TripError("This trip changed in another editor. Reload before saving.", 409);
      if (current.status !== "draft") throw new TripError("Close sales and return this departure to draft before changing its plan. Sold trips keep their agreed details.", 409);
    }
    await checkReferences(client, data);
    let target = id;
    if (id) await client.query(`UPDATE trip_departures SET ${departureKeys.map((key, i) => `${departureColumns[key]}=$${i + 1}`).join(",")},version=version+1,updated_by=$${departureKeys.length + 1} WHERE departure_id=$${departureKeys.length + 2}`, [...values(data), actorId, id]);
    else target = (await client.query(`INSERT INTO trip_departures (${Object.values(departureColumns).join(",")},created_by,updated_by) VALUES (${departureKeys.map((_, i) => `$${i + 1}`).join(",")},$${departureKeys.length + 1},$${departureKeys.length + 1}) RETURNING departure_id`, [...values(data), actorId])).rows[0].departure_id;
    const existing = (await client.query("SELECT stay_id FROM trip_stays WHERE departure_id=$1 AND NOT is_deleted FOR UPDATE", [target])).rows.map(row => row.stay_id as string);
    for (const stay of data.stays) {
      const parameters = stayKeys.map(key => stay[key]);
      if (stay.id) {
        if (!existing.includes(stay.id)) throw new TripError("A hotel entry belongs to a different trip.");
        await client.query(`UPDATE trip_stays SET ${stayKeys.map((key, i) => `${stayColumns[key]}=$${i + 1}`).join(",")},updated_by=$${stayKeys.length + 1} WHERE stay_id=$${stayKeys.length + 2}`, [...parameters, actorId, stay.id]);
      } else await client.query(`INSERT INTO trip_stays (${Object.values(stayColumns).join(",")},departure_id,created_by,updated_by) VALUES (${stayKeys.map((_, i) => `$${i + 1}`).join(",")},$${stayKeys.length + 1},$${stayKeys.length + 2},$${stayKeys.length + 2})`, [...parameters, target, actorId]);
    }
    const removed = existing.filter(stayId => !data.stays.some(stay => stay.id === stayId));
    if (removed.length) {
      if ((await client.query("SELECT 1 FROM trip_room_assignments WHERE stay_id=ANY($1::uuid[]) AND NOT is_deleted AND is_active LIMIT 1", [removed])).rowCount) throw new TripError("Remove room assignments before removing this hotel.", 409);
      await client.query("UPDATE trip_stays SET is_deleted=true,is_active=false,updated_by=$2 WHERE stay_id=ANY($1::uuid[])", [removed, actorId]);
    }
    return getAdminDeparture(target!, client);
  });
  await logActivity({ userId: actorId, action: id ? "trip.update" : "trip.create", entityType: "trip_departure", entityId: saved.id });
  return saved;
}
function guideFromRow(row: QueryResultRow): Guide { return { id: row.guide_id, name: row.name, phone: row.phone, imageUrl: row.image_url ?? "", bio: row.bio, languages: row.languages, privateNotes: row.private_notes ?? "", isActive: row.is_active }; }
export async function listGuides(): Promise<Guide[]> { return (await getPool().query("SELECT guide_id,name,phone,image_url,bio,languages,private_notes,is_active FROM tour_guides WHERE NOT is_deleted ORDER BY name")).rows.map(guideFromRow); }
export async function saveGuide(raw: unknown, actorId: string, id?: number): Promise<Guide> {
  const guide = validateGuide(raw);
  const result = await tripTransaction(async client => {
    if (id) {
      if (!(await client.query("SELECT guide_id FROM tour_guides WHERE guide_id=$1 AND NOT is_deleted FOR UPDATE", [id])).rowCount) throw new TripError("Guide not found.", 404);
      if (!guide.isActive && (await client.query("SELECT 1 FROM trip_departures WHERE guide_id=$1 AND NOT is_deleted AND status IN ('open','guaranteed','closed','ongoing') LIMIT 1", [id])).rowCount) throw new TripError("This guide is assigned to an operating trip. Resolve that assignment first.", 409);
    }
    const params = [guide.name, guide.phone, guide.imageUrl || null, guide.bio, JSON.stringify(guide.languages), guide.privateNotes, guide.isActive, actorId];
    return guideFromRow((await client.query(id ? "UPDATE tour_guides SET name=$1,phone=$2,image_url=$3,bio=$4,languages=$5,private_notes=$6,is_active=$7,updated_by=$8 WHERE guide_id=$9 RETURNING *" : "INSERT INTO tour_guides(name,phone,image_url,bio,languages,private_notes,is_active,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$8) RETURNING *", id ? [...params, id] : params)).rows[0]);
  });
  await logActivity({ userId: actorId, action: id ? "guide.update" : "guide.create", entityType: "tour_guide", entityId: String(result.id) });
  return result;
}
export function assertTripReady(data: AdminDeparture) {
  if (!data.vehicleId || !data.driverId || !data.guideId) throw new TripError("Assign a vehicle, driver and guide before opening bookings.");
  if (Date.parse(data.bookingClosesAt) <= Date.now()) throw new TripError("The booking window has already closed.");
  if (!data.content.summary || !data.content.description || !data.content.imageUrl || !data.content.inclusions.length) throw new TripError("Add a cover photo, introduction, description and inclusions before publishing.");
  if (hotelCapacity(data.content.stayNights, data.stays) < data.capacity) throw new TripError("Confirm enough hotel beds for every included night before opening bookings.");
}

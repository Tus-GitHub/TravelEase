import { getPool } from "../db";
import { applyPartialUpdate, softDelete } from "./_util";

/** Admin driver roster (chunk 2.9). Booking assignment lives in admin/bookings.ts. */

export interface AdminDriver {
  id: number;
  name: string;
  phone: string;
  licenceNumber: string;
  note: string;
  isActive: boolean;
  activeBookings: number;
}

interface Row {
  driver_id: number;
  name: string;
  phone: string;
  licence_number: string | null;
  note: string | null;
  is_active: boolean;
  active_bookings: number;
}

const toDriver = (r: Row): AdminDriver => ({
  id: r.driver_id,
  name: r.name,
  phone: r.phone,
  licenceNumber: r.licence_number ?? "",
  note: r.note ?? "",
  isActive: r.is_active,
  activeBookings: Number(r.active_bookings),
});

const SELECT = `
  SELECT d.driver_id, d.name, d.phone, d.licence_number, d.note, d.is_active,
         (SELECT count(*) FROM bookings b
            WHERE b.driver_id = d.driver_id
              AND b.status IN ('Confirmed','Ongoing')) AS active_bookings
  FROM drivers d
`;

export async function listDrivers(): Promise<AdminDriver[]> {
  const r = await getPool().query(
    `${SELECT} WHERE d.is_deleted = false ORDER BY d.name`,
  );
  return r.rows.map(toDriver);
}

async function getDriver(id: number): Promise<AdminDriver | null> {
  const r = await getPool().query(
    `${SELECT} WHERE d.driver_id = $1 AND d.is_deleted = false`,
    [id],
  );
  return r.rows[0] ? toDriver(r.rows[0]) : null;
}

export interface DriverInput {
  name: string;
  phone: string;
  licenceNumber?: string;
  note?: string;
}

export type CreateResult =
  | { ok: true; driver: AdminDriver }
  | { ok: false; message: string };

export async function createDriver(
  input: DriverInput,
  actorId: string,
): Promise<CreateResult> {
  const name = (input.name ?? "").trim();
  const phone = (input.phone ?? "").trim();
  if (name.length < 2) return { ok: false, message: "Name is required." };
  if (phone.length < 6) return { ok: false, message: "A phone number is required." };

  const r = await getPool().query(
    `INSERT INTO drivers (name, phone, licence_number, note, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $5) RETURNING driver_id`,
    [name, phone, input.licenceNumber?.trim() || null, input.note?.trim() || null, actorId],
  );
  return { ok: true, driver: (await getDriver(r.rows[0].driver_id))! };
}

const COLUMNS = {
  name: "name",
  phone: "phone",
  licenceNumber: "licence_number",
  note: "note",
  isActive: "is_active",
} as const;

export async function updateDriver(
  id: number,
  input: Record<string, unknown>,
  actorId: string,
): Promise<AdminDriver | null> {
  const ok = await applyPartialUpdate("drivers", "driver_id", id, input, COLUMNS, actorId);
  return ok ? getDriver(id) : null;
}

export function deleteDriver(id: number, actorId: string): Promise<boolean> {
  return softDelete("drivers", "driver_id", id, actorId);
}

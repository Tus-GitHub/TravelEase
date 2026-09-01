import type { PoolClient } from "pg";
import { getPool } from "./db";

/**
 * Vehicle availability (chunk 2.6, plan.md §37). A vehicle is unavailable for a
 * window if any non-deleted `vehicle_availability` row overlaps it. `[a,b)` and
 * `[c,d)` overlap iff `a < d AND c < b`.
 */

export type AvailabilityKind = "blocked" | "maintenance" | "booked";

export interface AvailabilityBlock {
  id: number;
  vehicleId: number;
  startsAt: string;
  endsAt: string;
  kind: AvailabilityKind;
  bookingId: string | null;
  note: string | null;
}

interface Row {
  vehicle_availability_id: number;
  vehicle_id: number;
  starts_at: Date;
  ends_at: Date;
  kind: AvailabilityKind;
  booking_id: string | null;
  note: string | null;
}

const toBlock = (r: Row): AvailabilityBlock => ({
  id: r.vehicle_availability_id,
  vehicleId: r.vehicle_id,
  startsAt: new Date(r.starts_at).toISOString(),
  endsAt: new Date(r.ends_at).toISOString(),
  kind: r.kind,
  bookingId: r.booking_id,
  note: r.note,
});

/** Derive a trip's [start, end) window from whatever the booking carries. */
export function bookingWindow(args: {
  startDateTime: Date;
  endDateTime?: Date | null;
  durationDays?: number | null;
  estimatedHours?: number | null;
}): { start: Date; end: Date } {
  const start = args.startDateTime;
  if (args.endDateTime && args.endDateTime > start) {
    return { start, end: args.endDateTime };
  }
  let ms = 24 * 3_600_000; // sensible default: one day
  if (args.durationDays && args.durationDays > 0) ms = args.durationDays * 24 * 3_600_000;
  else if (args.estimatedHours && args.estimatedHours > 0) ms = args.estimatedHours * 3_600_000;
  return { start, end: new Date(start.getTime() + ms) };
}

/** True if `vehicleId` has any block overlapping [start, end), ignoring `exceptBookingId`. */
export async function hasConflict(
  vehicleId: number,
  start: Date,
  end: Date,
  exceptBookingId?: string | null,
): Promise<boolean> {
  const r = await getPool().query(
    `SELECT 1 FROM vehicle_availability
      WHERE vehicle_id = $1 AND is_deleted = false
        AND starts_at < $3 AND $2 < ends_at
        AND ($4::uuid IS NULL OR booking_id IS DISTINCT FROM $4)
      LIMIT 1`,
    [vehicleId, start.toISOString(), end.toISOString(), exceptBookingId ?? null],
  );
  return (r.rowCount ?? 0) > 0;
}

/** Vehicle ids with any block overlapping [start, end) — for the public list filter. */
export async function unavailableVehicleIds(start: Date, end: Date): Promise<number[]> {
  const r = await getPool().query(
    `SELECT DISTINCT vehicle_id FROM vehicle_availability
      WHERE is_deleted = false AND starts_at < $2 AND $1 < ends_at`,
    [start.toISOString(), end.toISOString()],
  );
  return r.rows.map((x) => x.vehicle_id as number);
}

/** Insert a block. Pass a txn client when called from a booking transition. */
export async function addBlock(
  db: PoolClient | ReturnType<typeof getPool>,
  args: {
    vehicleId: number;
    start: Date;
    end: Date;
    kind: AvailabilityKind;
    bookingId?: string | null;
    note?: string | null;
    actorId?: string | null;
  },
): Promise<void> {
  await db.query(
    `INSERT INTO vehicle_availability
       (vehicle_id, starts_at, ends_at, kind, booking_id, note, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $7)`,
    [
      args.vehicleId,
      args.start.toISOString(),
      args.end.toISOString(),
      args.kind,
      args.bookingId ?? null,
      args.note ?? null,
      args.actorId ?? null,
    ],
  );
}

/** Soft-delete the 'booked' block(s) for a booking (on cancel). */
export async function releaseBookingBlock(
  db: PoolClient | ReturnType<typeof getPool>,
  bookingId: string,
  actorId?: string | null,
): Promise<void> {
  await db.query(
    `UPDATE vehicle_availability SET is_deleted = true, updated_by = $2
      WHERE booking_id = $1 AND is_deleted = false`,
    [bookingId, actorId ?? null],
  );
}

// ─── Admin ─────────────────────────────────────────────────────────────────

export async function listBlocks(vehicleId: number): Promise<AvailabilityBlock[]> {
  const r = await getPool().query(
    `SELECT * FROM vehicle_availability
      WHERE vehicle_id = $1 AND is_deleted = false
      ORDER BY starts_at`,
    [vehicleId],
  );
  return r.rows.map(toBlock);
}

export type AdminBlockResult =
  | { ok: true; block: AvailabilityBlock }
  | { ok: false; message: string };

export async function createAdminBlock(
  vehicleId: number,
  input: { startsAt: string; endsAt: string; kind: "blocked" | "maintenance"; note?: string },
  actorId: string,
): Promise<AdminBlockResult> {
  const start = new Date(input.startsAt);
  const end = new Date(input.endsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return { ok: false, message: "Give a valid start and end, end after start." };
  }
  if (input.kind !== "blocked" && input.kind !== "maintenance") {
    return { ok: false, message: "Kind must be 'blocked' or 'maintenance'." };
  }
  const r = await getPool().query(
    `INSERT INTO vehicle_availability
       (vehicle_id, starts_at, ends_at, kind, note, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $6)
     RETURNING *`,
    [vehicleId, start.toISOString(), end.toISOString(), input.kind, input.note?.trim() || null, actorId],
  );
  return { ok: true, block: toBlock(r.rows[0]) };
}

export async function deleteAdminBlock(blockId: number, actorId: string): Promise<boolean> {
  const r = await getPool().query(
    `UPDATE vehicle_availability SET is_deleted = true, updated_by = $2
      WHERE vehicle_availability_id = $1 AND is_deleted = false AND kind <> 'booked'`,
    [blockId, actorId],
  );
  return (r.rowCount ?? 0) > 0;
}

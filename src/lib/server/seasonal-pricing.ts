import { getPool } from "./db";
import { applyPartialUpdate, softDelete } from "./admin/_util";

/**
 * Seasonal pricing (chunk 2.8, plan.md §37). A date-range multiplier that the
 * quote/booking flow applies to the pre-discount subtotal for a trip whose
 * start date falls in the window. Resolution: a NULL booking_type/vehicle_type
 * matches anything; most specific first, then highest `priority`.
 */

export interface SeasonMatch {
  id: number;
  name: string;
  multiplier: number;
}

/** Best-matching active season for `tripDate` (a Date). Null when none applies. */
export async function resolveSeason(
  tripDate: Date,
  bookingTypeId: number | null,
  vehicleTypeId: number | null,
): Promise<SeasonMatch | null> {
  if (Number.isNaN(tripDate.getTime())) return null;
  const day = tripDate.toISOString().slice(0, 10); // YYYY-MM-DD

  const r = await getPool().query(
    `SELECT seasonal_pricing_id, name, multiplier
       FROM seasonal_pricing
      WHERE is_deleted = false AND is_active = true
        AND starts_on <= $1 AND ends_on >= $1
        AND (booking_type_id IS NULL OR booking_type_id = $2)
        AND (vehicle_type_id IS NULL OR vehicle_type_id = $3)
      ORDER BY (booking_type_id IS NOT NULL)::int + (vehicle_type_id IS NOT NULL)::int DESC,
               priority DESC, seasonal_pricing_id ASC
      LIMIT 1`,
    [day, bookingTypeId, vehicleTypeId],
  );
  const row = r.rows[0];
  if (!row) return null;
  return { id: row.seasonal_pricing_id, name: row.name, multiplier: Number(row.multiplier) };
}

// ─── Admin ─────────────────────────────────────────────────────────────────

export interface AdminSeason {
  id: number;
  name: string;
  startsOn: string;
  endsOn: string;
  bookingTypeId: number | null;
  vehicleTypeId: number | null;
  multiplier: number;
  priority: number;
  isActive: boolean;
}

interface Row {
  seasonal_pricing_id: number;
  name: string;
  starts_on: string;
  ends_on: string;
  booking_type_id: number | null;
  vehicle_type_id: number | null;
  multiplier: string;
  priority: number;
  is_active: boolean;
}

const toSeason = (r: Row): AdminSeason => ({
  id: r.seasonal_pricing_id,
  name: r.name,
  startsOn: r.starts_on,
  endsOn: r.ends_on,
  bookingTypeId: r.booking_type_id,
  vehicleTypeId: r.vehicle_type_id,
  multiplier: Number(r.multiplier),
  priority: r.priority,
  isActive: r.is_active,
});

const SELECT = `
  SELECT seasonal_pricing_id, name, starts_on, ends_on, booking_type_id,
         vehicle_type_id, multiplier, priority, is_active
  FROM seasonal_pricing
`;

export async function listSeasons(): Promise<AdminSeason[]> {
  const r = await getPool().query(
    `${SELECT} WHERE is_deleted = false ORDER BY starts_on DESC, seasonal_pricing_id DESC`,
  );
  return r.rows.map(toSeason);
}

async function getSeason(id: number): Promise<AdminSeason | null> {
  const r = await getPool().query(
    `${SELECT} WHERE seasonal_pricing_id = $1 AND is_deleted = false`,
    [id],
  );
  return r.rows[0] ? toSeason(r.rows[0]) : null;
}

export interface SeasonInput {
  name: string;
  startsOn: string;
  endsOn: string;
  bookingTypeId?: number | null;
  vehicleTypeId?: number | null;
  multiplier: number;
  priority?: number;
}

export type CreateResult =
  | { ok: true; season: AdminSeason }
  | { ok: false; message: string };

export async function createSeason(
  input: SeasonInput,
  actorId: string,
): Promise<CreateResult> {
  const name = (input.name ?? "").trim();
  if (name.length < 2) return { ok: false, message: "Name is required." };
  const s = new Date(input.startsOn);
  const e = new Date(input.endsOn);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e < s) {
    return { ok: false, message: "Give a valid start and end date, end on or after start." };
  }
  const mult = Number(input.multiplier);
  if (!Number.isFinite(mult) || mult <= 0) {
    return { ok: false, message: "Multiplier must be a positive number (e.g. 1.25)." };
  }

  const r = await getPool().query(
    `INSERT INTO seasonal_pricing
       (name, starts_on, ends_on, booking_type_id, vehicle_type_id, multiplier,
        priority, created_by, updated_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8)
     RETURNING seasonal_pricing_id`,
    [
      name,
      input.startsOn.slice(0, 10),
      input.endsOn.slice(0, 10),
      input.bookingTypeId ?? null,
      input.vehicleTypeId ?? null,
      mult,
      Math.floor(Number(input.priority) || 0),
      actorId,
    ],
  );
  return { ok: true, season: (await getSeason(r.rows[0].seasonal_pricing_id))! };
}

const COLUMNS = {
  name: "name",
  startsOn: "starts_on",
  endsOn: "ends_on",
  bookingTypeId: "booking_type_id",
  vehicleTypeId: "vehicle_type_id",
  multiplier: "multiplier",
  priority: "priority",
  isActive: "is_active",
} as const;

export async function updateSeason(
  id: number,
  input: Partial<SeasonInput & { isActive: boolean }>,
  actorId: string,
): Promise<AdminSeason | null> {
  const ok = await applyPartialUpdate(
    "seasonal_pricing",
    "seasonal_pricing_id",
    id,
    input,
    COLUMNS,
    actorId,
  );
  return ok ? getSeason(id) : null;
}

export function deleteSeason(id: number, actorId: string): Promise<boolean> {
  return softDelete("seasonal_pricing", "seasonal_pricing_id", id, actorId);
}

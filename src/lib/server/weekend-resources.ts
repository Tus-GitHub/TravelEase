import type { Pool, PoolClient } from "pg";
import { TripError } from "@/lib/weekend-trips";
import { DependentRowsError } from "./db-errors";
import { getPool } from "./db";
/** Prevent existing fleet editors from invalidating a published group reservation.
 * Resource lock only; the departure query deliberately doesn't invert lock order. */
export async function protectedResourceMutation<T>(table: string, id: number, input: Record<string,unknown>, work: (db: Pool | PoolClient) => Promise<T>): Promise<T> {
  if (table !== 'vehicles' && table !== 'drivers') return work(getPool());
  const db=await getPool().connect(), column=table === 'vehicles' ? 'vehicle_id' : 'driver_id';
  try {
    await db.query('BEGIN');
    await db.query(`SELECT 1 FROM ${table} WHERE ${column}=$1 FOR UPDATE`,[id]);
    const trips=(await db.query(`SELECT capacity+staff_reserved_seats AS needed FROM trip_departures WHERE ${column}=$1 AND NOT is_deleted AND status IN ('open','guaranteed','closed','ongoing')`,[id])).rows;
    if (trips.length && (input.isDeleted === true || input.isActive === false || input.isAvailable === false || (typeof input.seatingCapacity === 'number' && trips.some(t=>(input.seatingCapacity as number) < t.needed)))) throw new DependentRowsError('This resource is reserved for a Weekend Trip. Resolve the departure before removing it or reducing its availability/capacity.');
    const result=await work(db); await db.query('COMMIT'); return result;
  } catch(error) { await db.query('ROLLBACK'); throw error; } finally { db.release(); }
}
/** All assignment writers lock the driver before checking private/shared windows. */
export async function assertDriverWindow(client: PoolClient, driverId: number, start: Date, end: Date, exceptBooking?: string, exceptDeparture?: string) {
  if (!(await client.query("SELECT driver_id FROM drivers WHERE driver_id=$1 AND NOT is_deleted AND is_active FOR UPDATE", [driverId])).rowCount) throw new TripError("Choose an active driver.");
  const conflict = await client.query(`SELECT 1 FROM trip_departures WHERE driver_id=$1 AND NOT is_deleted AND status IN ('open','guaranteed','closed','ongoing')
    AND starts_at<$3 AND $2<ends_at AND ($4::uuid IS NULL OR departure_id<>$4)
    UNION ALL SELECT 1 FROM bookings WHERE driver_id=$1 AND NOT is_deleted AND departure_id IS NULL AND status IN ('Confirmed','Ongoing')
    AND start_datetime<$3 AND $2<(CASE WHEN end_datetime>start_datetime THEN end_datetime
      WHEN duration_days>0 THEN start_datetime+duration_days*interval '1 day'
      WHEN estimated_hours>0 THEN start_datetime+estimated_hours*interval '1 hour'
      ELSE start_datetime+interval '1 day' END)
    AND ($5::uuid IS NULL OR booking_id<>$5) LIMIT 1`, [driverId,start,end,exceptDeparture ?? null,exceptBooking ?? null]);
  if (conflict.rowCount) throw new TripError("This driver already has a trip during those dates.",409);
}

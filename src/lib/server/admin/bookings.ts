import { getPool } from "../db";
import type { PublicUser } from "../users";
import {
  transitionBooking,
  type BookingStatus,
  type TransitionResult,
} from "../bookings";
import { notifyDriverAssigned } from "../notifications";

/**
 * Admin view of bookings (plan.md §36 chunk 1.13). Status changes still go
 * through `transitionBooking()` in `../bookings` — this module only adds the
 * admin-only reads and agent assignment.
 */

export interface AdminBookingRow {
  id: string;
  reference: string;
  status: BookingStatus;
  bookingTypeCode: string;
  startDateTime: string;
  totalAmount: number;
  currency: string;
  createdAt: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  assignedAgentUserId: string | null;
  assignedAgentName: string | null;
  vehicleTypeTitle: string | null;
  packageName: string | null;
  pickupAddress: string | null;
  dropAddress: string | null;
  passengerCount: number;
  customerNotes: string | null;
  refund: {
    amount: number;
    chargeAmount: number;
    tier: string;
    status: "pending" | "paid" | "waived";
    method: string | null;
    reference: string | null;
  } | null;
  driverId: number | null;
  driverName: string | null;
  driverPhone: string | null;
}

const ADMIN_SELECT = `
  SELECT b.booking_id, b.booking_reference, b.status, bt.code AS booking_type_code,
         b.start_datetime, b.total_amount, b.currency, b.created_at,
         cu.name AS customer_name, cu.email AS customer_email, cu.phone AS customer_phone,
         b.assigned_agent_user_id, ag.name AS agent_name,
         vt.title AS vehicle_type_title, p.name AS package_name,
         b.pickup_address, b.drop_address, b.passenger_count, b.customer_notes,
         rf.amount AS refund_amount, rf.charge_amount AS refund_charge,
         rf.tier AS refund_tier, rf.status AS refund_status,
         rf.method AS refund_method, rf.reference AS refund_reference,
         b.driver_id, dr.name AS driver_name, dr.phone AS driver_phone
  FROM bookings b
  JOIN booking_types bt ON bt.booking_type_id = b.booking_type_id
  JOIN users cu ON cu.user_id = b.user_id
  LEFT JOIN users ag ON ag.user_id = b.assigned_agent_user_id
  LEFT JOIN vehicle_types vt ON vt.vehicle_type_id = b.vehicle_type_id
  LEFT JOIN packages p ON p.package_id = b.package_id
  LEFT JOIN refunds rf ON rf.booking_id = b.booking_id
  LEFT JOIN drivers dr ON dr.driver_id = b.driver_id
  WHERE b.is_deleted = false`;

function toRow(r: Record<string, unknown>): AdminBookingRow {
  return {
    id: r.booking_id as string,
    reference: r.booking_reference as string,
    status: r.status as BookingStatus,
    bookingTypeCode: r.booking_type_code as string,
    startDateTime: (r.start_datetime as Date).toISOString(),
    totalAmount: Number(r.total_amount),
    currency: r.currency as string,
    createdAt: (r.created_at as Date).toISOString(),
    customerName: r.customer_name as string,
    customerEmail: r.customer_email as string,
    customerPhone: r.customer_phone as string,
    assignedAgentUserId: (r.assigned_agent_user_id as string) ?? null,
    assignedAgentName: (r.agent_name as string) ?? null,
    vehicleTypeTitle: (r.vehicle_type_title as string) ?? null,
    packageName: (r.package_name as string) ?? null,
    pickupAddress: (r.pickup_address as string) ?? null,
    dropAddress: (r.drop_address as string) ?? null,
    passengerCount: r.passenger_count as number,
    customerNotes: (r.customer_notes as string) ?? null,
    refund:
      r.refund_amount != null
        ? {
            amount: Number(r.refund_amount),
            chargeAmount: Number(r.refund_charge),
            tier: r.refund_tier as string,
            status: r.refund_status as "pending" | "paid" | "waived",
            method: (r.refund_method as string) ?? null,
            reference: (r.refund_reference as string) ?? null,
          }
        : null,
    driverId: (r.driver_id as number) ?? null,
    driverName: (r.driver_name as string) ?? null,
    driverPhone: (r.driver_phone as string) ?? null,
  };
}

/** Assign (or clear, with null) the driver on a booking. Admin only. */
export async function assignBookingDriver(
  bookingId: string,
  driverId: number | null,
  actorId: string,
): Promise<AssignResult> {
  const pool = getPool();
  const b = await pool.query(
    `SELECT status FROM bookings WHERE booking_id = $1 AND is_deleted = false`,
    [bookingId],
  );
  if (!b.rowCount) return { ok: false, status: 404, message: "Booking not found." };

  if (driverId !== null) {
    const d = await pool.query(
      `SELECT 1 FROM drivers WHERE driver_id = $1 AND is_deleted = false AND is_active = true`,
      [driverId],
    );
    if (!d.rowCount) {
      return { ok: false, status: 400, message: "That driver doesn't exist or is inactive." };
    }
  }

  await pool.query(
    `UPDATE bookings SET driver_id = $1, updated_by = $2 WHERE booking_id = $3`,
    [driverId, actorId, bookingId],
  );

  // Tell the customer once the trip is Confirmed or later.
  if (
    driverId !== null &&
    ["Confirmed", "Ongoing"].includes(b.rows[0].status as string)
  ) {
    await notifyDriverAssigned(bookingId);
  }
  return { ok: true };
}

export async function listAdminBookings(status?: string): Promise<AdminBookingRow[]> {
  const params: unknown[] = [];
  let sql = ADMIN_SELECT;
  if (status) {
    params.push(status);
    sql += ` AND b.status = $1`;
  }
  sql += ` ORDER BY b.created_at DESC`;
  const result = await getPool().query(sql, params);
  return result.rows.map(toRow);
}

export async function getAdminBooking(id: string): Promise<AdminBookingRow | null> {
  const result = await getPool().query(`${ADMIN_SELECT} AND b.booking_id = $1`, [id]);
  return result.rows[0] ? toRow(result.rows[0]) : null;
}

/** Admin status change — delegates to the state machine with the admin actor. */
export function adminTransition(
  bookingId: string,
  toStatus: BookingStatus,
  admin: PublicUser,
  reason?: string,
  refundInitiatedBy?: "customer" | "operator",
): Promise<TransitionResult> {
  return transitionBooking({ bookingId, toStatus, user: admin, reason, refundInitiatedBy });
}

export { settleRefund } from "../refunds";

export type AssignResult =
  | { ok: true }
  | { ok: false; status: number; message: string };

/** Assign (or clear, with null) the agent on a booking. Admin only. */
export async function assignBookingAgent(
  bookingId: string,
  agentUserId: string | null,
  actorId: string,
): Promise<AssignResult> {
  const pool = getPool();
  const booking = await pool.query(
    `SELECT 1 FROM bookings WHERE booking_id = $1 AND is_deleted = false`,
    [bookingId],
  );
  if (!booking.rowCount) {
    return { ok: false, status: 404, message: "Booking not found." };
  }

  if (agentUserId !== null) {
    const agent = await pool.query(
      `SELECT 1 FROM users u JOIN roles r ON r.role_id = u.role_id
        WHERE u.user_id = $1 AND u.is_deleted = false AND r.name = 'agent'`,
      [agentUserId],
    );
    if (!agent.rowCount) {
      return { ok: false, status: 400, message: "That user isn't an agent." };
    }
  }

  await pool.query(
    `UPDATE bookings SET assigned_agent_user_id = $1, updated_by = $2 WHERE booking_id = $3`,
    [agentUserId, actorId, bookingId],
  );
  return { ok: true };
}

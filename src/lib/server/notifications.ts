import { getPool } from "./db";
import {
  sendBookingConfirmation,
  sendBookingCancellation,
  sendBookingStatusUpdate,
  appOrigin,
  type BookingEmailInfo,
} from "./email";
import { getRefundForBooking } from "./refunds";
import type { BookingStatus } from "@/lib/bookingStatus";

/**
 * Notification orchestration (plan.md §23, chunk 2.2). Turns a booking event
 * into an email + a `notifications` log row. Every function here is
 * **non-blocking**: a transport or DB failure is logged and swallowed, never
 * thrown back to the booking flow that called it.
 */

type NotificationKind =
  | "booking.confirmation"
  | "booking.cancellation"
  | "booking.status";

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const when = (d: Date) =>
  d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
const tripLabel = (code: string) =>
  code.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

// Statuses that trigger a customer-facing "status update" email.
const STATUS_LABELS: Partial<Record<BookingStatus, string>> = {
  Confirmed: "Confirmed",
  Ongoing: "Ongoing",
  Completed: "Completed",
};

interface BookingRow {
  booking_id: string;
  booking_reference: string;
  start_datetime: Date;
  total_amount: string;
  passenger_count: number;
  type_code: string;
  owner_user_id: string;
  owner_email: string;
  itinerary: string | null;
}

async function loadBookingRow(bookingId: string): Promise<BookingRow | null> {
  const result = await getPool().query(
    `SELECT b.booking_id, b.booking_reference, b.start_datetime, b.total_amount,
            b.passenger_count, bt.code AS type_code,
            u.user_id AS owner_user_id, u.email AS owner_email,
            (SELECT string_agg(COALESCE(ts.name, bs.custom_label, 'Stop'), ' → '
                               ORDER BY bs.stop_order)
               FROM booking_stops bs
               LEFT JOIN tourist_spots ts ON ts.tourist_spot_id = bs.tourist_spot_id
              WHERE bs.booking_id = b.booking_id) AS itinerary
       FROM bookings b
       JOIN booking_types bt ON bt.booking_type_id = b.booking_type_id
       JOIN users u ON u.user_id = b.user_id
      WHERE b.booking_id = $1`,
    [bookingId],
  );
  return result.rows[0] ?? null;
}

function toEmailInfo(row: BookingRow): BookingEmailInfo {
  return {
    reference: row.booking_reference,
    tripType: tripLabel(row.type_code),
    startsAt: when(new Date(row.start_datetime)),
    passengers: row.passenger_count,
    total: inr(Number(row.total_amount)),
    itinerary: row.itinerary ?? undefined,
    url: `${appOrigin()}/profile/bookings/${row.booking_id}`,
  };
}

async function log(
  row: BookingRow,
  kind: NotificationKind,
  subject: string,
  error?: string,
): Promise<void> {
  try {
    await getPool().query(
      `INSERT INTO notifications
         (user_id, booking_id, channel, kind, recipient, subject, status, error)
       VALUES ($1, $2, 'email', $3, $4, $5, $6, $7)`,
      [
        row.owner_user_id,
        row.booking_id,
        kind,
        row.owner_email,
        subject.slice(0, 300),
        error ? "failed" : "sent",
        error ? error.slice(0, 500) : null,
      ],
    );
  } catch (err) {
    console.error("notifications: could not write log row", err);
  }
}

/** Fired after a booking is created (createBooking). */
export async function notifyBookingCreated(bookingId: string): Promise<void> {
  let row: BookingRow | null = null;
  try {
    row = await loadBookingRow(bookingId);
    if (!row) return;
    const subject = `Booking received — ${row.booking_reference}`;
    try {
      await sendBookingConfirmation(row.owner_email, toEmailInfo(row));
      await log(row, "booking.confirmation", subject);
    } catch (err) {
      console.error("notifyBookingCreated: send failed", err);
      await log(row, "booking.confirmation", subject, String(err));
    }
  } catch (err) {
    console.error("notifyBookingCreated: unexpected", err);
  }
}

/** Fired after a status transition (transitionBooking). */
export async function notifyBookingStatusChanged(
  bookingId: string,
  _from: BookingStatus,
  to: BookingStatus,
): Promise<void> {
  if (to !== "Cancelled" && !STATUS_LABELS[to]) return; // no email for this transition

  try {
    const row = await loadBookingRow(bookingId);
    if (!row) return;
    const info = toEmailInfo(row);

    if (to === "Cancelled") {
      const subject = `Booking cancelled — ${row.booking_reference}`;
      const refund = await getRefundForBooking(bookingId);
      const refundNote = refund
        ? refund.amount > 0
          ? `A refund of ${inr(refund.amount)} is being processed.`
          : "No refund is due under our cancellation policy."
        : undefined;
      try {
        await sendBookingCancellation(row.owner_email, info, refundNote);
        await log(row, "booking.cancellation", subject);
      } catch (err) {
        console.error("notifyBookingStatusChanged: cancel send failed", err);
        await log(row, "booking.cancellation", subject, String(err));
      }
      return;
    }

    const label = STATUS_LABELS[to]!;
    const subject = `Booking ${label.toLowerCase()} — ${row.booking_reference}`;
    try {
      await sendBookingStatusUpdate(row.owner_email, info, label);
      await log(row, "booking.status", subject);
    } catch (err) {
      console.error("notifyBookingStatusChanged: status send failed", err);
      await log(row, "booking.status", subject, String(err));
    }
  } catch (err) {
    console.error("notifyBookingStatusChanged: unexpected", err);
  }
}

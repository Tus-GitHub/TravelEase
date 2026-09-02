import { randomBytes } from "crypto";
import { getPool } from "./db";
import type { PublicUser } from "./users";
import {
  calculatePrice,
  type BookingTypeCode,
  type PriceBreakdown,
  type TripInput,
} from "./pricing";
import { resolveBookingTypeId, resolvePricingRule } from "./pricing-rules";
import {
  notifyBookingCreated,
  notifyBookingStatusChanged,
} from "./notifications";
import { validateCoupon, recordRedemption } from "./coupons";
import {
  createCancellationRefund,
  getRefundForBooking,
  refundIsClearForBooking,
  type RefundView,
} from "./refunds";
import {
  bookingWindow,
  hasConflict,
  addBlock,
  releaseBookingBlock,
} from "./availability";
import { getReviewForBooking, type ReviewView } from "./reviews";
import { canTransition, type BookingActor, type BookingStatus } from "@/lib/bookingStatus";
import type { CancelInitiator } from "@/lib/refund";

/**
 * Booking domain (plan.md §8, §15–18, §26, §33). One place owns the lifecycle:
 * `transitionBooking()` is the ONLY way a status changes after creation — never
 * `UPDATE bookings SET status = …` from anywhere else. Every change writes a
 * `booking_status_history` row. The pure state-machine (`canTransition`,
 * `allowedTransitions`, `TRANSITIONS`) lives in `@/lib/bookingStatus` so client
 * code can share it; re-exported here for existing importers.
 */

export {
  canTransition,
  allowedTransitions,
  TRANSITIONS,
  type BookingActor,
  type BookingStatus,
} from "@/lib/bookingStatus";

function actorFor(
  user: PublicUser,
  row: { user_id: string; assigned_agent_user_id: string | null },
): BookingActor | null {
  if (user.role === "admin") return "admin";
  if (user.role === "agent" && row.assigned_agent_user_id === user.id) return "agent";
  if (row.user_id === user.id) return "customer";
  return null;
}

// ─── Transition ─────────────────────────────────────────────────────────────

export type TransitionResult =
  | { ok: true; status: BookingStatus }
  | {
      ok: false;
      code: "not_found" | "forbidden" | "invalid_transition";
      message: string;
    };

export async function transitionBooking(input: {
  bookingId: string;
  toStatus: BookingStatus;
  user: PublicUser;
  reason?: string;
  /** Cancellation refund policy input (§7). Defaults to "customer" (policy
   *  applies); pass "operator" for a Jagdamba-initiated full refund. */
  refundInitiatedBy?: CancelInitiator;
}): Promise<TransitionResult> {
  const pool = getPool();
  const row = (
    await pool.query(
      `SELECT user_id, assigned_agent_user_id, status, total_amount, start_datetime,
              vehicle_id, end_datetime, duration_days, estimated_hours
         FROM bookings WHERE booking_id = $1 AND is_deleted = false`,
      [input.bookingId],
    )
  ).rows[0];
  if (!row) return { ok: false, code: "not_found", message: "Booking not found." };

  const actor = actorFor(input.user, row);
  if (!actor) {
    return { ok: false, code: "forbidden", message: "You can't change this booking." };
  }

  const from = row.status as BookingStatus;
  if (from === input.toStatus) {
    return {
      ok: false,
      code: "invalid_transition",
      message: `Booking is already ${from}.`,
    };
  }
  if (!canTransition(from, input.toStatus, actor)) {
    return {
      ok: false,
      code: "invalid_transition",
      message: `A ${from} booking can't move to ${input.toStatus}.`,
    };
  }

  // A paid booking can't be marked Refunded until its refund record is settled.
  if (input.toStatus === "Refunded" && !(await refundIsClearForBooking(input.bookingId))) {
    return {
      ok: false,
      code: "invalid_transition",
      message: "Settle the refund (mark it paid or waived) before marking this booking Refunded.",
    };
  }

  // Cancelling a paid booking records what's owed back (§7).
  const recordsRefund =
    input.toStatus === "Cancelled" && (from === "Confirmed" || from === "Ongoing");

  // Availability (chunk 2.6) — a specific vehicle gets a 'booked' block on
  // confirmation, released on cancel.
  const win = bookingWindow({
    startDateTime: new Date(row.start_datetime),
    endDateTime: row.end_datetime ? new Date(row.end_datetime) : null,
    durationDays: row.duration_days,
    estimatedHours: row.estimated_hours != null ? Number(row.estimated_hours) : null,
  });
  const blocksVehicle =
    input.toStatus === "Confirmed" && from === "PendingPayment" && row.vehicle_id != null;
  const releasesVehicle =
    input.toStatus === "Cancelled" &&
    (from === "Confirmed" || from === "Ongoing") &&
    row.vehicle_id != null;

  if (blocksVehicle && (await hasConflict(row.vehicle_id, win.start, win.end, input.bookingId))) {
    return {
      ok: false,
      code: "invalid_transition",
      message: "That vehicle is already booked or blocked for this window.",
    };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE bookings SET status = $1, updated_by = $2 WHERE booking_id = $3`,
      [input.toStatus, input.user.id, input.bookingId],
    );
    await client.query(
      `INSERT INTO booking_status_history
         (booking_id, from_status, to_status, changed_by_user_id, reason)
       VALUES ($1, $2, $3, $4, $5)`,
      [input.bookingId, from, input.toStatus, input.user.id, input.reason ?? null],
    );
    if (recordsRefund) {
      await createCancellationRefund(client, {
        bookingId: input.bookingId,
        totalAmount: Number(row.total_amount),
        pickupAt: new Date(row.start_datetime),
        initiatedBy: input.refundInitiatedBy ?? "customer",
        actorId: input.user.id,
      });
    }
    if (blocksVehicle) {
      await addBlock(client, {
        vehicleId: row.vehicle_id,
        start: win.start,
        end: win.end,
        kind: "booked",
        bookingId: input.bookingId,
        actorId: input.user.id,
      });
    }
    if (releasesVehicle) {
      await releaseBookingBlock(client, input.bookingId, input.user.id);
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  // Notify the booking owner (chunk 2.2) — never throws, never blocks the result.
  await notifyBookingStatusChanged(input.bookingId, from, input.toStatus);

  return { ok: true, status: input.toStatus };
}

// ─── Read (IDOR-aware, plan.md §26) ─────────────────────────────────────────

export interface BookingStopView {
  touristSpotId: number | null;
  cityId: number | null;
  stopOrder: number;
  customLabel: string | null;
  name: string | null;
}
export interface BookingPassengerView {
  name: string;
  age: number | null;
  phone: string | null;
  isPrimary: boolean;
}
export interface BookingStatusEvent {
  fromStatus: BookingStatus | null;
  toStatus: BookingStatus;
  reason: string | null;
  changedAt: string;
}
export interface BookingSummary {
  id: string;
  reference: string;
  status: BookingStatus;
  bookingTypeCode: string;
  startDateTime: string;
  totalAmount: number;
  currency: string;
  createdAt: string;
}
export interface BookingDetail extends BookingSummary {
  userId: string;
  vehicleId: number | null;
  vehicleTypeId: number;
  packageId: number | null;
  pickupCityId: number | null;
  dropCityId: number | null;
  pickupAddress: string | null;
  dropAddress: string | null;
  endDateTime: string | null;
  passengerCount: number;
  estimatedDistanceKm: number | null;
  estimatedHours: number | null;
  durationDays: number | null;
  priceBreakdown: PriceBreakdown | null;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  assignedAgentUserId: string | null;
  customerNotes: string | null;
  stops: BookingStopView[];
  passengers: BookingPassengerView[];
  history: BookingStatusEvent[];
  refund: RefundView | null;
  review: ReviewView | null;
}

const SUMMARY_COLS = `
  b.booking_id, b.booking_reference, b.status, bt.code AS booking_type_code,
  b.start_datetime, b.total_amount, b.currency, b.created_at`;

function toSummary(r: Record<string, unknown>): BookingSummary {
  return {
    id: r.booking_id as string,
    reference: r.booking_reference as string,
    status: r.status as BookingStatus,
    bookingTypeCode: r.booking_type_code as string,
    startDateTime: (r.start_datetime as Date).toISOString(),
    totalAmount: Number(r.total_amount),
    currency: r.currency as string,
    createdAt: (r.created_at as Date).toISOString(),
  };
}

export async function listBookingsForUser(user: PublicUser): Promise<BookingSummary[]> {
  const pool = getPool();
  let where = "b.is_deleted = false";
  const params: unknown[] = [];
  if (user.role === "admin") {
    // all
  } else if (user.role === "agent") {
    params.push(user.id);
    where += ` AND (b.assigned_agent_user_id = $1 OR b.user_id = $1)`;
  } else {
    params.push(user.id);
    where += ` AND b.user_id = $1`;
  }
  const result = await pool.query(
    `SELECT ${SUMMARY_COLS}
       FROM bookings b
       JOIN booking_types bt ON bt.booking_type_id = b.booking_type_id
      WHERE ${where}
      ORDER BY b.created_at DESC`,
    params,
  );
  return result.rows.map(toSummary);
}

/** Returns null when the booking doesn't exist OR the user may not see it. */
export async function getBookingForUser(
  bookingId: string,
  user: PublicUser,
): Promise<BookingDetail | null> {
  const pool = getPool();
  const b = (
    await pool.query(
      `SELECT ${SUMMARY_COLS}, b.user_id, b.vehicle_id, b.vehicle_type_id, b.package_id,
              b.pickup_city_id, b.drop_city_id, b.pickup_address, b.drop_address,
              b.end_datetime, b.passenger_count, b.estimated_distance_km, b.estimated_hours,
              b.duration_days, b.price_breakdown, b.subtotal, b.discount_amount, b.tax_amount,
              b.assigned_agent_user_id, b.customer_notes
         FROM bookings b
         JOIN booking_types bt ON bt.booking_type_id = b.booking_type_id
        WHERE b.booking_id = $1 AND b.is_deleted = false`,
      [bookingId],
    )
  ).rows[0];
  if (!b) return null;
  if (!actorFor(user, b)) return null;

  const [stops, passengers, history, refund, review] = await Promise.all([
    pool.query(
      `SELECT bs.tourist_spot_id, bs.city_id, bs.stop_order, bs.custom_label, ts.name
         FROM booking_stops bs
         LEFT JOIN tourist_spots ts ON ts.tourist_spot_id = bs.tourist_spot_id
        WHERE bs.booking_id = $1 ORDER BY bs.stop_order`,
      [bookingId],
    ),
    pool.query(
      `SELECT name, age, phone, is_primary FROM booking_passengers
        WHERE booking_id = $1 ORDER BY is_primary DESC, booking_passenger_id`,
      [bookingId],
    ),
    pool.query(
      `SELECT from_status, to_status, reason, changed_at FROM booking_status_history
        WHERE booking_id = $1 ORDER BY changed_at, booking_status_history_id`,
      [bookingId],
    ),
    getRefundForBooking(bookingId),
    getReviewForBooking(bookingId),
  ]);

  return {
    ...toSummary(b),
    userId: b.user_id,
    vehicleId: b.vehicle_id,
    vehicleTypeId: b.vehicle_type_id,
    packageId: b.package_id,
    pickupCityId: b.pickup_city_id,
    dropCityId: b.drop_city_id,
    pickupAddress: b.pickup_address,
    dropAddress: b.drop_address,
    endDateTime: b.end_datetime ? new Date(b.end_datetime).toISOString() : null,
    passengerCount: b.passenger_count,
    estimatedDistanceKm: b.estimated_distance_km != null ? Number(b.estimated_distance_km) : null,
    estimatedHours: b.estimated_hours != null ? Number(b.estimated_hours) : null,
    durationDays: b.duration_days,
    priceBreakdown: (b.price_breakdown as PriceBreakdown) ?? null,
    subtotal: Number(b.subtotal),
    discountAmount: Number(b.discount_amount),
    taxAmount: Number(b.tax_amount),
    assignedAgentUserId: b.assigned_agent_user_id,
    customerNotes: b.customer_notes,
    stops: stops.rows.map((s) => ({
      touristSpotId: s.tourist_spot_id,
      cityId: s.city_id,
      stopOrder: s.stop_order,
      customLabel: s.custom_label,
      name: s.name,
    })),
    passengers: passengers.rows.map((p) => ({
      name: p.name,
      age: p.age,
      phone: p.phone,
      isPrimary: p.is_primary,
    })),
    history: history.rows.map((h) => ({
      fromStatus: h.from_status,
      toStatus: h.to_status,
      reason: h.reason,
      changedAt: new Date(h.changed_at).toISOString(),
    })),
    refund,
    review,
  };
}

// ─── Create (plan.md §6 recompute, §33 snapshot) ────────────────────────────

export interface CreateBookingInput {
  bookingType: BookingTypeCode;
  vehicleId?: number | null;
  vehicleTypeId?: number;
  packageId?: number | null;
  packageSlug?: string | null;
  pickupCityId?: number | null;
  dropCityId?: number | null;
  pickupAddress?: string;
  dropAddress?: string;
  startDateTime: string;
  endDateTime?: string | null;
  passengerCount?: number;
  estimatedDistanceKm?: number;
  estimatedHours?: number;
  durationDays?: number;
  nights?: number;
  customerNotes?: string;
  couponCode?: string;
  stops?: { touristSpotId?: number; cityId?: number; customLabel?: string }[];
  passengers?: { name: string; age?: number; phone?: string; isPrimary?: boolean }[];
}

export type CreateBookingResult =
  | { ok: true; bookingId: string }
  | { ok: false; status: number; message: string };

const BOOKING_TYPE_CODES: BookingTypeCode[] = [
  "point_to_point",
  "hourly",
  "outstation",
  "package",
  "airport_transfer",
];

function reference(): string {
  return `TE-${randomBytes(5).toString("hex").toUpperCase().slice(0, 8)}`;
}

const posNum = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : undefined;

export async function createBooking(
  input: CreateBookingInput,
  user: PublicUser,
): Promise<CreateBookingResult> {
  if (!BOOKING_TYPE_CODES.includes(input.bookingType)) {
    return { ok: false, status: 400, message: "Unknown booking type." };
  }
  const start = new Date(input.startDateTime);
  if (Number.isNaN(start.getTime())) {
    return { ok: false, status: 400, message: "A valid start date/time is required." };
  }
  const passengerCount = Math.max(1, Math.floor(posNum(input.passengerCount) ?? 1));
  const pool = getPool();

  // Package (curated) — load server-side; its price/vehicle-type/duration win.
  let packageId: number | null = null;
  let packagePricePerPerson: number | undefined;
  let vehicleTypeId = input.vehicleTypeId;
  let durationDays = input.durationDays;
  let packageStops: { tourist_spot_id: number; stop_order: number }[] = [];

  if (input.bookingType === "package" && (input.packageId != null || input.packageSlug != null)) {
    const asId = typeof input.packageId === "number" && Number.isInteger(input.packageId)
      ? input.packageId
      : null;
    const pkg = (
      await pool.query(
        `SELECT package_id, vehicle_type_id, price_per_person, duration_days
           FROM packages
          WHERE is_deleted = false AND is_active = true
            AND ($1::int IS NOT NULL AND package_id = $1 OR slug = $2)
          LIMIT 1`,
        [asId, input.packageSlug ?? null],
      )
    ).rows[0];
    if (!pkg) return { ok: false, status: 404, message: "Package not found." };
    packageId = pkg.package_id;
    packagePricePerPerson = Number(pkg.price_per_person);
    vehicleTypeId = vehicleTypeId ?? pkg.vehicle_type_id;
    durationDays = durationDays ?? pkg.duration_days;
    packageStops = (
      await pool.query(
        `SELECT tourist_spot_id, stop_order FROM package_stops
          WHERE package_id = $1 AND is_deleted = false ORDER BY stop_order`,
        [packageId],
      )
    ).rows;
  }

  if (!vehicleTypeId || !Number.isInteger(vehicleTypeId)) {
    return { ok: false, status: 400, message: "A vehicle type is required." };
  }
  const vt = await pool.query(
    `SELECT 1 FROM vehicle_types WHERE vehicle_type_id = $1 AND is_deleted = false`,
    [vehicleTypeId],
  );
  if (!vt.rowCount) {
    return { ok: false, status: 400, message: "That vehicle type doesn't exist." };
  }

  // A specific requested vehicle must be free for the trip window (chunk 2.6).
  if (typeof input.vehicleId === "number") {
    const win = bookingWindow({
      startDateTime: start,
      endDateTime: input.endDateTime ? new Date(input.endDateTime) : null,
      durationDays,
      estimatedHours: input.estimatedHours,
    });
    if (await hasConflict(input.vehicleId, win.start, win.end)) {
      return {
        ok: false,
        status: 409,
        message: "That vehicle isn't available for those dates.",
      };
    }
  }

  // Custom itinerary — validate spot ids up front.
  const customStops = Array.isArray(input.stops) ? input.stops : [];
  const spotIds = customStops
    .map((s) => s.touristSpotId)
    .filter((n): n is number => typeof n === "number" && Number.isInteger(n));
  if (spotIds.length) {
    const found = await pool.query(
      `SELECT tourist_spot_id FROM tourist_spots
        WHERE tourist_spot_id = ANY($1) AND is_deleted = false`,
      [spotIds],
    );
    if (found.rowCount !== spotIds.length) {
      return { ok: false, status: 400, message: "One or more stops are invalid." };
    }
  }

  // Recompute price server-side (plan.md §6) — never trust a client total.
  const bookingTypeId = await resolveBookingTypeId(input.bookingType);
  if (bookingTypeId == null) {
    return { ok: false, status: 500, message: "Booking type is not configured." };
  }
  const rule = await resolvePricingRule(bookingTypeId, vehicleTypeId);
  if (!rule) {
    return { ok: false, status: 422, message: "No pricing is configured for this trip yet." };
  }
  const trip: TripInput = {
    bookingType: input.bookingType,
    distanceKm: posNum(input.estimatedDistanceKm),
    hours: posNum(input.estimatedHours),
    days: posNum(durationDays),
    nights: posNum(input.nights),
    passengers: passengerCount,
    packagePricePerPerson,
  };
  let price = calculatePrice(trip, rule);

  // Coupon (chunk 2.3) — the discount is re-derived from the code + subtotal
  // server-side; a client discount is never trusted (§27).
  let couponId: number | null = null;
  const couponCode = input.couponCode?.trim();
  if (couponCode) {
    const res = await validateCoupon(couponCode, price.subtotal, user.id);
    if (!res.ok) return { ok: false, status: 400, message: res.reason };
    couponId = res.coupon.couponId;
    price = calculatePrice(
      { ...trip, discountAmount: res.coupon.discountAmount },
      rule,
    );
  }

  const passengers = (Array.isArray(input.passengers) ? input.passengers : [])
    .filter((p) => p && typeof p.name === "string" && p.name.trim().length > 0)
    .slice(0, 50);
  if (passengers.length === 0) {
    passengers.push({ name: user.name, phone: user.phone, isPrimary: true });
  } else if (!passengers.some((p) => p.isPrimary)) {
    passengers[0].isPrimary = true;
  }

  const client = await pool.connect();
  let bookingId: string | null = null;
  try {
    await client.query("BEGIN");

    for (let attempt = 0; attempt < 5 && !bookingId; attempt++) {
      try {
        const res = await client.query(
          `INSERT INTO bookings
             (booking_reference, user_id, booking_type_id, vehicle_id, vehicle_type_id,
              package_id, pickup_city_id, drop_city_id, pickup_address, drop_address,
              start_datetime, end_datetime, passenger_count, estimated_distance_km,
              estimated_hours, duration_days, status, price_breakdown, subtotal,
              discount_amount, tax_amount, total_amount, currency, customer_notes,
              coupon_id, created_by, updated_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,
                   'PendingPayment',$17::jsonb,$18,$19,$20,$21,'INR',$22,$23,$24,$24)
           RETURNING booking_id`,
          [
            reference(),
            user.id,
            bookingTypeId,
            typeof input.vehicleId === "number" ? input.vehicleId : null,
            vehicleTypeId,
            packageId,
            typeof input.pickupCityId === "number" ? input.pickupCityId : null,
            typeof input.dropCityId === "number" ? input.dropCityId : null,
            input.pickupAddress?.trim() || null,
            input.dropAddress?.trim() || null,
            start.toISOString(),
            input.endDateTime ? new Date(input.endDateTime).toISOString() : null,
            passengerCount,
            posNum(input.estimatedDistanceKm) ?? null,
            posNum(input.estimatedHours) ?? null,
            posNum(durationDays) ?? null,
            JSON.stringify(price),
            price.subtotal,
            price.discountAmount,
            price.taxAmount,
            price.totalAmount,
            input.customerNotes?.trim() || null,
            couponId,
            user.id,
          ],
        );
        bookingId = res.rows[0].booking_id;
      } catch (err) {
        if ((err as { code?: string }).code === "23505") continue; // reference clash — retry
        throw err;
      }
    }
    if (!bookingId) throw new Error("could not allocate a booking reference");

    if (couponId && price.discountAmount > 0) {
      await recordRedemption(client, couponId, bookingId, user.id, price.discountAmount);
    }

    // Itinerary snapshot (plan.md §33): curated package -> copy its stops;
    // custom route -> the selected spots / custom labels.
    const snapshot = packageStops.length
      ? packageStops.map((s) => ({
          touristSpotId: s.tourist_spot_id,
          cityId: null as number | null,
          customLabel: null as string | null,
          order: s.stop_order,
        }))
      : customStops.map((s, i) => ({
          touristSpotId: typeof s.touristSpotId === "number" ? s.touristSpotId : null,
          cityId: typeof s.cityId === "number" ? s.cityId : null,
          customLabel: s.customLabel?.trim() || null,
          order: i + 1,
        }));
    for (const s of snapshot) {
      await client.query(
        `INSERT INTO booking_stops
           (booking_id, tourist_spot_id, city_id, stop_order, custom_label, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [bookingId, s.touristSpotId, s.cityId, s.order, s.customLabel, user.id],
      );
    }

    for (const p of passengers) {
      await client.query(
        `INSERT INTO booking_passengers
           (booking_id, name, age, phone, is_primary, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          bookingId,
          p.name.trim(),
          typeof p.age === "number" ? p.age : null,
          p.phone?.trim() || null,
          p.isPrimary === true,
          user.id,
        ],
      );
    }

    // Initial history row. Creation is the one place a status is set without
    // transitionBooking(); it still records the Draft -> PendingPayment step.
    await client.query(
      `INSERT INTO booking_status_history
         (booking_id, from_status, to_status, changed_by_user_id, reason)
       VALUES ($1, 'Draft', 'PendingPayment', $2, 'Booking submitted')`,
      [bookingId, user.id],
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  if (!bookingId) throw new Error("booking id was not assigned");

  // Confirmation email (chunk 2.2) — non-blocking, never throws.
  await notifyBookingCreated(bookingId);

  return { ok: true, bookingId };
}

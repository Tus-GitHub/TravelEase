import { getPool } from "./db";
import type { Testimonial } from "@/types";

/**
 * Reviews (chunk 2.7, plan.md §37). A customer can leave one review per
 * *Completed* booking they own. Published reviews replace the static
 * testimonials and appear on the vehicle / package pages.
 */

export interface ReviewView {
  id: string;
  bookingId: string;
  rating: number;
  title: string | null;
  body: string | null;
  isPublished: boolean;
  authorName: string;
  createdAt: string;
}

interface Row {
  review_id: string;
  booking_id: string;
  rating: number;
  title: string | null;
  body: string | null;
  is_published: boolean;
  author_name: string;
  created_at: Date;
}

const toView = (r: Row): ReviewView => ({
  id: r.review_id,
  bookingId: r.booking_id,
  rating: r.rating,
  title: r.title,
  body: r.body,
  isPublished: r.is_published,
  authorName: r.author_name,
  createdAt: new Date(r.created_at).toISOString(),
});

const SELECT = `
  SELECT rv.review_id, rv.booking_id, rv.rating, rv.title, rv.body, rv.is_published,
         u.name AS author_name, rv.created_at
  FROM reviews rv
  JOIN users u ON u.user_id = rv.user_id
`;

export async function getReviewForBooking(bookingId: string): Promise<ReviewView | null> {
  const r = await getPool().query(
    `${SELECT} WHERE rv.booking_id = $1 AND rv.is_deleted = false`,
    [bookingId],
  );
  return r.rows[0] ? toView(r.rows[0]) : null;
}

export type ReviewResult =
  | { ok: true; review: ReviewView }
  | { ok: false; status: number; message: string };

/** Create or update the review for a booking. Only the owner of a Completed booking. */
export async function upsertReview(
  bookingId: string,
  userId: string,
  input: { rating: number; title?: string; body?: string },
): Promise<ReviewResult> {
  const rating = Math.round(Number(input.rating));
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { ok: false, status: 400, message: "Rating must be 1 to 5." };
  }

  const pool = getPool();
  const b = (
    await pool.query(
      `SELECT status, user_id FROM bookings WHERE booking_id = $1 AND is_deleted = false`,
      [bookingId],
    )
  ).rows[0];
  if (!b || b.user_id !== userId) {
    return { ok: false, status: 404, message: "Booking not found." };
  }
  if (b.status !== "Completed") {
    return {
      ok: false,
      status: 409,
      message: "You can review a trip once it's completed.",
    };
  }

  const r = await pool.query(
    `INSERT INTO reviews (booking_id, user_id, rating, title, body, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $2, $2)
     ON CONFLICT (booking_id) DO UPDATE SET
       rating = EXCLUDED.rating, title = EXCLUDED.title, body = EXCLUDED.body,
       is_deleted = false, updated_by = EXCLUDED.updated_by
     RETURNING booking_id`,
    [
      bookingId,
      userId,
      rating,
      input.title?.trim().slice(0, 120) || null,
      input.body?.trim().slice(0, 2000) || null,
    ],
  );
  return { ok: true, review: (await getReviewForBooking(r.rows[0].booking_id))! };
}

// ─── Public reads ──────────────────────────────────────────────────────────

const PUBLIC_WHERE = "rv.is_published = true AND rv.is_deleted = false";

export async function listPublishedReviews(limit = 8): Promise<ReviewView[]> {
  const r = await getPool().query(
    `${SELECT} WHERE ${PUBLIC_WHERE} ORDER BY rv.created_at DESC LIMIT $1`,
    [limit],
  );
  return r.rows.map(toView);
}

export async function listReviewsForVehicle(vehicleId: number): Promise<ReviewView[]> {
  const r = await getPool().query(
    `${SELECT}
       JOIN bookings b ON b.booking_id = rv.booking_id
      WHERE ${PUBLIC_WHERE} AND b.vehicle_id = $1
      ORDER BY rv.created_at DESC LIMIT 20`,
    [vehicleId],
  );
  return r.rows.map(toView);
}

export async function listReviewsForPackage(packageId: number): Promise<ReviewView[]> {
  const r = await getPool().query(
    `${SELECT}
       JOIN bookings b ON b.booking_id = rv.booking_id
      WHERE ${PUBLIC_WHERE} AND b.package_id = $1
      ORDER BY rv.created_at DESC LIMIT 20`,
    [packageId],
  );
  return r.rows.map(toView);
}

/** Adapt a review to the `@/types` Testimonial shape the cards render. */
export function toTestimonial(r: ReviewView): Testimonial {
  return {
    id: r.id,
    name: r.authorName,
    location: "",
    rating: r.rating,
    quote: r.body || r.title || "Great experience.",
  };
}

// ─── Admin ─────────────────────────────────────────────────────────────────

export interface AdminReview extends ReviewView {
  bookingReference: string;
}

export async function listAllReviews(): Promise<AdminReview[]> {
  const r = await getPool().query(
    `SELECT rv.review_id, rv.booking_id, rv.rating, rv.title, rv.body, rv.is_published,
            u.name AS author_name, rv.created_at, b.booking_reference
       FROM reviews rv
       JOIN users u ON u.user_id = rv.user_id
       JOIN bookings b ON b.booking_id = rv.booking_id
      WHERE rv.is_deleted = false
      ORDER BY rv.created_at DESC`,
  );
  return r.rows.map((row) => ({
    ...toView(row),
    bookingReference: row.booking_reference as string,
  }));
}

export async function setReviewPublished(
  id: string,
  isPublished: boolean,
  actorId: string,
): Promise<boolean> {
  const r = await getPool().query(
    `UPDATE reviews SET is_published = $1, updated_by = $2
      WHERE review_id = $3 AND is_deleted = false`,
    [isPublished, actorId, id],
  );
  return (r.rowCount ?? 0) > 0;
}

export async function deleteReview(id: string, actorId: string): Promise<boolean> {
  const r = await getPool().query(
    `UPDATE reviews SET is_deleted = true, updated_by = $2
      WHERE review_id = $1 AND is_deleted = false`,
    [id, actorId],
  );
  return (r.rowCount ?? 0) > 0;
}

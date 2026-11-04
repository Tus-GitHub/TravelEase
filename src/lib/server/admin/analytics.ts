import { getPool } from "../db";

/**
 * Admin analytics (Phase 3 chunk 3.4, plan.md §38). Read-only aggregations over
 * what's already in the DB — no schema, no new tables. "Revenue" counts only
 * bookings that reached a paid state (Confirmed / Ongoing / Completed); Refunded
 * and Cancelled are excluded.
 */

const PAID_STATUSES = ["Confirmed", "Ongoing", "Completed"] as const;
const PAID_SQL = `('Confirmed','Ongoing','Completed')`;

export interface Analytics {
  generatedAt: string;
  bookings: {
    total: number;
    last30: number;
    byStatus: { status: string; count: number }[];
    byType: { type: string; count: number }[];
  };
  revenue: {
    total: number;
    last30: number;
    avgBookingValue: number;
    taxCollected: number;
    discountsGiven: number;
  };
  refunds: {
    count: number;
    pending: number;
    totalRefunded: number;
    refundRatePct: number;
  };
  coupons: { active: number; redemptions: number; discountGiven: number };
  reviews: { count: number; published: number; avgRating: number };
  support: { total: number; open: number };
  payouts: { pendingCount: number; pendingAmount: number; paidAmount: number };
  topPackages: { name: string; bookings: number; revenue: number }[];
  topVehicleTypes: { title: string; bookings: number }[];
  timeseries: { date: string; bookings: number; revenue: number }[];
}

const n = (v: unknown) => Number(v ?? 0);
const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

export async function getAnalytics(): Promise<Analytics> {
  const pool = getPool();

  const [headline, byStatus, byType, topPkg, topVt, series] = await Promise.all([
    pool.query(`
      SELECT
        (SELECT count(*) FROM bookings WHERE is_deleted = false) AS bookings_total,
        (SELECT count(*) FROM bookings WHERE is_deleted = false
           AND created_at > now() - interval '30 days') AS bookings_30,
        (SELECT coalesce(sum(total_amount), 0) FROM bookings
           WHERE is_deleted = false AND status IN ${PAID_SQL}) AS revenue_total,
        (SELECT coalesce(sum(total_amount), 0) FROM bookings
           WHERE is_deleted = false AND status IN ${PAID_SQL}
             AND created_at > now() - interval '30 days') AS revenue_30,
        (SELECT coalesce(avg(total_amount), 0) FROM bookings
           WHERE is_deleted = false AND status IN ${PAID_SQL}) AS avg_value,
        (SELECT coalesce(sum(tax_amount), 0) FROM bookings
           WHERE is_deleted = false AND status IN ${PAID_SQL}) AS tax_collected,
        (SELECT coalesce(sum(discount_amount), 0) FROM bookings
           WHERE is_deleted = false AND status IN ${PAID_SQL}) AS discounts_given,
        (SELECT count(*) FROM refunds) AS refunds_total,
        (SELECT count(*) FROM refunds WHERE status = 'pending') AS refunds_pending,
        (SELECT coalesce(sum(amount), 0) FROM refunds WHERE status = 'paid') AS refunds_paid_amt,
        (SELECT count(*) FROM bookings WHERE is_deleted = false
           AND (status IN ('Confirmed','Ongoing','Completed','Refunded')
                OR booking_id IN (SELECT booking_id FROM refunds))) AS paid_ever,
        (SELECT count(*) FROM coupons WHERE is_deleted = false AND is_active = true
           AND (starts_at IS NULL OR starts_at <= now())
           AND (expires_at IS NULL OR expires_at > now())) AS coupons_active,
        (SELECT count(*) FROM coupon_redemptions) AS coupon_redemptions,
        (SELECT coalesce(sum(amount), 0) FROM coupon_redemptions) AS coupon_discount,
        (SELECT count(*) FROM reviews WHERE is_deleted = false) AS reviews_total,
        (SELECT count(*) FROM reviews WHERE is_deleted = false AND is_published = true) AS reviews_pub,
        (SELECT coalesce(avg(rating), 0) FROM reviews WHERE is_deleted = false) AS reviews_avg,
        (SELECT count(*) FROM support_tickets WHERE is_deleted = false) AS support_total,
        (SELECT count(*) FROM support_tickets WHERE is_deleted = false
           AND status IN ('open','pending')) AS support_open,
        (SELECT count(*) FROM payouts WHERE is_deleted = false AND status = 'pending') AS payouts_pending_n,
        (SELECT coalesce(sum(net_amount), 0) FROM payouts
           WHERE is_deleted = false AND status = 'pending') AS payouts_pending_amt,
        (SELECT coalesce(sum(net_amount), 0) FROM payouts
           WHERE is_deleted = false AND status = 'paid') AS payouts_paid_amt
    `),
    pool.query(`
      SELECT status, count(*)::int AS c FROM bookings
       WHERE is_deleted = false GROUP BY status ORDER BY c DESC
    `),
    pool.query(`
      SELECT bt.code, count(*)::int AS c
        FROM bookings b JOIN booking_types bt ON bt.booking_type_id = b.booking_type_id
       WHERE b.is_deleted = false GROUP BY bt.code ORDER BY c DESC
    `),
    pool.query(`
      SELECT p.name,
             count(*)::int AS bookings,
             coalesce(sum(b.total_amount) FILTER (WHERE b.status IN ${PAID_SQL}), 0) AS revenue
        FROM bookings b JOIN packages p ON p.package_id = b.package_id
       WHERE b.is_deleted = false
       GROUP BY p.package_id, p.name
       ORDER BY bookings DESC, revenue DESC
       LIMIT 5
    `),
    pool.query(`
      SELECT vt.title, count(*)::int AS bookings
        FROM bookings b JOIN vehicle_types vt ON vt.vehicle_type_id = b.vehicle_type_id
       WHERE b.is_deleted = false
       GROUP BY vt.vehicle_type_id, vt.title
       ORDER BY bookings DESC
       LIMIT 5
    `),
    pool.query(`
      SELECT gs::date AS d,
             count(b.booking_id)::int AS bookings,
             coalesce(sum(b.total_amount) FILTER (WHERE b.status IN ${PAID_SQL}), 0) AS revenue
        FROM generate_series(now()::date - 29, now()::date, interval '1 day') gs
        LEFT JOIN bookings b
          ON b.is_deleted = false
         AND date_trunc('day', b.created_at)::date = gs::date
       GROUP BY d ORDER BY d
    `),
  ]);

  const h = headline.rows[0];
  const refundsTotal = n(h.refunds_total);
  const paidEver = n(h.paid_ever);

  return {
    generatedAt: new Date().toISOString(),
    bookings: {
      total: n(h.bookings_total),
      last30: n(h.bookings_30),
      byStatus: byStatus.rows.map((r) => ({ status: r.status as string, count: n(r.c) })),
      byType: byType.rows.map((r) => ({ type: r.code as string, count: n(r.c) })),
    },
    revenue: {
      total: round2(n(h.revenue_total)),
      last30: round2(n(h.revenue_30)),
      avgBookingValue: round2(n(h.avg_value)),
      taxCollected: round2(n(h.tax_collected)),
      discountsGiven: round2(n(h.discounts_given)),
    },
    refunds: {
      count: refundsTotal,
      pending: n(h.refunds_pending),
      totalRefunded: round2(n(h.refunds_paid_amt)),
      refundRatePct: paidEver > 0 ? Math.round((refundsTotal / paidEver) * 100) : 0,
    },
    coupons: {
      active: n(h.coupons_active),
      redemptions: n(h.coupon_redemptions),
      discountGiven: round2(n(h.coupon_discount)),
    },
    reviews: {
      count: n(h.reviews_total),
      published: n(h.reviews_pub),
      avgRating: round2(n(h.reviews_avg)),
    },
    support: { total: n(h.support_total), open: n(h.support_open) },
    payouts: {
      pendingCount: n(h.payouts_pending_n),
      pendingAmount: round2(n(h.payouts_pending_amt)),
      paidAmount: round2(n(h.payouts_paid_amt)),
    },
    topPackages: topPkg.rows.map((r) => ({
      name: r.name as string,
      bookings: n(r.bookings),
      revenue: round2(n(r.revenue)),
    })),
    topVehicleTypes: topVt.rows.map((r) => ({
      title: r.title as string,
      bookings: n(r.bookings),
    })),
    timeseries: series.rows.map((r) => ({
      date: (r.d instanceof Date ? r.d : new Date(r.d)).toISOString().slice(0, 10),
      bookings: n(r.bookings),
      revenue: round2(n(r.revenue)),
    })),
  };
}

export { PAID_STATUSES };

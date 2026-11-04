import { getPool } from "../db";
import { applyPartialUpdate, softDelete } from "./_util";
import { logActivity } from "../activity-log";
import { getSiteSettings } from "../site-settings";

/**
 * Vendor marketplace (Phase 3 chunk 3.5) — admin-managed vendor businesses, the
 * vehicles they own, and monthly payout statements. No vendor login. Commission
 * is one global % from site_settings ('vendor_commission_pct'). When a vendor's
 * vehicle runs a Completed trip, Jagdamba owes the vendor (trip total − commission).
 */

export type VendorStatus = "pending" | "approved" | "suspended";
export type PayoutStatus = "pending" | "paid" | "void";

const VENDOR_STATUSES: VendorStatus[] = ["pending", "approved", "suspended"];
const PAYOUT_STATUSES: PayoutStatus[] = ["pending", "paid", "void"];

// Trips whose revenue is real for payout purposes.
const PAYABLE_STATUS = "'Completed'";

export interface AdminVendor {
  id: number;
  businessName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  payoutDetails: string;
  status: VendorStatus;
  notes: string;
  vehicleCount: number;
}

interface VendorRow {
  vendor_profile_id: number;
  business_name: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  payout_details: string | null;
  status: VendorStatus;
  notes: string | null;
  vehicle_count: number;
}

const toVendor = (r: VendorRow): AdminVendor => ({
  id: r.vendor_profile_id,
  businessName: r.business_name,
  contactName: r.contact_name ?? "",
  contactEmail: r.contact_email ?? "",
  contactPhone: r.contact_phone ?? "",
  address: r.address ?? "",
  payoutDetails: r.payout_details ?? "",
  status: r.status,
  notes: r.notes ?? "",
  vehicleCount: Number(r.vehicle_count),
});

const V_SELECT = `
  SELECT vp.vendor_profile_id, vp.business_name, vp.contact_name, vp.contact_email,
         vp.contact_phone, vp.address, vp.payout_details, vp.status, vp.notes,
         (SELECT count(*) FROM vehicles ve
           WHERE ve.vendor_profile_id = vp.vendor_profile_id AND ve.is_deleted = false)
           AS vehicle_count
    FROM vendor_profiles vp
`;

export async function listVendors(): Promise<AdminVendor[]> {
  const r = await getPool().query(
    `${V_SELECT} WHERE vp.is_deleted = false ORDER BY vp.business_name`,
  );
  return r.rows.map(toVendor);
}

async function getVendor(id: number): Promise<AdminVendor | null> {
  const r = await getPool().query(
    `${V_SELECT} WHERE vp.vendor_profile_id = $1 AND vp.is_deleted = false`,
    [id],
  );
  return r.rows[0] ? toVendor(r.rows[0]) : null;
}

export interface VendorInput {
  businessName: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  payoutDetails?: string;
  notes?: string;
}

export type CreateVendorResult =
  | { ok: true; vendor: AdminVendor }
  | { ok: false; message: string };

export async function createVendor(
  input: VendorInput,
  actorId: string,
): Promise<CreateVendorResult> {
  const businessName = (input.businessName ?? "").trim();
  if (businessName.length < 2) {
    return { ok: false, message: "A business name is required." };
  }
  const r = await getPool().query(
    `INSERT INTO vendor_profiles
       (business_name, contact_name, contact_email, contact_phone, address,
        payout_details, notes, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
     RETURNING vendor_profile_id`,
    [
      businessName,
      input.contactName?.trim() || null,
      input.contactEmail?.trim() || null,
      input.contactPhone?.trim() || null,
      input.address?.trim() || null,
      input.payoutDetails?.trim() || null,
      input.notes?.trim() || null,
      actorId,
    ],
  );
  return { ok: true, vendor: (await getVendor(r.rows[0].vendor_profile_id))! };
}

const V_COLUMNS = {
  businessName: "business_name",
  contactName: "contact_name",
  contactEmail: "contact_email",
  contactPhone: "contact_phone",
  address: "address",
  payoutDetails: "payout_details",
  status: "status",
  notes: "notes",
} as const;

export async function updateVendor(
  id: number,
  input: Record<string, unknown>,
  actorId: string,
): Promise<AdminVendor | null> {
  if (
    typeof input.status === "string" &&
    !VENDOR_STATUSES.includes(input.status as VendorStatus)
  ) {
    return null;
  }
  const ok = await applyPartialUpdate(
    "vendor_profiles",
    "vendor_profile_id",
    id,
    input,
    V_COLUMNS,
    actorId,
  );
  if (ok && typeof input.status === "string") {
    await logActivity({
      userId: actorId,
      action: "vendor.status_change",
      entityType: "vendor_profile",
      entityId: id,
      details: { status: input.status },
    });
  }
  return ok ? getVendor(id) : null;
}

export function deleteVendor(id: number, actorId: string): Promise<boolean> {
  return softDelete("vendor_profiles", "vendor_profile_id", id, actorId);
}

// ─── Payouts ───────────────────────────────────────────────────────────────

export interface AdminPayout {
  id: string;
  vendorProfileId: number;
  vendorName: string;
  periodStart: string;
  periodEnd: string;
  bookingCount: number;
  grossAmount: number;
  commissionPct: number;
  commissionAmount: number;
  netAmount: number;
  status: PayoutStatus;
  method: string | null;
  reference: string | null;
  createdAt: string;
}

interface PayoutRow {
  payout_id: string;
  vendor_profile_id: number;
  vendor_name: string;
  period_start: Date;
  period_end: Date;
  booking_count: number;
  gross_amount: string;
  commission_pct: string;
  commission_amount: string;
  net_amount: string;
  status: PayoutStatus;
  method: string | null;
  reference: string | null;
  created_at: Date;
}

const toPayout = (r: PayoutRow): AdminPayout => ({
  id: r.payout_id,
  vendorProfileId: r.vendor_profile_id,
  vendorName: r.vendor_name,
  periodStart: new Date(r.period_start).toISOString().slice(0, 10),
  periodEnd: new Date(r.period_end).toISOString().slice(0, 10),
  bookingCount: Number(r.booking_count),
  grossAmount: Number(r.gross_amount),
  commissionPct: Number(r.commission_pct),
  commissionAmount: Number(r.commission_amount),
  netAmount: Number(r.net_amount),
  status: r.status,
  method: r.method,
  reference: r.reference,
  createdAt: new Date(r.created_at).toISOString(),
});

const P_SELECT = `
  SELECT p.payout_id, p.vendor_profile_id, vp.business_name AS vendor_name,
         p.period_start, p.period_end, p.booking_count, p.gross_amount,
         p.commission_pct, p.commission_amount, p.net_amount, p.status,
         p.method, p.reference, p.created_at
    FROM payouts p
    JOIN vendor_profiles vp ON vp.vendor_profile_id = p.vendor_profile_id
`;

export async function listPayouts(status?: string): Promise<AdminPayout[]> {
  const valid = PAYOUT_STATUSES.includes(status as PayoutStatus)
    ? (status as PayoutStatus)
    : null;
  const r = await getPool().query(
    `${P_SELECT}
      WHERE p.is_deleted = false ${valid ? "AND p.status = $1" : ""}
      ORDER BY p.period_start DESC, vp.business_name`,
    valid ? [valid] : [],
  );
  return r.rows.map(toPayout);
}

const money = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** First day of `YYYY-MM` and of the following month, as ISO dates. */
function monthRange(month: string): { start: string; end: string } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) return null;
  const start = new Date(Date.UTC(y, mo - 1, 1));
  const end = new Date(Date.UTC(y, mo, 1));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export type GenerateResult =
  | { ok: true; payouts: AdminPayout[]; month: string }
  | { ok: false; message: string };

/**
 * Build (or refresh) payout rows for one calendar month: for every approved
 * vendor, tally Completed trips on their vehicles whose start_datetime falls in
 * the month, apply the current global commission %, and upsert one payout row.
 * Rows already `paid` are left untouched.
 */
export async function generatePayouts(
  month: string,
  actorId: string,
): Promise<GenerateResult> {
  const range = monthRange(month);
  if (!range) return { ok: false, message: "Give a month as YYYY-MM." };

  const pool = getPool();
  const pct = (await getSiteSettings()).vendorCommissionPct;

  const tally = await pool.query(
    `SELECT vp.vendor_profile_id,
            count(b.booking_id)::int AS n,
            coalesce(sum(b.total_amount), 0) AS gross
       FROM vendor_profiles vp
       JOIN vehicles ve ON ve.vendor_profile_id = vp.vendor_profile_id AND ve.is_deleted = false
       JOIN bookings b ON b.vehicle_id = ve.vehicle_id
        AND b.is_deleted = false AND b.status = ${PAYABLE_STATUS}
        AND b.start_datetime >= $1 AND b.start_datetime < $2
      WHERE vp.is_deleted = false AND vp.status = 'approved'
      GROUP BY vp.vendor_profile_id`,
    [range.start, range.end],
  );

  for (const row of tally.rows) {
    const gross = money(Number(row.gross));
    const commission = money((gross * pct) / 100);
    const net = money(gross - commission);
    await pool.query(
      `INSERT INTO payouts
         (vendor_profile_id, period_start, period_end, booking_count, gross_amount,
          commission_pct, commission_amount, net_amount, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
       ON CONFLICT (vendor_profile_id, period_start, period_end) DO UPDATE SET
         booking_count = EXCLUDED.booking_count,
         gross_amount = EXCLUDED.gross_amount,
         commission_pct = EXCLUDED.commission_pct,
         commission_amount = EXCLUDED.commission_amount,
         net_amount = EXCLUDED.net_amount,
         updated_by = EXCLUDED.updated_by
       WHERE payouts.status = 'pending'`,
      [row.vendor_profile_id, range.start, range.end, row.n, gross, pct, commission, net, actorId],
    );
  }

  const r = await pool.query(
    `${P_SELECT}
      WHERE p.is_deleted = false AND p.period_start = $1 AND p.period_end = $2
      ORDER BY vp.business_name`,
    [range.start, range.end],
  );
  return { ok: true, payouts: r.rows.map(toPayout), month };
}

export type SettlePayoutResult =
  | { ok: true; payout: AdminPayout }
  | { ok: false; status: number; message: string };

export async function settlePayout(
  payoutId: string,
  input: { status: "paid" | "void"; method?: string | null; reference?: string | null },
  actorId: string,
): Promise<SettlePayoutResult> {
  if (input.status !== "paid" && input.status !== "void") {
    return { ok: false, status: 400, message: "Status must be 'paid' or 'void'." };
  }
  const pool = getPool();
  const current = (
    await pool.query(
      `SELECT status FROM payouts WHERE payout_id = $1 AND is_deleted = false`,
      [payoutId],
    )
  ).rows[0];
  if (!current) return { ok: false, status: 404, message: "Payout not found." };
  if (current.status !== "pending") {
    return { ok: false, status: 409, message: `Payout is already ${current.status}.` };
  }

  await pool.query(
    `UPDATE payouts SET status = $1, method = $2, reference = $3, updated_by = $4
      WHERE payout_id = $5`,
    [
      input.status,
      input.method?.trim() || null,
      input.reference?.trim() || null,
      actorId,
      payoutId,
    ],
  );
  const r = await pool.query(`${P_SELECT} WHERE p.payout_id = $1`, [payoutId]);
  const payout = toPayout(r.rows[0]);
  await logActivity({
    userId: actorId,
    action: "payout.settle",
    entityType: "payout",
    entityId: payoutId,
    details: { status: payout.status, net: payout.netAmount, vendor: payout.vendorName },
  });
  return { ok: true, payout };
}

export { VENDOR_STATUSES, PAYOUT_STATUSES };

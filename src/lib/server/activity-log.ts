import { getPool } from "./db";

/**
 * Activity log (Phase 3 chunk 3.3, plan.md §19b/§20/§38). A cross-cutting,
 * append-only audit feed over the `activity_logs` table (created empty in
 * migration 007 — this chunk is the first thing to write to it).
 *
 * Every writer here is NON-BLOCKING: a failure is logged to the console and
 * swallowed, never thrown back to the flow that called it — same contract as
 * `notifications.ts`. `action` is a dotted `<entity>.<verb>` string; keep the
 * vocabulary in ACTIVITY_ACTIONS so the admin filter can enumerate it.
 */

export const ACTIVITY_ACTIONS = [
  "user.login",
  "user.signup",
  "user.role_change",
  "user.account_delete",
  "permission.change",
  "booking.create",
  "booking.status_change",
  "refund.settle",
  "vendor.status_change",
  "payout.settle",
  "admin.update",
  "admin.delete",
] as const;

export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number] | (string & {});

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ActivityEntry {
  /** The acting user; null / omitted = system-triggered. */
  userId?: string | null;
  action: ActivityAction;
  entityType?: string | null;
  entityId?: string | number | null;
  details?: Record<string, unknown> | null;
  ipAddress?: string | null;
}

export async function logActivity(entry: ActivityEntry): Promise<void> {
  try {
    await getPool().query(
      `INSERT INTO activity_logs
         (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
      [
        entry.userId && UUID_RE.test(entry.userId) ? entry.userId : null,
        String(entry.action).slice(0, 100),
        entry.entityType ? String(entry.entityType).slice(0, 50) : null,
        entry.entityId != null ? String(entry.entityId).slice(0, 50) : null,
        entry.details ? JSON.stringify(entry.details) : null,
        entry.ipAddress ? entry.ipAddress.slice(0, 45) : null,
      ],
    );
  } catch (err) {
    console.error("activity-log: insert failed", err);
  }
}

/** Best-effort client IP from a route Request. */
export function clientIp(request: Request): string | null {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim() || null;
  return request.headers.get("x-real-ip");
}

// ─── Admin read ────────────────────────────────────────────────────────────

export interface ActivityRow {
  id: string;
  userId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

export async function listActivity(opts: {
  action?: string;
  userId?: string;
  entityType?: string;
  limit?: number;
  /** ISO timestamp cursor — return rows strictly older than this. */
  before?: string;
}): Promise<ActivityRow[]> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const where: string[] = [];
  const params: unknown[] = [];

  if (opts.action) {
    params.push(opts.action.slice(0, 100));
    where.push(`al.action = $${params.length}`);
  }
  if (opts.userId && UUID_RE.test(opts.userId)) {
    params.push(opts.userId);
    where.push(`al.user_id = $${params.length}`);
  }
  if (opts.entityType) {
    params.push(opts.entityType.slice(0, 50));
    where.push(`al.entity_type = $${params.length}`);
  }
  if (opts.before) {
    const d = new Date(opts.before);
    if (!Number.isNaN(d.getTime())) {
      params.push(d.toISOString());
      where.push(`al.created_at < $${params.length}`);
    }
  }
  params.push(limit);

  const r = await getPool().query(
    `SELECT al.log_id, al.user_id, u.name AS actor_name, u.email AS actor_email,
            al.action, al.entity_type, al.entity_id, al.details, al.ip_address, al.created_at
       FROM activity_logs al
       LEFT JOIN users u ON u.user_id = al.user_id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY al.created_at DESC, al.log_id DESC
      LIMIT $${params.length}`,
    params,
  );

  return r.rows.map((row) => ({
    id: String(row.log_id),
    userId: row.user_id,
    actorName: row.actor_name,
    actorEmail: row.actor_email,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    details: (row.details as Record<string, unknown> | null) ?? null,
    ipAddress: row.ip_address,
    createdAt: new Date(row.created_at).toISOString(),
  }));
}

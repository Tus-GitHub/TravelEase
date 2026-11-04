import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth-guard";
import { listActivity } from "@/lib/server/activity-log";

/**
 * GET /api/admin/activity?action=&userId=&entityType=&limit=&before=
 * The audit feed. `before` is an ISO timestamp cursor (rows older than it) for
 * "load more".
 */
export async function GET(request: Request) {
  const auth = await requireRole("admin");
  if (!auth.ok) return auth.response;

  const q = new URL(request.url).searchParams;
  const limit = Number(q.get("limit"));
  const items = await listActivity({
    action: q.get("action") ?? undefined,
    userId: q.get("userId") ?? undefined,
    entityType: q.get("entityType") ?? undefined,
    limit: Number.isFinite(limit) && limit > 0 ? limit : undefined,
    before: q.get("before") ?? undefined,
  });
  return NextResponse.json({ items });
}

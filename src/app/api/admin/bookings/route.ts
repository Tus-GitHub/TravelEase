import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth-guard";
import { listAdminBookings } from "@/lib/server/admin/bookings";

/** GET /api/admin/bookings?status=<Status> — every booking, admin only (§36 1.13). */
export async function GET(request: Request) {
  const auth = await requireRole("admin");
  if (!auth.ok) return auth.response;

  const status = new URL(request.url).searchParams.get("status") || undefined;
  const items = await listAdminBookings(status);
  return NextResponse.json({ items });
}

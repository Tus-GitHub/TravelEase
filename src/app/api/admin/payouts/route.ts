import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth-guard";
import { listPayouts } from "@/lib/server/admin/vendors";

/** GET /api/admin/payouts?status= — vendor payout statements. */
export async function GET(request: Request) {
  const auth = await requireRole("admin");
  if (!auth.ok) return auth.response;
  const status = new URL(request.url).searchParams.get("status") ?? undefined;
  return NextResponse.json({ items: await listPayouts(status) });
}

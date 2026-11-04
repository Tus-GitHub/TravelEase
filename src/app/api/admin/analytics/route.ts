import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth-guard";
import { getAnalytics } from "@/lib/server/admin/analytics";

/** GET /api/admin/analytics — read-only business aggregates. */
export async function GET() {
  const auth = await requireRole("admin");
  if (!auth.ok) return auth.response;
  return NextResponse.json({ analytics: await getAnalytics() });
}

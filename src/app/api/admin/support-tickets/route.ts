import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth-guard";
import { listAllTickets } from "@/lib/server/support-tickets";

/** GET /api/admin/support-tickets?status= — every ticket, optionally filtered. */
export async function GET(request: Request) {
  const auth = await requireRole("admin");
  if (!auth.ok) return auth.response;
  const status = new URL(request.url).searchParams.get("status") ?? undefined;
  return NextResponse.json({ items: await listAllTickets(status) });
}

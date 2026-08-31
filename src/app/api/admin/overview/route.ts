import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth-guard";
import { getOverview } from "@/lib/server/admin/overview";

export async function GET() {
  const auth = await requireRole("admin");
  if (!auth.ok) return auth.response;

  return NextResponse.json(await getOverview());
}

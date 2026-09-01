import { NextResponse } from "next/server";
import { listPublicRegions } from "@/lib/server/catalogue";

// Always read live from the DB — the admin panel edits this catalogue.
export const dynamic = "force-dynamic";

/**
 * GET /api/regions — regions with their tourist spots, the shape the Package
 * Builder consumes (plan.md §31, §33).
 */
export async function GET() {
  const regions = await listPublicRegions();
  return NextResponse.json({ regions });
}

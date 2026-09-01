import { NextResponse } from "next/server";
import { listPublicPackages } from "@/lib/server/catalogue";

// Always read live from the DB — the admin panel edits this catalogue.
export const dynamic = "force-dynamic";

/** GET /api/packages — active curated packages with their ordered stops (plan.md §31). */
export async function GET() {
  const packages = await listPublicPackages();
  return NextResponse.json({ packages });
}

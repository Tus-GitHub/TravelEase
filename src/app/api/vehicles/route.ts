import { NextResponse } from "next/server";
import { listPublicVehicles } from "@/lib/server/catalogue";

/**
 * GET /api/vehicles — public fleet listing (plan.md §31).
 * Filters: ?type=<slug> &seats=<min> &priceMax=<inr> &available=1
 */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const int = (v: string | null) => {
    const n = Number(v);
    return v != null && Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined;
  };

  const vehicles = await listPublicVehicles({
    typeSlug: q.get("type") || undefined,
    minSeats: int(q.get("seats")),
    maxPrice: int(q.get("priceMax")),
    availableOnly: q.get("available") === "1" || q.get("available") === "true",
  });

  return NextResponse.json({ vehicles });
}

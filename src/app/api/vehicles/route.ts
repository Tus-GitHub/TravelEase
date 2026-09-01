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

  // ?date=YYYY-MM-DD (a single day) or ?from=&to= (ISO) → availability window.
  let availableFrom: Date | undefined;
  let availableTo: Date | undefined;
  const date = q.get("date");
  if (q.get("from") && q.get("to")) {
    const f = new Date(q.get("from")!);
    const t = new Date(q.get("to")!);
    if (!Number.isNaN(f.getTime()) && !Number.isNaN(t.getTime())) {
      availableFrom = f;
      availableTo = t;
    }
  } else if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    availableFrom = new Date(`${date}T00:00:00`);
    availableTo = new Date(availableFrom.getTime() + 24 * 3_600_000);
  }

  const vehicles = await listPublicVehicles({
    typeSlug: q.get("type") || undefined,
    minSeats: int(q.get("seats")),
    maxPrice: int(q.get("priceMax")),
    availableOnly: q.get("available") === "1" || q.get("available") === "true",
    availableFrom,
    availableTo,
  });

  return NextResponse.json({ vehicles });
}

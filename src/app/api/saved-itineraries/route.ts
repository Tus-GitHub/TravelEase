import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/auth-guard";
import {
  createSavedItinerary,
  listSavedItineraries,
  type SavedItineraryKind,
} from "@/lib/server/saved-itineraries";

/** GET /api/saved-itineraries — the caller's own saved trips, newest first. */
export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const items = await listSavedItineraries(auth.user.id);
  return NextResponse.json({ savedItineraries: items });
}

/**
 * POST /api/saved-itineraries — save a Package Builder route or a curated
 * package. Body: { kind: "curated"|"custom", packageId?|packageSlug?,
 * regionId?, vehicleTypeId?|vehicleTypeSlug?, spotIds?: number[], title? }.
 */
export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (body.kind !== "curated" && body.kind !== "custom") {
    return NextResponse.json(
      { error: 'kind must be "curated" or "custom".' },
      { status: 400 },
    );
  }

  const int = (v: unknown) =>
    typeof v === "number" && Number.isInteger(v) ? v : undefined;
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);

  const result = await createSavedItinerary(auth.user.id, {
    kind: body.kind as SavedItineraryKind,
    packageId: int(body.packageId),
    packageSlug: str(body.packageSlug),
    regionId: int(body.regionId),
    vehicleTypeId: int(body.vehicleTypeId),
    vehicleTypeSlug: str(body.vehicleTypeSlug),
    spotIds: Array.isArray(body.spotIds)
      ? body.spotIds.filter((n): n is number => typeof n === "number")
      : undefined,
    title: str(body.title),
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
  return NextResponse.json({ savedItinerary: result.item }, { status: 201 });
}

import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth-guard";
import { createCity, listCities } from "@/lib/server/admin/geography";

function optCoord(value: unknown): number | null {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function GET() {
  const auth = await requireRole("admin");
  if (!auth.ok) return auth.response;
  return NextResponse.json({ items: await listCities() });
}

export async function POST(request: Request) {
  const auth = await requireRole("admin");
  if (!auth.ok) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const regionId = Number(body.regionId);
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!Number.isInteger(regionId) || regionId <= 0) {
    return NextResponse.json({ error: "A valid region is required." }, { status: 400 });
  }
  if (name.length < 2) {
    return NextResponse.json({ error: "City name is required." }, { status: 400 });
  }

  try {
    const item = await createCity(
      {
        regionId,
        name,
        latitude: optCoord(body.latitude),
        longitude: optCoord(body.longitude),
        isPickupPoint: body.isPickupPoint !== false,
        isAirport: body.isAirport === true,
      },
      auth.user.id,
    );
    return NextResponse.json({ item }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && /foreign key/i.test(err.message)) {
      return NextResponse.json({ error: "That region doesn't exist." }, { status: 400 });
    }
    throw err;
  }
}

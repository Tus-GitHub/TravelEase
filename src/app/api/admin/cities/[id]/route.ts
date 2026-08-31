import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth-guard";
import { deleteCity, updateCity } from "@/lib/server/admin/geography";

function optCoord(value: unknown): number | null {
  if (value === "" || value === null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const auth = await requireRole("admin");
  if (!auth.ok) return auth.response;

  const id = Number(params.id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const input: {
    regionId?: number;
    name?: string;
    latitude?: number | null;
    longitude?: number | null;
    isPickupPoint?: boolean;
    isAirport?: boolean;
  } = {};

  if (body.regionId !== undefined) {
    const n = Number(body.regionId);
    if (!Number.isInteger(n) || n <= 0) {
      return NextResponse.json({ error: "Invalid region." }, { status: 400 });
    }
    input.regionId = n;
  }
  if (typeof body.name === "string") input.name = body.name.trim();
  if (body.latitude !== undefined) input.latitude = optCoord(body.latitude);
  if (body.longitude !== undefined) input.longitude = optCoord(body.longitude);
  if (typeof body.isPickupPoint === "boolean") input.isPickupPoint = body.isPickupPoint;
  if (typeof body.isAirport === "boolean") input.isAirport = body.isAirport;

  const item = await updateCity(id, input, auth.user.id);
  if (!item) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ item });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const auth = await requireRole("admin");
  if (!auth.ok) return auth.response;

  const id = Number(params.id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  const ok = await deleteCity(id, auth.user.id);
  if (!ok) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

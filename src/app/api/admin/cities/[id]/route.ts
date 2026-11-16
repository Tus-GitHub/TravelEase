import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth-guard";
import { dbErrorResponse } from "@/lib/server/api-errors";
import { deleteCity, updateCity } from "@/lib/server/admin/geography";
import { cleanGeographyName } from "@/lib/geography";

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
    stateId?: number;
    name?: string;
    latitude?: number | null;
    longitude?: number | null;
    isPickupPoint?: boolean;
    isAirport?: boolean;
  } = {};

  if (body.stateId !== undefined) {
    const n = Number(body.stateId);
    if (!Number.isSafeInteger(n) || n <= 0) {
      return NextResponse.json({ error: "Invalid state." }, { status: 400 });
    }
    input.stateId = n;
  }
  if (body.name !== undefined) {
    if(typeof body.name!=="string")return NextResponse.json({error:"Invalid city name."},{status:400});
    input.name=cleanGeographyName(body.name);
    if(input.name.length<2||input.name.length>100)return NextResponse.json({error:"Enter a city name (2–100 characters)."},{status:400});
  }
  if (body.latitude !== undefined) input.latitude = optCoord(body.latitude);
  if (body.longitude !== undefined) input.longitude = optCoord(body.longitude);
  if (typeof body.isPickupPoint === "boolean") input.isPickupPoint = body.isPickupPoint;
  if (typeof body.isAirport === "boolean") input.isAirport = body.isAirport;

  try {
    const item = await updateCity(id, input, auth.user.id);
    if (!item) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ item });
  } catch (err) {
    const res = dbErrorResponse(err, { fk: "That state doesn't exist.", unique: "That city already exists in this state." });
    if (res) return res;
    throw err;
  }
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

  try {
    const ok = await deleteCity(id, auth.user.id);
    if (!ok) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const res = dbErrorResponse(err);
    if (res) return res;
    throw err;
  }
}

import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth-guard";
import { dbErrorResponse } from "@/lib/server/api-errors";
import { deleteVehicle, updateVehicle } from "@/lib/server/admin/fleet";

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
    vehicleTypeId?: number;
    name?: string;
    registrationNumber?: string;
    seatingCapacity?: number;
    features?: string[];
    basePricePerDay?: number;
    isAvailable?: boolean;
  } = {};

  if (body.vehicleTypeId !== undefined) {
    const n = Number(body.vehicleTypeId);
    if (!Number.isInteger(n) || n <= 0) {
      return NextResponse.json({ error: "Invalid vehicle type." }, { status: 400 });
    }
    input.vehicleTypeId = n;
  }
  if (typeof body.name === "string") input.name = body.name.trim();
  if (typeof body.registrationNumber === "string") {
    input.registrationNumber = body.registrationNumber.trim();
  }
  if (body.seatingCapacity !== undefined) {
    const n = Number(body.seatingCapacity);
    if (!Number.isFinite(n) || n < 1) {
      return NextResponse.json({ error: "Seating capacity must be at least 1." }, { status: 400 });
    }
    input.seatingCapacity = n;
  }
  if (body.basePricePerDay !== undefined) {
    const n = Number(body.basePricePerDay);
    if (!Number.isFinite(n) || n < 0) {
      return NextResponse.json({ error: "Price must be zero or more." }, { status: 400 });
    }
    input.basePricePerDay = n;
  }
  if (Array.isArray(body.features)) {
    input.features = body.features.filter(
      (f): f is string => typeof f === "string" && f.trim() !== "",
    );
  }
  if (typeof body.isAvailable === "boolean") input.isAvailable = body.isAvailable;

  try {
    const item = await updateVehicle(id, input, auth.user.id);
    if (!item) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ item });
  } catch (err) {
    const res = dbErrorResponse(err, { fk: "That vehicle type doesn't exist." });
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

  const ok = await deleteVehicle(id, auth.user.id);
  if (!ok) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

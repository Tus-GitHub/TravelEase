import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth-guard";
import { createVehicle, listVehicles } from "@/lib/server/admin/fleet";

export async function GET() {
  const auth = await requireRole("admin");
  if (!auth.ok) return auth.response;
  return NextResponse.json({ items: await listVehicles() });
}

export async function POST(request: Request) {
  const auth = await requireRole("admin");
  if (!auth.ok) return auth.response;

  let body: {
    vehicleTypeId?: unknown;
    name?: unknown;
    registrationNumber?: unknown;
    seatingCapacity?: unknown;
    features?: unknown;
    basePricePerDay?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const vehicleTypeId = Number(body.vehicleTypeId);
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const seatingCapacity = Number(body.seatingCapacity);
  const basePricePerDay = Number(body.basePricePerDay);

  if (!Number.isInteger(vehicleTypeId) || vehicleTypeId <= 0) {
    return NextResponse.json({ error: "A valid vehicle type is required." }, { status: 400 });
  }
  if (name.length < 2) {
    return NextResponse.json({ error: "Vehicle name is required." }, { status: 400 });
  }
  if (!Number.isFinite(seatingCapacity) || seatingCapacity < 1) {
    return NextResponse.json({ error: "Seating capacity must be at least 1." }, { status: 400 });
  }
  if (!Number.isFinite(basePricePerDay) || basePricePerDay < 0) {
    return NextResponse.json({ error: "Price per day must be zero or more." }, { status: 400 });
  }

  const features = Array.isArray(body.features)
    ? body.features.filter((f): f is string => typeof f === "string" && f.trim() !== "")
    : [];
  const registrationNumber =
    typeof body.registrationNumber === "string" ? body.registrationNumber.trim() : "";

  try {
    const item = await createVehicle(
      { vehicleTypeId, name, registrationNumber, seatingCapacity, features, basePricePerDay },
      auth.user.id,
    );
    return NextResponse.json({ item }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && /foreign key/i.test(err.message)) {
      return NextResponse.json({ error: "That vehicle type doesn't exist." }, { status: 400 });
    }
    throw err;
  }
}

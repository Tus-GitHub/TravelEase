import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth-guard";
import { dbErrorResponse } from "@/lib/server/api-errors";
import { createVehicle, listVehicles } from "@/lib/server/admin/fleet";
import { matchesRequestOrigin } from "@/lib/server/request-origin";
import { PricingError } from "@/lib/server/admin/pricing";
import { readBoundedJsonObject } from "@/lib/server/http-json";

export async function GET() {
  const auth = await requireRole("admin");
  if (!auth.ok) return auth.response;
  return NextResponse.json({ items: await listVehicles() });
}

export async function POST(request: Request) {
  const auth = await requireRole("admin");
  if (!auth.ok) return auth.response;
  if(!matchesRequestOrigin(request))return NextResponse.json({error:"Invalid origin."},{status:403});

  let body: {
    vehicleTypeId?: unknown;
    name?: unknown;
    registrationNumber?: unknown;
    seatingCapacity?: unknown;
    features?: unknown;
    basePricePerDay?: unknown;
    perKmRate?: unknown;
  };
  try {
    body = await readBoundedJsonObject(request.body,16384);
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const vehicleTypeId = Number(body.vehicleTypeId);
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const seatingCapacity = Number(body.seatingCapacity);
  const basePricePerDay = Number(body.basePricePerDay);
  const perKmRate=body.perKmRate===undefined?undefined:Number(body.perKmRate);
  if(perKmRate!==undefined&&(!Number.isFinite(perKmRate)||perKmRate<=0||perKmRate>999999))return NextResponse.json({error:"Price per km must be greater than zero."},{status:400});

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
      { vehicleTypeId, name, registrationNumber, seatingCapacity, features, basePricePerDay, perKmRate },
      auth.user.id,
    );
    return NextResponse.json({ item }, { status: 201 });
  } catch (err) {
    if(err instanceof PricingError)return NextResponse.json({error:err.message},{status:err.status});
    const res = dbErrorResponse(err, { fk: "That vehicle type doesn't exist." });
    if (res) return res;
    throw err;
  }
}

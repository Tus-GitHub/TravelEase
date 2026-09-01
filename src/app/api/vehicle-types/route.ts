import { NextResponse } from "next/server";
import { listPublicVehicleTypes } from "@/lib/server/catalogue";

// Small lookup the booking flow needs (slug -> id). Live from the DB.
export const dynamic = "force-dynamic";

/** GET /api/vehicle-types — active vehicle types: { id, slug, title }. */
export async function GET() {
  const vehicleTypes = await listPublicVehicleTypes();
  return NextResponse.json({ vehicleTypes });
}

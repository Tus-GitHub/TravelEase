import { NextResponse } from "next/server";
import { getPublicVehicle } from "@/lib/server/catalogue";

/** GET /api/vehicles/[id] — one vehicle with all its images (plan.md §31). */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const id = Number(params.id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  const vehicle = await getPublicVehicle(id);
  if (!vehicle) {
    return NextResponse.json({ error: "Vehicle not found." }, { status: 404 });
  }
  return NextResponse.json({ vehicle });
}

import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth-guard";
import { dbErrorResponse } from "@/lib/server/api-errors";
import { createPackage, listPackages } from "@/lib/server/admin/catalog";

function optRating(value: unknown): number | null {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 5 ? n : null;
}

export async function GET() {
  const auth = await requireRole("admin");
  if (!auth.ok) return auth.response;
  return NextResponse.json({ items: await listPackages() });
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
  const vehicleTypeId = Number(body.vehicleTypeId);
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const durationDays = Number(body.durationDays);
  const maxPersons = Number(body.maxPersons);
  const pricePerPerson = Number(body.pricePerPerson);

  if (!Number.isInteger(regionId) || regionId <= 0) {
    return NextResponse.json({ error: "A valid region is required." }, { status: 400 });
  }
  if (!Number.isInteger(vehicleTypeId) || vehicleTypeId <= 0) {
    return NextResponse.json({ error: "A valid vehicle type is required." }, { status: 400 });
  }
  if (name.length < 2) {
    return NextResponse.json({ error: "Package name is required." }, { status: 400 });
  }
  if (!Number.isInteger(durationDays) || durationDays < 1) {
    return NextResponse.json({ error: "Duration must be at least 1 day." }, { status: 400 });
  }
  if (!Number.isInteger(maxPersons) || maxPersons < 1) {
    return NextResponse.json({ error: "Max persons must be at least 1." }, { status: 400 });
  }
  if (!Number.isFinite(pricePerPerson) || pricePerPerson < 0) {
    return NextResponse.json({ error: "Price per person must be zero or more." }, { status: 400 });
  }

  try {
    const item = await createPackage(
      {
        regionId,
        vehicleTypeId,
        name,
        durationDays,
        maxPersons,
        pricePerPerson,
        tag: typeof body.tag === "string" ? body.tag.trim() : "",
        rating: optRating(body.rating),
      },
      auth.user.id,
    );
    return NextResponse.json({ item }, { status: 201 });
  } catch (err) {
    const res = dbErrorResponse(err, {
      fk: "The chosen region or vehicle type doesn't exist.",
    });
    if (res) return res;
    throw err;
  }
}

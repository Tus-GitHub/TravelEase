import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth-guard";
import { dbErrorResponse } from "@/lib/server/api-errors";
import { deletePackage, updatePackage } from "@/lib/server/admin/catalog";

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
    vehicleTypeId?: number;
    name?: string;
    durationDays?: number;
    maxPersons?: number;
    pricePerPerson?: number;
    tag?: string;
    rating?: number | null;
    isActive?: boolean;
  } = {};

  const intField = (v: unknown, min: number) => {
    const n = Number(v);
    return Number.isInteger(n) && n >= min ? n : undefined;
  };

  if (body.regionId !== undefined) {
    input.regionId = intField(body.regionId, 1);
    if (input.regionId === undefined) {
      return NextResponse.json({ error: "Invalid region." }, { status: 400 });
    }
  }
  if (body.vehicleTypeId !== undefined) {
    input.vehicleTypeId = intField(body.vehicleTypeId, 1);
    if (input.vehicleTypeId === undefined) {
      return NextResponse.json({ error: "Invalid vehicle type." }, { status: 400 });
    }
  }
  if (typeof body.name === "string") input.name = body.name.trim();
  if (body.durationDays !== undefined) {
    input.durationDays = intField(body.durationDays, 1);
    if (input.durationDays === undefined) {
      return NextResponse.json({ error: "Duration must be at least 1 day." }, { status: 400 });
    }
  }
  if (body.maxPersons !== undefined) {
    input.maxPersons = intField(body.maxPersons, 1);
    if (input.maxPersons === undefined) {
      return NextResponse.json({ error: "Max persons must be at least 1." }, { status: 400 });
    }
  }
  if (body.pricePerPerson !== undefined) {
    const n = Number(body.pricePerPerson);
    if (!Number.isFinite(n) || n < 0) {
      return NextResponse.json({ error: "Price must be zero or more." }, { status: 400 });
    }
    input.pricePerPerson = n;
  }
  if (typeof body.tag === "string") input.tag = body.tag.trim();
  if (body.rating !== undefined) {
    if (body.rating === null || body.rating === "") {
      input.rating = null;
    } else {
      const n = Number(body.rating);
      if (!Number.isFinite(n) || n < 0 || n > 5) {
        return NextResponse.json({ error: "Rating must be between 0 and 5." }, { status: 400 });
      }
      input.rating = n;
    }
  }
  if (typeof body.isActive === "boolean") input.isActive = body.isActive;

  try {
    const item = await updatePackage(id, input, auth.user.id);
    if (!item) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ item });
  } catch (err) {
    const res = dbErrorResponse(err, {
      fk: "The chosen region or vehicle type doesn't exist.",
    });
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

  const ok = await deletePackage(id, auth.user.id);
  if (!ok) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

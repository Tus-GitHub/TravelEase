import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth-guard";
import { deleteSeason, updateSeason } from "@/lib/server/seasonal-pricing";

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

  const input: Record<string, unknown> = {};
  if (typeof body.name === "string") input.name = body.name.trim();
  if (typeof body.startsOn === "string") input.startsOn = body.startsOn.slice(0, 10);
  if (typeof body.endsOn === "string") input.endsOn = body.endsOn.slice(0, 10);
  if (typeof body.multiplier === "number") input.multiplier = body.multiplier;
  if (typeof body.priority === "number") input.priority = body.priority;
  if (body.bookingTypeId === null || typeof body.bookingTypeId === "number")
    input.bookingTypeId = body.bookingTypeId;
  if (body.vehicleTypeId === null || typeof body.vehicleTypeId === "number")
    input.vehicleTypeId = body.vehicleTypeId;
  if (typeof body.isActive === "boolean") input.isActive = body.isActive;

  const item = await updateSeason(id, input, auth.user.id);
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
  const ok = await deleteSeason(id, auth.user.id);
  if (!ok) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

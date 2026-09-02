import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth-guard";
import { createSeason, listSeasons } from "@/lib/server/seasonal-pricing";

export async function GET() {
  const auth = await requireRole("admin");
  if (!auth.ok) return auth.response;
  return NextResponse.json({ items: await listSeasons() });
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

  const int = (v: unknown) =>
    typeof v === "number" && Number.isInteger(v) ? v : null;

  const result = await createSeason(
    {
      name: typeof body.name === "string" ? body.name : "",
      startsOn: String(body.startsOn ?? ""),
      endsOn: String(body.endsOn ?? ""),
      bookingTypeId: int(body.bookingTypeId),
      vehicleTypeId: int(body.vehicleTypeId),
      multiplier: Number(body.multiplier),
      priority: typeof body.priority === "number" ? body.priority : 0,
    },
    auth.user.id,
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 400 });
  }
  return NextResponse.json({ item: result.season }, { status: 201 });
}

import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth-guard";
import { dbErrorResponse } from "@/lib/server/api-errors";
import { createTouristSpot, listTouristSpots } from "@/lib/server/admin/geography";

export async function GET() {
  const auth = await requireRole("admin");
  if (!auth.ok) return auth.response;
  return NextResponse.json({ items: await listTouristSpots() });
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

  const cityId = Number(body.cityId);
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!Number.isInteger(cityId) || cityId <= 0) {
    return NextResponse.json({ error: "A valid city is required." }, { status: 400 });
  }
  if (name.length < 2) {
    return NextResponse.json({ error: "Spot name is required." }, { status: 400 });
  }

  try {
    const item = await createTouristSpot(
      {
        cityId,
        name,
        tag: typeof body.tag === "string" ? body.tag.trim() : "",
        description: typeof body.description === "string" ? body.description.trim() : "",
      },
      auth.user.id,
    );
    return NextResponse.json({ item }, { status: 201 });
  } catch (err) {
    const res = dbErrorResponse(err, { fk: "That city doesn't exist." });
    if (res) return res;
    throw err;
  }
}

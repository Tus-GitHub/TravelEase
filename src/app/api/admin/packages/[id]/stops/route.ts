import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth-guard";
import { addPackageStop } from "@/lib/server/admin/catalog";

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const auth = await requireRole("admin");
  if (!auth.ok) return auth.response;

  const packageId = Number(params.id);
  if (!Number.isInteger(packageId)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const touristSpotId = Number(body.touristSpotId);
  const stopOrder = Number(body.stopOrder);
  const nightsHere = Number(body.nightsHere);

  if (!Number.isInteger(touristSpotId) || touristSpotId <= 0) {
    return NextResponse.json({ error: "A valid tourist spot is required." }, { status: 400 });
  }
  if (!Number.isInteger(stopOrder) || stopOrder < 1) {
    return NextResponse.json({ error: "Stop order must be at least 1." }, { status: 400 });
  }
  if (!Number.isInteger(nightsHere) || nightsHere < 0) {
    return NextResponse.json({ error: "Nights must be zero or more." }, { status: 400 });
  }

  try {
    const item = await addPackageStop(
      packageId,
      { touristSpotId, stopOrder, nightsHere },
      auth.user.id,
    );
    if (!item) return NextResponse.json({ error: "Package not found." }, { status: 404 });
    return NextResponse.json({ item }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && /foreign key/i.test(err.message)) {
      return NextResponse.json(
        { error: "That package or tourist spot doesn't exist." },
        { status: 400 },
      );
    }
    throw err;
  }
}

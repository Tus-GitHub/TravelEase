import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth-guard";
import { dbErrorResponse } from "@/lib/server/api-errors";
import { deleteTouristSpot, updateTouristSpot } from "@/lib/server/admin/geography";

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

  const input: { cityId?: number; name?: string; tag?: string; description?: string } = {};
  if (body.cityId !== undefined) {
    const n = Number(body.cityId);
    if (!Number.isInteger(n) || n <= 0) {
      return NextResponse.json({ error: "Invalid city." }, { status: 400 });
    }
    input.cityId = n;
  }
  if (typeof body.name === "string") input.name = body.name.trim();
  if (typeof body.tag === "string") input.tag = body.tag.trim();
  if (typeof body.description === "string") input.description = body.description.trim();

  try {
    const item = await updateTouristSpot(id, input, auth.user.id);
    if (!item) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ item });
  } catch (err) {
    const res = dbErrorResponse(err, { fk: "That city doesn't exist." });
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

  try {
    const ok = await deleteTouristSpot(id, auth.user.id);
    if (!ok) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const res = dbErrorResponse(err);
    if (res) return res;
    throw err;
  }
}

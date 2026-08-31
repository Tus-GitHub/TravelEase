import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth-guard";
import { deleteVehicleType, updateVehicleType } from "@/lib/server/admin/fleet";

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

  let body: {
    title?: unknown;
    slug?: unknown;
    description?: unknown;
    isActive?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const input: { title?: string; slug?: string; description?: string; isActive?: boolean } = {};
  if (typeof body.title === "string") input.title = body.title.trim();
  if (typeof body.slug === "string") input.slug = body.slug.trim();
  if (typeof body.description === "string") input.description = body.description.trim();
  if (typeof body.isActive === "boolean") input.isActive = body.isActive;

  const item = await updateVehicleType(id, input, auth.user.id);
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

  const ok = await deleteVehicleType(id, auth.user.id);
  if (!ok) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth-guard";
import { deleteDriver, updateDriver } from "@/lib/server/admin/drivers";

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
  if (typeof body.phone === "string") input.phone = body.phone.trim();
  if (typeof body.licenceNumber === "string")
    input.licenceNumber = body.licenceNumber.trim() || null;
  if (typeof body.note === "string") input.note = body.note.trim() || null;
  if (typeof body.isActive === "boolean") input.isActive = body.isActive;

  const item = await updateDriver(id, input, auth.user.id);
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
  const ok = await deleteDriver(id, auth.user.id);
  if (!ok) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

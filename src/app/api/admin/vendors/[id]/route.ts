import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth-guard";
import { dbErrorResponse } from "@/lib/server/api-errors";
import { deleteVendor, updateVendor } from "@/lib/server/admin/vendors";

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
  for (const k of [
    "businessName",
    "contactName",
    "contactEmail",
    "contactPhone",
    "address",
    "payoutDetails",
    "status",
    "notes",
  ] as const) {
    if (typeof body[k] === "string") input[k] = (body[k] as string).trim();
  }
  if (Object.keys(input).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  try {
    const item = await updateVendor(id, input, auth.user.id);
    if (!item) return NextResponse.json({ error: "Not found or invalid status." }, { status: 404 });
    return NextResponse.json({ item });
  } catch (err) {
    const res = dbErrorResponse(err);
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

  const ok = await deleteVendor(id, auth.user.id);
  if (!ok) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

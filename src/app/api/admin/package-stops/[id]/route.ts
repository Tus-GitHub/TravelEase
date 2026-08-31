import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth-guard";
import { deletePackageStop } from "@/lib/server/admin/catalog";

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

  const result = await deletePackageStop(id, auth.user.id);
  if (!result) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true, packageId: result.packageId });
}

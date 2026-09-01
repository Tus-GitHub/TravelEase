import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth-guard";
import { deleteAdminBlock } from "@/lib/server/availability";

export async function DELETE(
  _request: Request,
  { params }: { params: { blockId: string } },
) {
  const auth = await requireRole("admin");
  if (!auth.ok) return auth.response;

  const id = Number(params.blockId);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  const ok = await deleteAdminBlock(id, auth.user.id);
  if (!ok) {
    return NextResponse.json(
      { error: "Not found, or it's a booking block (cancel the booking instead)." },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth-guard";
import { dbErrorResponse } from "@/lib/server/api-errors";
import { deleteRegion, updateRegion } from "@/lib/server/admin/geography";
import { cleanGeographyName } from "@/lib/geography";

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

  let body: { name?: unknown; state?: unknown; isActive?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const input: { name?: string; state?: string; isActive?: boolean } = {};
  if (body.name !== undefined) {
    if(typeof body.name !== "string") return NextResponse.json({error:"Invalid region name."},{status:400});
    input.name=cleanGeographyName(body.name);
    if(input.name.length<2||input.name.length>100)return NextResponse.json({error:"Enter a region name (2–100 characters)."},{status:400});
  }
  if (typeof body.isActive === "boolean") input.isActive = body.isActive;

  try {
    const item = await updateRegion(id, input, auth.user.id);
    if (!item) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ item });
  } catch(error) { const response=dbErrorResponse(error,{unique:"That region already exists. Add its states in the States tab."});if(response)return response;throw error; }
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
    const ok = await deleteRegion(id, auth.user.id);
    if (!ok) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const res = dbErrorResponse(err);
    if (res) return res;
    throw err;
  }
}

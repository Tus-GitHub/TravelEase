import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth-guard";
import { createAdminBlock, listBlocks } from "@/lib/server/availability";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const auth = await requireRole("admin");
  if (!auth.ok) return auth.response;
  const id = Number(params.id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }
  return NextResponse.json({ items: await listBlocks(id) });
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const auth = await requireRole("admin");
  if (!auth.ok) return auth.response;
  const id = Number(params.id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  let body: { startsAt?: unknown; endsAt?: unknown; kind?: unknown; note?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const result = await createAdminBlock(
    id,
    {
      startsAt: String(body.startsAt ?? ""),
      endsAt: String(body.endsAt ?? ""),
      kind: body.kind === "maintenance" ? "maintenance" : "blocked",
      note: typeof body.note === "string" ? body.note : undefined,
    },
    auth.user.id,
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 400 });
  }
  return NextResponse.json({ item: result.block }, { status: 201 });
}

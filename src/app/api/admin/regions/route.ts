import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth-guard";
import { createRegion, listRegions } from "@/lib/server/admin/geography";

export async function GET() {
  const auth = await requireRole("admin");
  if (!auth.ok) return auth.response;
  return NextResponse.json({ items: await listRegions() });
}

export async function POST(request: Request) {
  const auth = await requireRole("admin");
  if (!auth.ok) return auth.response;

  let body: { name?: unknown; state?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const state = typeof body.state === "string" ? body.state.trim() : "";
  if (name.length < 2 || state.length < 2) {
    return NextResponse.json({ error: "Region name and state are required." }, { status: 400 });
  }

  const item = await createRegion({ name, state }, auth.user.id);
  return NextResponse.json({ item }, { status: 201 });
}

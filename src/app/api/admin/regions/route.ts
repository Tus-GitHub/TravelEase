import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth-guard";
import { createRegion, listRegions } from "@/lib/server/admin/geography";
import { dbErrorResponse } from "@/lib/server/api-errors";
import { cleanGeographyName } from "@/lib/geography";

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

  const name = typeof body.name === "string" ? cleanGeographyName(body.name) : "";
  if (name.length < 2 || name.length > 100) {
    return NextResponse.json({ error: "Enter a region name (2–100 characters)." }, { status: 400 });
  }

  try { const item = await createRegion({ name }, auth.user.id); return NextResponse.json({ item }, { status: 201 }); }
  catch(error) { const response=dbErrorResponse(error,{unique:"That region already exists. Add its states in the States tab."}); if(response)return response;throw error; }
}

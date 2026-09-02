import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth-guard";
import { getAdminSiteSettings, updateSiteSettings } from "@/lib/server/admin/site-settings";

export async function GET() {
  const auth = await requireRole("admin");
  if (!auth.ok) return auth.response;
  return NextResponse.json({ item: await getAdminSiteSettings() });
}

export async function PATCH(request: Request) {
  const auth = await requireRole("admin");
  if (!auth.ok) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const input: Record<string, string> = {};
  for (const k of ["contactPhone", "contactEmail", "contactAddress"] as const) {
    if (typeof body[k] === "string") input[k] = body[k] as string;
  }
  if (Object.keys(input).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const item = await updateSiteSettings(input, auth.user.id);
  return NextResponse.json({ item });
}

import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth-guard";
import { getAdminSiteSettings, updateSiteSettings } from "@/lib/server/admin/site-settings";
import { ContactError } from "@/lib/contact";
import { matchesRequestOrigin } from "@/lib/server/request-origin";

export async function GET() {
  const auth = await requireRole("admin");
  if (!auth.ok) return auth.response;
  return NextResponse.json({ item: await getAdminSiteSettings() });
}

export async function PATCH(request: Request) {
  const auth = await requireRole("admin");
  if (!auth.ok) return auth.response;

  if (!matchesRequestOrigin(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  let body: Record<string, unknown>;
  try {
    body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid body");
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const input: Record<string, string | number> = {};
  for (const k of ["contactPhone", "contactEmail", "contactAddress"] as const) {
    if (typeof body[k] === "string") input[k] = body[k] as string;
  }
  if (typeof body.vendorCommissionPct === "string" || typeof body.vendorCommissionPct === "number") {
    input.vendorCommissionPct = body.vendorCommissionPct;
  }
  if (Object.keys(input).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  try {
    const item = await updateSiteSettings(input, auth.user.id);
    return NextResponse.json({ item });
  } catch (error) {
    return NextResponse.json({ error: error instanceof ContactError ? error.message : "Could not save site settings." }, { status: error instanceof ContactError ? error.status : 503 });
  }
}

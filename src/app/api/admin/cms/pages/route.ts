import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth-guard";
import { matchesRequestOrigin } from "@/lib/server/request-origin";
import { readBoundedJsonObject } from "@/lib/server/http-json";
import { CmsError } from "@/lib/cms";
import { createCmsPage, listCmsPages } from "@/lib/server/cms";

export const dynamic = "force-dynamic";
export async function GET() {
  const auth = await requireRole("admin"); if (!auth.ok) return auth.response;
  return NextResponse.json({ items: await listCmsPages() }, { headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: Request) {
  const auth = await requireRole("admin"); if (!auth.ok) return auth.response;
  if (!matchesRequestOrigin(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  let body: Record<string, unknown>;
  try { body = await readBoundedJsonObject(request.body, 4096); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  try { return NextResponse.json({ item: await createCmsPage(body, auth.user.id) }, { status: 201, headers: { "Cache-Control": "no-store" } }); }
  catch (error) {
    if (error instanceof CmsError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("CMS page creation failed"); return NextResponse.json({ error: "Unable to create the page. Try again." }, { status: 500 });
  }
}

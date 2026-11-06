import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth-guard";
import { matchesRequestOrigin } from "@/lib/server/request-origin";
import { readBoundedJsonObject } from "@/lib/server/http-json";
import { CMS_MAX_BYTES, CmsError } from "@/lib/cms";
import { changeCmsPage, getCmsPage, listCmsRevisions } from "@/lib/server/cms";

export const dynamic = "force-dynamic";
async function handle(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole("admin"); if (!auth.ok) return auth.response;
  try {
    if (request.method === "GET") return NextResponse.json({ item: await getCmsPage(params.id), revisions: await listCmsRevisions(params.id) }, { headers: { "Cache-Control": "no-store" } });
    if (!matchesRequestOrigin(request)) throw new CmsError("Invalid origin.", 403);
    let body: Record<string, unknown>;
    try { body = await readBoundedJsonObject(request.body, CMS_MAX_BYTES + 4096); } catch { throw new CmsError("Invalid or oversized page request."); }
    const item = await changeCmsPage(params.id, body, auth.user.id);
    return NextResponse.json({ item, revisions: item ? await listCmsRevisions(params.id) : [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof CmsError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("CMS page operation failed"); return NextResponse.json({ error: "Unable to update this page. Try again." }, { status: 500 });
  }
}
export const GET = handle;
export const PATCH = handle;

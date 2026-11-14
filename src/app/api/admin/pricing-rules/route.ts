import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth-guard";
import { matchesRequestOrigin } from "@/lib/server/request-origin";
import { readBoundedJsonObject } from "@/lib/server/http-json";
import { listPricing, savePricing, PricingError } from "@/lib/server/admin/pricing";

export async function GET() {
  const auth = await requireRole("admin"); if (!auth.ok) return auth.response;
  return NextResponse.json(await listPricing(), { headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: Request) {
  const auth = await requireRole("admin"); if (!auth.ok) return auth.response;
  if (!matchesRequestOrigin(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  let body:Record<string,unknown>;
  try { body=await readBoundedJsonObject(request.body,8192); }
  catch { return NextResponse.json({error:"Invalid request body."},{status:400}); }
  try {
    return NextResponse.json({ id: await savePricing(body, auth.user.id) });
  } catch(error) {
    return NextResponse.json({ error: error instanceof PricingError ? error.message : "Pricing service unavailable. Please try again." }, { status: error instanceof PricingError ? error.status : 503 });
  }
}

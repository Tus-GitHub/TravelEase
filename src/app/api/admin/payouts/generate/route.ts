import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth-guard";
import { generatePayouts } from "@/lib/server/admin/vendors";

/** POST /api/admin/payouts/generate — body { month: "YYYY-MM" }. */
export async function POST(request: Request) {
  const auth = await requireRole("admin");
  if (!auth.ok) return auth.response;

  let body: { month?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (typeof body.month !== "string") {
    return NextResponse.json({ error: "A month (YYYY-MM) is required." }, { status: 400 });
  }

  const result = await generatePayouts(body.month, auth.user.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 400 });
  }
  return NextResponse.json({ items: result.payouts, month: result.month });
}

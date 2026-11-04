import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth-guard";
import { settlePayout } from "@/lib/server/admin/vendors";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** PATCH /api/admin/payouts/[id] — body { status: "paid"|"void", method?, reference? }. */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const auth = await requireRole("admin");
  if (!auth.ok) return auth.response;
  if (!UUID_RE.test(params.id)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  let body: { status?: unknown; method?: unknown; reference?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (body.status !== "paid" && body.status !== "void") {
    return NextResponse.json({ error: "status must be 'paid' or 'void'." }, { status: 400 });
  }

  const result = await settlePayout(
    params.id,
    {
      status: body.status,
      method: typeof body.method === "string" ? body.method : null,
      reference: typeof body.reference === "string" ? body.reference : null,
    },
    auth.user.id,
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
  return NextResponse.json({ item: result.payout });
}

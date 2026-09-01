import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth-guard";
import { getAdminBooking, settleRefund } from "@/lib/server/admin/bookings";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/admin/bookings/[id]/refund (plan.md §31) — settle the refund
 * recorded for a cancelled booking. Body: { status: 'paid'|'waived',
 * method?, reference? }.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const auth = await requireRole("admin");
  if (!auth.ok) return auth.response;
  if (!UUID_RE.test(params.id)) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  }

  let body: { status?: unknown; method?: unknown; reference?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (body.status !== "paid" && body.status !== "waived") {
    return NextResponse.json(
      { error: "status must be 'paid' or 'waived'." },
      { status: 400 },
    );
  }

  const result = await settleRefund(
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

  return NextResponse.json({ item: await getAdminBooking(params.id) });
}

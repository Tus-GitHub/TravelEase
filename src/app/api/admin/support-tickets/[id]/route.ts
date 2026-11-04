import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth-guard";
import {
  addTicketMessage,
  getTicketAdmin,
  setTicketStatus,
} from "@/lib/server/support-tickets";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** GET /api/admin/support-tickets/[id] — the full thread. */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const auth = await requireRole("admin");
  if (!auth.ok) return auth.response;
  if (!UUID_RE.test(params.id)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const ticket = await getTicketAdmin(params.id, auth.user);
  if (!ticket) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ ticket });
}

/**
 * PATCH /api/admin/support-tickets/[id] — reply or change status.
 * Body: { message } to reply, or { status } to move it.
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const auth = await requireRole("admin");
  if (!auth.ok) return auth.response;
  if (!UUID_RE.test(params.id)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  let body: { message?: unknown; status?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (typeof body.message === "string") {
    const result = await addTicketMessage(params.id, auth.user, body.message);
    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: result.status });
    }
    return NextResponse.json({ ticket: result.ticket });
  }

  if (typeof body.status === "string") {
    const ok = await setTicketStatus(params.id, body.status, auth.user.id);
    if (!ok) return NextResponse.json({ error: "Invalid status or ticket." }, { status: 400 });
    const ticket = await getTicketAdmin(params.id, auth.user);
    return NextResponse.json({ ticket });
  }

  return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
}

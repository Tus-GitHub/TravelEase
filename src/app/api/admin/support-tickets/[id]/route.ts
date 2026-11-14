import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth-guard";
import { readBoundedJsonObject } from "@/lib/server/http-json";
import { matchesRequestOrigin } from "@/lib/server/request-origin";
import {
  addTicketMessage,
  getTicketAdmin,
  setTicketStatus,
  TicketLimitError,
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
  if (!matchesRequestOrigin(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  if (!UUID_RE.test(params.id)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  let body: { message?: unknown; status?: unknown };
  try {
    body = await readBoundedJsonObject(request.body, 20 * 1024);
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
    let ok: boolean;
    try { ok = await setTicketStatus(params.id, body.status, auth.user.id); }
    catch (error) {
      if (error instanceof TicketLimitError) return NextResponse.json({ error: error.message }, { status: 409 });
      throw error;
    }
    if (!ok) return NextResponse.json({ error: "Invalid status or ticket." }, { status: 400 });
    const ticket = await getTicketAdmin(params.id, auth.user);
    return NextResponse.json({ ticket });
  }

  return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
}

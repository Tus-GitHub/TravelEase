import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/auth-guard";
import { addTicketMessage, getTicketForUser } from "@/lib/server/support-tickets";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** GET /api/support-tickets/[id] — the full thread, owner (or admin) only. */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  if (!UUID_RE.test(params.id)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const ticket = await getTicketForUser(params.id, auth.user);
  if (!ticket) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ ticket });
}

/** POST /api/support-tickets/[id] — add a reply. Body: { message }. */
export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  if (!UUID_RE.test(params.id)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  let body: { message?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (typeof body.message !== "string") {
    return NextResponse.json({ error: "A message is required." }, { status: 400 });
  }

  const result = await addTicketMessage(params.id, auth.user, body.message);
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
  return NextResponse.json({ ticket: result.ticket });
}

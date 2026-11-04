import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/auth-guard";
import { createTicket, listTicketsForUser } from "@/lib/server/support-tickets";

/** GET /api/support-tickets — the caller's own tickets, most recent activity first. */
export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  return NextResponse.json({ tickets: await listTicketsForUser(auth.user.id) });
}

/**
 * POST /api/support-tickets — open a ticket.
 * Body: { subject, message, category?, bookingId? }.
 */
export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  const result = await createTicket(auth.user, {
    subject: str(body.subject) ?? "",
    message: str(body.message) ?? "",
    category: str(body.category),
    bookingId: str(body.bookingId) ?? null,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
  return NextResponse.json({ ticket: result.ticket }, { status: 201 });
}

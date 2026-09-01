import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth-guard";
import {
  adminTransition,
  assignBookingAgent,
  getAdminBooking,
} from "@/lib/server/admin/bookings";
import type { BookingStatus } from "@/lib/server/bookings";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES: BookingStatus[] = [
  "Draft",
  "PendingPayment",
  "Confirmed",
  "Ongoing",
  "Completed",
  "Cancelled",
  "Refunded",
];

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const auth = await requireRole("admin");
  if (!auth.ok) return auth.response;
  if (!UUID_RE.test(params.id)) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  }
  const item = await getAdminBooking(params.id);
  if (!item) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  return NextResponse.json({ item });
}

/**
 * PATCH /api/admin/bookings/[id]
 *   { status, reason? }               — advance the booking (via transitionBooking)
 *   { assignedAgentUserId | null }    — assign / clear the agent
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const auth = await requireRole("admin");
  if (!auth.ok) return auth.response;
  if (!UUID_RE.test(params.id)) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  }

  let body: {
    status?: unknown;
    reason?: unknown;
    assignedAgentUserId?: unknown;
    refundInitiatedBy?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (body.status !== undefined) {
    if (typeof body.status !== "string" || !STATUSES.includes(body.status as BookingStatus)) {
      return NextResponse.json({ error: "Unknown status." }, { status: 400 });
    }
    const result = await adminTransition(
      params.id,
      body.status as BookingStatus,
      auth.user,
      typeof body.reason === "string" ? body.reason.slice(0, 500) : undefined,
      body.refundInitiatedBy === "operator" ? "operator" : "customer",
    );
    if (!result.ok) {
      return NextResponse.json(
        { error: result.message },
        { status: result.code === "invalid_transition" ? 409 : 404 },
      );
    }
  } else if ("assignedAgentUserId" in body) {
    const agentId =
      body.assignedAgentUserId === null || body.assignedAgentUserId === ""
        ? null
        : typeof body.assignedAgentUserId === "string"
          ? body.assignedAgentUserId
          : undefined;
    if (agentId === undefined) {
      return NextResponse.json({ error: "Invalid agent id." }, { status: 400 });
    }
    const result = await assignBookingAgent(params.id, agentId, auth.user.id);
    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: result.status });
    }
  } else {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const item = await getAdminBooking(params.id);
  return NextResponse.json({ item });
}

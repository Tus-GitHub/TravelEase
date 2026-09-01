import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth-guard";
import { dbErrorResponse } from "@/lib/server/api-errors";
import { deleteCoupon, updateCoupon } from "@/lib/server/admin/coupons";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const auth = await requireRole("admin");
  if (!auth.ok) return auth.response;

  const id = Number(params.id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
  const input: Record<string, unknown> = {};
  if (typeof body.description === "string") input.description = body.description.trim();
  if (num(body.discountValue) !== undefined) input.discountValue = body.discountValue;
  if (body.maxDiscount === null || num(body.maxDiscount) !== undefined) input.maxDiscount = body.maxDiscount;
  if (num(body.minBookingAmount) !== undefined) input.minBookingAmount = body.minBookingAmount;
  if (body.usageLimit === null || num(body.usageLimit) !== undefined) input.usageLimit = body.usageLimit;
  if (num(body.perUserLimit) !== undefined) input.perUserLimit = body.perUserLimit;
  if (typeof body.startsAt === "string" || body.startsAt === null) input.startsAt = body.startsAt;
  if (typeof body.expiresAt === "string" || body.expiresAt === null) input.expiresAt = body.expiresAt;
  if (typeof body.isActive === "boolean") input.isActive = body.isActive;

  try {
    const item = await updateCoupon(id, input, auth.user.id);
    if (!item) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ item });
  } catch (err) {
    const res = dbErrorResponse(err);
    if (res) return res;
    throw err;
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const auth = await requireRole("admin");
  if (!auth.ok) return auth.response;

  const id = Number(params.id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  const ok = await deleteCoupon(id, auth.user.id);
  if (!ok) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

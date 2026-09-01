import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth-guard";
import { createCoupon, listCoupons } from "@/lib/server/admin/coupons";

export async function GET() {
  const auth = await requireRole("admin");
  if (!auth.ok) return auth.response;
  return NextResponse.json({ items: await listCoupons() });
}

export async function POST(request: Request) {
  const auth = await requireRole("admin");
  if (!auth.ok) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
  const result = await createCoupon(
    {
      code: typeof body.code === "string" ? body.code : "",
      description: typeof body.description === "string" ? body.description : undefined,
      discountType: body.discountType === "flat" ? "flat" : "percent",
      discountValue: num(body.discountValue) ?? 0,
      maxDiscount: body.maxDiscount === null ? null : num(body.maxDiscount) ?? null,
      minBookingAmount: num(body.minBookingAmount),
      usageLimit: body.usageLimit === null ? null : num(body.usageLimit) ?? null,
      perUserLimit: num(body.perUserLimit),
      startsAt: typeof body.startsAt === "string" ? body.startsAt : null,
      expiresAt: typeof body.expiresAt === "string" ? body.expiresAt : null,
    },
    auth.user.id,
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 400 });
  }
  return NextResponse.json({ item: result.coupon }, { status: 201 });
}

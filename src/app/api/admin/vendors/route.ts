import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth-guard";
import { createVendor, listVendors } from "@/lib/server/admin/vendors";

export async function GET() {
  const auth = await requireRole("admin");
  if (!auth.ok) return auth.response;
  return NextResponse.json({ items: await listVendors() });
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

  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  const result = await createVendor(
    {
      businessName: str(body.businessName) ?? "",
      contactName: str(body.contactName),
      contactEmail: str(body.contactEmail),
      contactPhone: str(body.contactPhone),
      address: str(body.address),
      payoutDetails: str(body.payoutDetails),
      notes: str(body.notes),
    },
    auth.user.id,
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 400 });
  }
  return NextResponse.json({ item: result.vendor }, { status: 201 });
}

import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth-guard";
import { createDriver, listDrivers } from "@/lib/server/admin/drivers";

export async function GET() {
  const auth = await requireRole("admin");
  if (!auth.ok) return auth.response;
  return NextResponse.json({ items: await listDrivers() });
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
  const result = await createDriver(
    {
      name: str(body.name) ?? "",
      phone: str(body.phone) ?? "",
      licenceNumber: str(body.licenceNumber),
      note: str(body.note),
    },
    auth.user.id,
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 400 });
  }
  return NextResponse.json({ item: result.driver }, { status: 201 });
}

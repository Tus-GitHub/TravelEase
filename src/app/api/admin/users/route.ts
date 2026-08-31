import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth-guard";
import { listUsers } from "@/lib/server/admin/users";

export async function GET() {
  const auth = await requireRole("admin");
  if (!auth.ok) return auth.response;

  return NextResponse.json({ items: await listUsers() });
}

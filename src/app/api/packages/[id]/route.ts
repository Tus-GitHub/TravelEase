import { NextResponse } from "next/server";
import { getPublicPackage } from "@/lib/server/catalogue";

/** GET /api/packages/[id] — one package by numeric id or slug (plan.md §31). */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const pkg = await getPublicPackage(params.id);
  if (!pkg) {
    return NextResponse.json({ error: "Package not found." }, { status: 404 });
  }
  return NextResponse.json({ package: pkg });
}

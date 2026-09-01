import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth-guard";
import { dbErrorResponse } from "@/lib/server/api-errors";
import { createVehicleType, listVehicleTypes } from "@/lib/server/admin/fleet";

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export async function GET() {
  const auth = await requireRole("admin");
  if (!auth.ok) return auth.response;
  return NextResponse.json({ items: await listVehicleTypes() });
}

export async function POST(request: Request) {
  const auth = await requireRole("admin");
  if (!auth.ok) return auth.response;

  let body: { title?: unknown; slug?: unknown; description?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (title.length < 2) {
    return NextResponse.json({ error: "Title is required." }, { status: 400 });
  }
  const slug =
    (typeof body.slug === "string" && body.slug.trim()) || slugify(title);
  const description =
    typeof body.description === "string" ? body.description.trim() : "";

  try {
    const item = await createVehicleType({ slug, title, description }, auth.user.id);
    return NextResponse.json({ item }, { status: 201 });
  } catch (err) {
    const res = dbErrorResponse(err, {
      unique: "A vehicle type with that slug already exists.",
    });
    if (res) return res;
    throw err;
  }
}

import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth-guard";
import { deleteReview, listAllReviews, setReviewPublished } from "@/lib/server/reviews";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const auth = await requireRole("admin");
  if (!auth.ok) return auth.response;
  if (!UUID_RE.test(params.id)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  let body: { isPublished?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (typeof body.isPublished !== "boolean") {
    return NextResponse.json({ error: "isPublished must be a boolean." }, { status: 400 });
  }

  const ok = await setReviewPublished(params.id, body.isPublished, auth.user.id);
  if (!ok) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const item = (await listAllReviews()).find((r) => r.id === params.id) ?? null;
  return NextResponse.json({ item });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const auth = await requireRole("admin");
  if (!auth.ok) return auth.response;
  if (!UUID_RE.test(params.id)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const ok = await deleteReview(params.id, auth.user.id);
  if (!ok) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

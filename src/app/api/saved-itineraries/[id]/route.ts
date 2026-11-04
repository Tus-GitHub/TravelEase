import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/auth-guard";
import {
  deleteSavedItinerary,
  renameSavedItinerary,
} from "@/lib/server/saved-itineraries";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** PATCH /api/saved-itineraries/[id] — rename the caller's saved trip. Body: { title }. */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  if (!UUID_RE.test(params.id)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  let body: { title?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (typeof body.title !== "string" || !body.title.trim()) {
    return NextResponse.json({ error: "A title is required." }, { status: 400 });
  }

  const ok = await renameSavedItinerary(params.id, auth.user.id, body.title);
  if (!ok) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

/** DELETE /api/saved-itineraries/[id] — remove the caller's saved trip. */
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  if (!UUID_RE.test(params.id)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const ok = await deleteSavedItinerary(params.id, auth.user.id);
  if (!ok) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

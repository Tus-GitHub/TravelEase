import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth-guard";
import { isRoleName, setUserRole } from "@/lib/server/admin/users";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const auth = await requireRole("admin");
  if (!auth.ok) return auth.response;

  let body: { role?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (typeof body.role !== "string" || !isRoleName(body.role)) {
    return NextResponse.json(
      { error: "role must be one of: customer, agent, admin." },
      { status: 400 },
    );
  }

  // Don't let an admin strip their own admin access (lock-out guard).
  if (params.id === auth.user.id && body.role !== "admin") {
    return NextResponse.json(
      { error: "You can't change your own role." },
      { status: 400 },
    );
  }

  const updated = await setUserRole(params.id, body.role);
  if (!updated) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }
  return NextResponse.json({ item: updated });
}

import { NextResponse } from "next/server";
import { requireRole, requireUser } from "@/lib/server/auth-guard";
import {
  getPermissionMatrix,
  isAdminSection,
  isPermissionRole,
  setPermission,
} from "@/lib/server/admin/permissions";

// Any authenticated user may read the matrix (the admin shell + section guards
// need it, and agents can be let into /admin). Only admins may change it.
export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  return NextResponse.json({ matrix: await getPermissionMatrix() });
}

export async function PATCH(request: Request) {
  const auth = await requireRole("admin");
  if (!auth.ok) return auth.response;

  let body: { role?: unknown; section?: unknown; isAllowed?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (
    typeof body.role !== "string" ||
    !isPermissionRole(body.role) ||
    typeof body.section !== "string" ||
    !isAdminSection(body.section) ||
    typeof body.isAllowed !== "boolean"
  ) {
    return NextResponse.json(
      { error: "role (agent|customer), section, and isAllowed (boolean) are required." },
      { status: 400 },
    );
  }

  const matrix = await setPermission(
    body.role,
    body.section,
    body.isAllowed,
    auth.user.id,
  );
  return NextResponse.json({ matrix });
}

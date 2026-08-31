import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { findUserById, toPublicUser, type PublicUser } from "./users";
import { getUserIdForToken, SESSION_COOKIE } from "./session";

/**
 * Server-side auth for API routes (plan.md §25). Client-side role checks are
 * UX only — every protected route must call one of these.
 *
 *   const auth = await requireRole("admin");
 *   if (!auth.ok) return auth.response;
 *   // auth.user is the authenticated PublicUser
 */
export type Guard =
  | { ok: true; user: PublicUser }
  | { ok: false; response: NextResponse };

export async function requireUser(): Promise<Guard> {
  const userId = await getUserIdForToken(cookies().get(SESSION_COOKIE)?.value);
  const row = userId ? await findUserById(userId) : undefined;
  if (!row) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Not authenticated." }, { status: 401 }),
    };
  }
  return { ok: true, user: toPublicUser(row) };
}

export async function requireRole(role: PublicUser["role"]): Promise<Guard> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  if (auth.user.role !== role) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden." }, { status: 403 }),
    };
  }
  return auth;
}

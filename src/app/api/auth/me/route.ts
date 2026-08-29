import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { findUserById, toPublicUser } from "@/lib/server/users";
import { getUserIdForToken, SESSION_COOKIE } from "@/lib/server/session";

export async function GET() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  const userId = await getUserIdForToken(token);
  const user = userId ? await findUserById(userId) : undefined;

  return NextResponse.json({ user: user ? toPublicUser(user) : null });
}

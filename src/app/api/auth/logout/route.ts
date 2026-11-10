import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { destroySession, SESSION_COOKIE } from "@/lib/server/session";
import { matchesRequestOrigin } from "@/lib/server/request-origin";

export async function POST(request: Request) {
  if (!matchesRequestOrigin(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const token = cookies().get(SESSION_COOKIE)?.value;
  await destroySession(token);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}

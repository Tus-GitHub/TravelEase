import { NextResponse } from "next/server";
import { verifyCredentials } from "@/lib/server/users";
import { createSession, SESSION_COOKIE } from "@/lib/server/session";
import { logActivity, clientIp } from "@/lib/server/activity-log";

export async function POST(request: Request) {
  let body: { email?: string; password?: string; rememberMe?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = body.email?.trim() ?? "";
  const password = body.password ?? "";
  const rememberMe = body.rememberMe === true;

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 },
    );
  }

  const user = await verifyCredentials(email, password);
  if (!user) {
    return NextResponse.json(
      { error: "Invalid email or password." },
      { status: 401 },
    );
  }
  if (!user.emailVerified) {
    return NextResponse.json(
      {
        error: "Verify your email to sign in — check your inbox for the link.",
        code: "email_not_verified",
      },
      { status: 403 },
    );
  }

  const { token, maxAge } = await createSession(user.id, rememberMe);
  await logActivity({
    userId: user.id,
    action: "user.login",
    entityType: "user",
    entityId: user.id,
    ipAddress: clientIp(request),
  });
  const response = NextResponse.json({ user });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(maxAge !== undefined ? { maxAge } : {}),
  });
  return response;
}

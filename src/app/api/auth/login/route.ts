import { NextResponse } from "next/server";
import { passwordLogin } from "@/lib/server/password-login";
import { SESSION_COOKIE } from "@/lib/server/session";
import { logActivity, clientIp } from "@/lib/server/activity-log";
import { readAuthBody } from "@/lib/server/auth-request";

export async function POST(request: Request) {
  const input = await readAuthBody(request);
  if (!input.ok) return input.response;
  const { body } = input;

  const email = body.email?.trim() ?? "";
  const password = body.password ?? "";
  const rememberMe = body.rememberMe === true;

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 },
    );
  }

  const result = await passwordLogin(email, password, rememberMe);
  if (!result.ok && result.reason === "invalid") {
    return NextResponse.json(
      { error: "Invalid email or password." },
      { status: 401 },
    );
  }
  if (!result.ok) {
    return NextResponse.json(
      {
        error: "Verify your email to sign in — check your inbox for the link.",
        code: "email_not_verified",
      },
      { status: 403 },
    );
  }

  const { user, token, maxAge } = result;
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

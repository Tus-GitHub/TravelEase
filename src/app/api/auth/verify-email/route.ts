import { NextResponse } from "next/server";
import { consumeAuthToken } from "@/lib/server/auth-tokens";
import { markEmailVerified } from "@/lib/server/users";
import { createSession, SESSION_COOKIE } from "@/lib/server/session";
import { appOrigin } from "@/lib/server/email";

/**
 * Target of the emailed verification link (plan.md §24). A single-use token
 * marks the account verified and signs the user in (the row already exists —
 * Model A). A bad / expired / already-used token bounces to /login with a
 * notice so the page can offer a fresh link.
 */
export async function GET(request: Request) {
  const base = appOrigin();
  const token = new URL(request.url).searchParams.get("token");

  const consumed = await consumeAuthToken("email_verification", token);
  if (!consumed) {
    return NextResponse.redirect(new URL("/login?verify=invalid", base));
  }

  await markEmailVerified(consumed.userId);

  const { token: sessionToken, maxAge } = await createSession(consumed.userId, false);
  const response = NextResponse.redirect(new URL("/?verified=1", base));
  response.cookies.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(maxAge !== undefined ? { maxAge } : {}),
  });
  return response;
}

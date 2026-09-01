import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { appOrigin } from "@/lib/server/email";

/**
 * Start the Google OAuth 2.0 authorization-code flow (plan.md §21). Redirects to
 * Google with a fresh `state` (CSRF) and `nonce` (id_token binding), both stashed
 * in short-lived httpOnly cookies that `/api/auth/google/callback` checks back.
 * If Google credentials aren't configured it degrades to the old "coming soon"
 * bounce so nothing breaks.
 */
const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";

export async function GET(request: Request) {
  const next =
    new URL(request.url).searchParams.get("next") === "/signup" ? "/signup" : "/login";
  const clientId = process.env.GOOGLE_CLIENT_ID;

  if (!clientId || !process.env.GOOGLE_CLIENT_SECRET) {
    const dest = new URL(next, appOrigin());
    dest.searchParams.set("notice", "google-soon");
    return NextResponse.redirect(dest);
  }

  const state = randomBytes(16).toString("hex");
  const nonce = randomBytes(16).toString("hex");

  const auth = new URL(GOOGLE_AUTH_ENDPOINT);
  auth.searchParams.set("client_id", clientId);
  auth.searchParams.set("redirect_uri", `${appOrigin()}/api/auth/google/callback`);
  auth.searchParams.set("response_type", "code");
  auth.searchParams.set("scope", "openid email profile");
  auth.searchParams.set("state", state);
  auth.searchParams.set("nonce", nonce);
  auth.searchParams.set("access_type", "online");
  auth.searchParams.set("prompt", "select_account");

  const res = NextResponse.redirect(auth);
  const opts = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600, // 10 minutes to finish the round trip
  };
  res.cookies.set("g_oauth_state", state, opts);
  res.cookies.set("g_oauth_nonce", nonce, opts);
  return res;
}

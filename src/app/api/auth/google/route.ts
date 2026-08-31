import { NextResponse } from "next/server";

/**
 * Placeholder for Google OAuth.
 *
 * The Sign In / Sign Up pages link their "Continue with Google" button here so
 * the flow is wired end-to-end on the frontend. To go live, replace this
 * handler with a real OAuth 2.0 dance: redirect to Google's authorization
 * endpoint, handle the callback, look up / create the user, then
 * `createSession()` + set the `SESSION_COOKIE` (exactly as the email/password
 * routes already do). Until Google credentials are configured it bounces the
 * user back to the auth page with a friendly notice — nothing breaks.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = url.searchParams.get("next") === "/signup" ? "/signup" : "/login";
  const dest = new URL(next, url.origin);
  dest.searchParams.set("notice", "google-soon");
  return NextResponse.redirect(dest);
}

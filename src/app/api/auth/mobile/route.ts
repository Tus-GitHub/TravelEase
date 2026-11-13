import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { appOrigin } from "@/lib/server/email";
import { mobileConfig, MOBILE_FLOW_COOKIE, MOBILE_FLOW_TTL, mobileAuthorizationUrl, newMobileFlow, sealMobileFlow } from "@/lib/server/authgear";
import { SESSION_COOKIE, getUserIdForToken } from "@/lib/server/session";
import { findUserById } from "@/lib/server/users";
import { matchesRequestOrigin } from "@/lib/server/request-origin";
import { loginReturnPath } from "@/lib/auth-redirect";

export const dynamic = "force-dynamic";

async function start(request: Request, linking: boolean) {
  if (linking && !matchesRequestOrigin(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const config = mobileConfig();
  const fallback = new URL(linking ? "/profile" : "/login", appOrigin());
  if (!linking) fallback.searchParams.set("redirect", loginReturnPath(new URL(request.url).searchParams.get("redirect")));
  if (!config) {
    fallback.searchParams.set("notice", "mobile-unavailable");
    return NextResponse.redirect(fallback, 303);
  }
  let link: { userId: string; token: string } | undefined;
  if (linking) {
    const token = cookies().get(SESSION_COOKIE)?.value;
    const userId = await getUserIdForToken(token);
    const user = userId ? await findUserById(userId) : undefined;
    if (!token || !user || !user.email_verified_at) return NextResponse.json({ error: "Sign in with a verified account first." }, { status: 401 });
    link = { userId: user.user_id, token };
  }
  const flow = newMobileFlow(new URL(request.url).searchParams.get("redirect"), link);
  const response = NextResponse.redirect(mobileAuthorizationUrl(config, flow, appOrigin()), 303);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.cookies.set(MOBILE_FLOW_COOKIE, await sealMobileFlow(flow, config), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: MOBILE_FLOW_TTL,
  });
  return response;
}

/** GET only starts sign-in; account linking always requires a same-origin POST. */
export async function GET(request: Request) { return start(request, false); }
export async function POST(request: Request) { return start(request, true); }

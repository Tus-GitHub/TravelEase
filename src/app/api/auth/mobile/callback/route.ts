import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { appOrigin } from "@/lib/server/email";
import { mobileConfig, MOBILE_FLOW_COOKIE, openMobileFlow, verifyMobileCode } from "@/lib/server/authgear";
import { finishMobileLogin, MobileAccountError } from "@/lib/server/mobile-login";
import { SESSION_COOKIE } from "@/lib/server/session";
import { loginReturnPath } from "@/lib/auth-redirect";
import { logActivity, clientIp } from "@/lib/server/activity-log";

export const dynamic = "force-dynamic";

function redirect(path: string, notice?: string) {
  const url = new URL(path, appOrigin());
  if (notice) url.searchParams.set("notice", notice);
  const response = NextResponse.redirect(url, 303);
  response.cookies.set(MOBILE_FLOW_COOKIE, "", { path: "/", maxAge: 0 });
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export async function GET(request: Request) {
  const config = mobileConfig();
  if (!config) return redirect("/login", "mobile-unavailable");
  let linking = false;
  let returnTo = "/";
  try {
    const encrypted = cookies().get(MOBILE_FLOW_COOKIE)?.value;
    if (!encrypted) throw new Error("Missing flow");
    const flow = await openMobileFlow(encrypted, config);
    linking = Boolean(flow.userId);
    returnTo = loginReturnPath(flow.returnTo);
    const params = new URL(request.url).searchParams;
    if (params.getAll("state").length !== 1 || params.get("state") !== flow.state) throw new Error("Invalid state");
    if (params.has("error")) return redirect(linking ? "/profile" : "/login", "mobile-cancelled");
    const code = params.get("code");
    if (!code || code.length > 4096 || params.getAll("code").length !== 1) throw new Error("Invalid code");
    const identity = await verifyMobileCode(config, flow, code, appOrigin());
    const result = await finishMobileLogin(identity, flow, cookies().get(SESSION_COOKIE)?.value);
    await logActivity({ userId: result.userId, action: result.linked ? "user.mobile_link" : "user.login",
      entityType: "user", entityId: result.userId, details: { provider: "authgear" }, ipAddress: clientIp(request) });
    if (result.linked) return redirect("/profile", "mobile-linked");
    const response = redirect(result.role === "driver" ? "/drive" : returnTo);
    response.cookies.set(SESSION_COOKIE, result.token, {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/",
    });
    return response;
  } catch (error) {
    const notice = error instanceof MobileAccountError && error.message === "unlinked" ? "mobile-unlinked" : "mobile-failed";
    const path = linking ? "/profile" : `/login?redirect=${encodeURIComponent(returnTo)}`;
    // Deliberately don't log callback URLs, phone numbers, cookies or provider tokens.
    return redirect(path, notice);
  }
}

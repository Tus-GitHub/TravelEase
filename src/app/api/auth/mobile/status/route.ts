import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getPool } from "@/lib/server/db";
import { mobileConfig } from "@/lib/server/authgear";
import { SESSION_COOKIE, getUserIdForToken } from "@/lib/server/session";
import { findUserById } from "@/lib/server/users";
import { matchesRequestOrigin } from "@/lib/server/request-origin";
import { unlinkMobile } from "@/lib/server/mobile-login";
import { logActivity, clientIp } from "@/lib/server/activity-log";

export const dynamic = "force-dynamic";
export async function GET() {
  const userId = await getUserIdForToken(cookies().get(SESSION_COOKIE)?.value);
  if (!userId || !await findUserById(userId)) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const result = await getPool().query("SELECT 1 FROM user_auth_providers WHERE user_id=$1 AND provider='authgear' LIMIT 1", [userId]);
  return NextResponse.json({ enabled: mobileConfig() !== null, linked: result.rows.length > 0 }, { headers: { "Cache-Control": "no-store" } });
}
export async function DELETE(request: Request) {
  if (!matchesRequestOrigin(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const token = cookies().get(SESSION_COOKIE)?.value;
  const userId = await getUserIdForToken(token);
  if (!token || !userId || !await unlinkMobile(userId, token)) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  await logActivity({ userId, action: "user.mobile_unlink", entityType: "user", entityId: userId,
    details: { provider: "authgear" }, ipAddress: clientIp(request) });
  return NextResponse.json({ ok: true });
}

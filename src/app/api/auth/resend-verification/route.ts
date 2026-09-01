import { NextResponse } from "next/server";
import { findUserByEmail } from "@/lib/server/users";
import { createAuthToken, hasRecentToken } from "@/lib/server/auth-tokens";
import { sendVerificationEmail, appOrigin } from "@/lib/server/email";
import { isValidEmail } from "@/lib/validation";

/**
 * Re-send the verification link. Always responds { ok: true } for a well-formed
 * address — it never reveals whether an account exists or is already verified
 * (plan.md §25/§27). Silently throttled to one send per minute per account.
 */
export async function POST(request: Request) {
  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = body.email?.trim() ?? "";
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const user = await findUserByEmail(email);
  if (user && user.email_verified_at == null) {
    try {
      if (!(await hasRecentToken("email_verification", user.user_id, 60))) {
        const token = await createAuthToken("email_verification", user.user_id);
        await sendVerificationEmail(
          user.email,
          user.name,
          `${appOrigin()}/api/auth/verify-email?token=${token}`,
        );
      }
    } catch (err) {
      // Swallow transport errors so the response can't be used to probe accounts.
      console.error("resend-verification: send failed", err);
    }
  }

  return NextResponse.json({ ok: true });
}

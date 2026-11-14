import { NextResponse } from "next/server";
import { findUserByEmail } from "@/lib/server/users";
import { createAuthTokenWithCooldown } from "@/lib/server/auth-tokens";
import { sendVerificationEmail, appOrigin } from "@/lib/server/email";
import { isValidEmail } from "@/lib/validation";
import { readAuthBody } from "@/lib/server/auth-request";
import { getPool } from "@/lib/server/db";
import { accountMailbox } from "@/lib/server/login-identifier";

/**
 * Re-send the verification link. Always responds { ok: true } for a well-formed
 * address — it never reveals whether an account exists or is already verified
 * (plan.md §25/§27). Silently throttled to one send per minute per account.
 */
export async function POST(request: Request) {
  const input = await readAuthBody(request);
  if (!input.ok) return input.response;
  const { body } = input;

  const email = body.email?.trim() ?? "";
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const user = await findUserByEmail(email);
  if (user && user.email_verified_at == null) {
    try {
      const recipient = await accountMailbox(getPool(), user.user_id, user.email);
      if (!recipient) return NextResponse.json({ ok: true });
      const token = await createAuthTokenWithCooldown("email_verification", user.user_id, 60);
      if (token) {
        await sendVerificationEmail(
          recipient,
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

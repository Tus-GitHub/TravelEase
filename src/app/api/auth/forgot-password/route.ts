import { NextResponse } from "next/server";
import { findUserByEmail } from "@/lib/server/users";
import { createAuthTokenWithCooldown } from "@/lib/server/auth-tokens";
import { sendPasswordResetEmail, appOrigin } from "@/lib/server/email";
import { isValidEmail } from "@/lib/validation";
import { readAuthBody } from "@/lib/server/auth-request";

/**
 * Start a password reset (plan.md §24). Always responds { ok: true } for a
 * well-formed address — never reveals whether the account exists. Throttled to
 * one email per minute per account.
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
  if (user) {
    try {
      const token = await createAuthTokenWithCooldown("password_reset", user.user_id, 60);
      if (token) {
        await sendPasswordResetEmail(
          user.email,
          user.name,
          `${appOrigin()}/reset-password?token=${token}`,
        );
      }
    } catch (err) {
      console.error("forgot-password: send failed", err);
    }
  }

  return NextResponse.json({ ok: true });
}

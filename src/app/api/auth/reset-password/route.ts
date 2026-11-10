import { NextResponse } from "next/server";
import { redeemAuthToken } from "@/lib/server/auth-tokens";
import { setUserPassword, markEmailVerified } from "@/lib/server/users";
import { destroyAllSessionsForUser } from "@/lib/server/session";
import { PASSWORD_MIN_LENGTH } from "@/lib/validation";
import { readAuthBody } from "@/lib/server/auth-request";

/**
 * Complete a password reset (plan.md §24). Consumes the single-use token, sets
 * the new hash, and invalidates every existing session for that user. A valid
 * reset also proves email ownership, so the account is marked verified.
 */
export async function POST(request: Request) {
  const input = await readAuthBody(request);
  if (!input.ok) return input.response;
  const { body } = input;

  const token = body.token ?? "";
  const password = body.password ?? "";

  if (password.length < PASSWORD_MIN_LENGTH) {
    return NextResponse.json(
      { error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.` },
      { status: 400 },
    );
  }

  const changed = await redeemAuthToken("password_reset", token, async (userId, client) => {
    await setUserPassword(userId, password, client);
    await markEmailVerified(userId, client);
    await destroyAllSessionsForUser(userId, client);
    return true;
  });
  if (!changed) {
    return NextResponse.json(
      { error: "This reset link is invalid or has expired. Request a new one." },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true });
}

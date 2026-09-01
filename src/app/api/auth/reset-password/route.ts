import { NextResponse } from "next/server";
import { consumeAuthToken } from "@/lib/server/auth-tokens";
import { setUserPassword, markEmailVerified } from "@/lib/server/users";
import { destroyAllSessionsForUser } from "@/lib/server/session";
import { PASSWORD_MIN_LENGTH } from "@/lib/validation";

/**
 * Complete a password reset (plan.md §24). Consumes the single-use token, sets
 * the new hash, and invalidates every existing session for that user. A valid
 * reset also proves email ownership, so the account is marked verified.
 */
export async function POST(request: Request) {
  let body: { token?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const token = body.token ?? "";
  const password = body.password ?? "";

  if (password.length < PASSWORD_MIN_LENGTH) {
    return NextResponse.json(
      { error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.` },
      { status: 400 },
    );
  }

  const consumed = await consumeAuthToken("password_reset", token);
  if (!consumed) {
    return NextResponse.json(
      { error: "This reset link is invalid or has expired. Request a new one." },
      { status: 400 },
    );
  }

  await setUserPassword(consumed.userId, password);
  await markEmailVerified(consumed.userId);
  await destroyAllSessionsForUser(consumed.userId);

  return NextResponse.json({ ok: true });
}

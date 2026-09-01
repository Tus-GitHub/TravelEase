import { NextResponse } from "next/server";
import { createUser, findUserByEmail } from "@/lib/server/users";
import { isUniqueViolation } from "@/lib/server/db-errors";
import { createAuthToken } from "@/lib/server/auth-tokens";
import { sendVerificationEmail, appOrigin } from "@/lib/server/email";
import { isValidEmail, isValidPhone, PASSWORD_MIN_LENGTH } from "@/lib/validation";

export async function POST(request: Request) {
  let body: { name?: string; email?: string; phone?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const name = body.name?.trim() ?? "";
  const email = body.email?.trim() ?? "";
  const phone = body.phone?.trim() ?? "";
  const password = body.password ?? "";

  if (name.length < 2) {
    return NextResponse.json(
      { error: "Please enter your full name." },
      { status: 400 },
    );
  }
  if (!isValidEmail(email)) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 },
    );
  }
  if (!isValidPhone(phone)) {
    return NextResponse.json(
      { error: "Please enter a valid phone number." },
      { status: 400 },
    );
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return NextResponse.json(
      { error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.` },
      { status: 400 },
    );
  }
  if (await findUserByEmail(email)) {
    return NextResponse.json(
      { error: "An account with this email already exists." },
      { status: 409 },
    );
  }

  let user;
  try {
    user = await createUser(name, email, phone, password);
  } catch (err) {
    // Two signups for the same email can both clear the check above and race to
    // INSERT; the users.email UNIQUE index is the real guard. Report it the same
    // way rather than 500-ing the loser.
    if (isUniqueViolation(err)) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 },
      );
    }
    throw err;
  }

  // The account exists but is unverified — no session is issued. Login stays
  // blocked until the verification link is clicked (plan.md §24).
  try {
    const token = await createAuthToken("email_verification", user.id);
    await sendVerificationEmail(
      user.email,
      user.name,
      `${appOrigin()}/api/auth/verify-email?token=${token}`,
    );
  } catch (err) {
    console.error("signup: verification email failed", err);
    return NextResponse.json(
      {
        error:
          "Your account was created, but we couldn't send the verification email. Try resending it in a minute.",
      },
      { status: 502 },
    );
  }

  return NextResponse.json(
    { ok: true, requiresVerification: true, email: user.email },
    { status: 201 },
  );
}

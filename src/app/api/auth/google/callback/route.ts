import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { appOrigin } from "@/lib/server/email";
import { isUniqueViolation } from "@/lib/server/db-errors";
import {
  findUserByEmail,
  createFederatedUser,
  markEmailVerified,
  setUserPassword,
} from "@/lib/server/users";
import { findUserIdByProvider, linkProvider } from "@/lib/server/auth-providers";
import { createSession, SESSION_COOKIE } from "@/lib/server/session";

/**
 * Google OAuth callback (plan.md §21–22). Exchanges the code for an id_token,
 * validates its claims, then resolves a Jagdamba Travellers user:
 *   linked Google identity  ->  that user
 *   existing email          ->  link Google to it (and, if that account was
 *                               never verified, invalidate its password so a
 *                               pre-registered password can't hijack it)
 *   neither                 ->  create a fresh 'customer'
 * Finally it issues an ordinary session — the same one the email/password
 * routes use. Any failure bounces to /login with a friendly notice.
 */
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

function bounce(notice: string): NextResponse {
  const dest = new URL("/login", appOrigin());
  dest.searchParams.set("notice", notice);
  return clearOauthCookies(NextResponse.redirect(dest));
}

function clearOauthCookies(res: NextResponse): NextResponse {
  res.cookies.set("g_oauth_state", "", { path: "/", maxAge: 0 });
  res.cookies.set("g_oauth_nonce", "", { path: "/", maxAge: 0 });
  return res;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const jar = cookies();
  const stateCookie = jar.get("g_oauth_state")?.value;
  const nonceCookie = jar.get("g_oauth_nonce")?.value;

  if (url.searchParams.get("error")) return bounce("google-cancelled");

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state || !stateCookie || state !== stateCookie) {
    return bounce("google-failed");
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return bounce("google-soon");

  // 1. Exchange the code for tokens (server-to-server, over TLS).
  let idToken: string;
  try {
    const tokenRes = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${appOrigin()}/api/auth/google/callback`,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) throw new Error(`token endpoint ${tokenRes.status}`);
    const json = (await tokenRes.json()) as { id_token?: string };
    if (!json.id_token) throw new Error("no id_token in response");
    idToken = json.id_token;
  } catch (err) {
    console.error("google callback: token exchange failed", err);
    return bounce("google-failed");
  }

  // 2. Decode + validate the ID token. It came straight from Google's token
  //    endpoint over TLS, so we check the claims rather than the JWT signature.
  let claims: {
    sub?: string;
    email?: string;
    email_verified?: boolean | string;
    name?: string;
    aud?: string;
    iss?: string;
    exp?: number;
    nonce?: string;
  };
  try {
    claims = JSON.parse(
      Buffer.from(idToken.split(".")[1], "base64url").toString("utf8"),
    );
  } catch {
    return bounce("google-failed");
  }

  const emailVerified =
    claims.email_verified === true || claims.email_verified === "true";
  const issOk =
    claims.iss === "accounts.google.com" ||
    claims.iss === "https://accounts.google.com";

  if (
    !claims.sub ||
    !claims.email ||
    !emailVerified ||
    claims.aud !== clientId ||
    !issOk ||
    (claims.exp ?? 0) * 1000 < Date.now() ||
    (nonceCookie ? claims.nonce !== nonceCookie : false)
  ) {
    return bounce("google-failed");
  }

  const googleId = claims.sub;
  const email = claims.email.trim().toLowerCase();
  const name = (claims.name ?? "").trim();

  // 3. Resolve the Jagdamba Travellers user.
  let userId = await findUserIdByProvider("google", googleId);

  if (!userId) {
    const existing = await findUserByEmail(email);
    if (existing) {
      userId = existing.user_id;
      // An unverified pre-existing account could have been pre-registered by
      // someone else with a password. Google just proved ownership, so mark it
      // verified — and scramble that password so only Google / a fresh reset
      // can get in.
      if (existing.email_verified_at == null) {
        await setUserPassword(userId, randomBytes(24).toString("hex"));
      }
      await markEmailVerified(userId);
    } else {
      try {
        userId = (await createFederatedUser(name, email)).id;
      } catch (err) {
        if (isUniqueViolation(err)) {
          userId = (await findUserByEmail(email))?.user_id ?? null;
        } else {
          console.error("google callback: user creation failed", err);
          return bounce("google-failed");
        }
      }
    }

    if (!userId) return bounce("google-failed");
    await linkProvider(userId, "google", googleId, email);
  }

  // 4. Ordinary session — no bespoke OAuth auth path (plan.md §21).
  const { token, maxAge } = await createSession(userId, true);
  const res = clearOauthCookies(NextResponse.redirect(new URL("/", appOrigin())));
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(maxAge !== undefined ? { maxAge } : {}),
  });
  return res;
}

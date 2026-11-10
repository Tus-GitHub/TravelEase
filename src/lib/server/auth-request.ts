import { NextResponse } from "next/server";
import { readBoundedJsonObject } from "./http-json";
import { matchesRequestOrigin } from "./request-origin";

interface AuthBody {
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
  token?: string;
  rememberMe?: boolean;
}

// Column limits for identity fields; passwords are bounded before scrypt.
const limits = { name: 200, email: 320, phone: 30, password: 1024, token: 64 } as const;

/** Validate unknown JSON before auth handlers read fields or perform DB work. */
export async function readAuthBody(request: Request): Promise<
  { ok: true; body: AuthBody } | { ok: false; response: NextResponse }
> {
  if (!matchesRequestOrigin(request)) {
    return { ok: false, response: NextResponse.json({ error: "Invalid origin." }, { status: 403 }) };
  }
  try {
    const body = await readBoundedJsonObject(request.body, 20 * 1024);
    for (const [field, limit] of Object.entries(limits)) {
      const value = body[field];
      if (value !== undefined && (typeof value !== "string" || value.length > limit)) throw new Error("Invalid field");
    }
    if (body.rememberMe !== undefined && typeof body.rememberMe !== "boolean") throw new Error("Invalid rememberMe");
    return { ok: true, body: body as AuthBody };
  } catch {
    return { ok: false, response: NextResponse.json({ error: "Invalid request body." }, { status: 400 }) };
  }
}

import { createHash, randomBytes } from "crypto";
import { EncryptJWT, jwtDecrypt, jwtVerify, createRemoteJWKSet } from "jose";
import { loginReturnPath } from "../auth-redirect";

export const MOBILE_FLOW_COOKIE = "mobile_oauth";
export const MOBILE_CALLBACK = "/api/auth/mobile/callback";
export const MOBILE_FLOW_TTL = 600;
const SCOPE = "openid https://authgear.com/scopes/full-userinfo";

export interface MobileConfig { endpoint: string; clientId: string; clientSecret: string }
export interface MobileFlow {
  state: string; nonce: string; verifier: string; returnTo: string;
  userId?: string; sessionHash?: string;
}

/** Disabled until the operator verifies the Free plan and SMS settings. No billing API is used. */
export function mobileConfig(): MobileConfig | null {
  if (process.env.AUTHGEAR_MOBILE_ENABLED !== "true") return null;
  const clientId = process.env.AUTHGEAR_CLIENT_ID;
  const clientSecret = process.env.AUTHGEAR_CLIENT_SECRET;
  try {
    const url = new URL(process.env.AUTHGEAR_ENDPOINT ?? "");
    // This release supports Authgear Cloud only. Never discover user-supplied URLs.
    if (url.protocol !== "https:" || !url.hostname.endsWith(".authgear.cloud") ||
        url.port || url.username || url.password || url.search || url.hash || url.pathname !== "/" ||
        !clientId || !clientSecret) return null;
    return { endpoint: url.origin, clientId, clientSecret };
  } catch { return null; }
}

export function sessionHash(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}

function flowKey(config: MobileConfig) {
  return createHash("sha256").update(`mobile-flow\0${config.endpoint}\0${config.clientId}\0${config.clientSecret}`).digest();
}

export function newMobileFlow(returnTo: string | null, link?: { userId: string; token: string }): MobileFlow {
  return {
    state: randomBytes(32).toString("base64url"), nonce: randomBytes(32).toString("base64url"),
    verifier: randomBytes(32).toString("base64url"), returnTo: loginReturnPath(returnTo),
    ...(link ? { userId: link.userId, sessionHash: sessionHash(link.token) } : {}),
  };
}

export async function sealMobileFlow(flow: MobileFlow, config: MobileConfig): Promise<string> {
  return new EncryptJWT({ ...flow }).setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setAudience("mobile-login").setIssuedAt().setExpirationTime(`${MOBILE_FLOW_TTL}s`).encrypt(flowKey(config));
}

export async function openMobileFlow(value: string, config: MobileConfig): Promise<MobileFlow> {
  const { payload } = await jwtDecrypt(value, flowKey(config), {
    audience: "mobile-login", keyManagementAlgorithms: ["dir"], contentEncryptionAlgorithms: ["A256GCM"],
    requiredClaims: ["exp", "iat"], maxTokenAge: MOBILE_FLOW_TTL,
  });
  for (const key of ["state", "nonce", "verifier", "returnTo"] as const) {
    if (typeof payload[key] !== "string" || !payload[key]) throw new Error("Invalid flow");
  }
  if ((payload.userId !== undefined || payload.sessionHash !== undefined) &&
      (typeof payload.userId !== "string" || typeof payload.sessionHash !== "string")) throw new Error("Invalid link");
  return payload as unknown as MobileFlow;
}

async function providerJson(url: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const response = await fetch(url, { ...init, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error("Mobile provider unavailable");
  const text = await response.text();
  if (text.length > 256 * 1024) throw new Error("Invalid provider response");
  const result: unknown = JSON.parse(text);
  if (!result || typeof result !== "object" || Array.isArray(result)) throw new Error("Invalid provider response");
  return result as Record<string, unknown>;
}

async function discovery(config: MobileConfig) {
  const metadata = await providerJson(`${config.endpoint}/.well-known/openid-configuration`);
  if (typeof metadata.issuer !== "string" || metadata.issuer.replace(/\/$/, "") !== config.endpoint ||
      typeof metadata.jwks_uri !== "string") throw new Error("Invalid issuer");
  const jwks = new URL(metadata.jwks_uri);
  if (jwks.origin !== config.endpoint || jwks.username || jwks.password || jwks.hash) throw new Error("Invalid JWKS");
  return { issuer: metadata.issuer, jwks };
}

export function mobileAuthorizationUrl(config: MobileConfig, flow: MobileFlow, origin: string): URL {
  const url = new URL(`${config.endpoint}/oauth2/authorize`);
  url.search = new URLSearchParams({
    client_id: config.clientId, redirect_uri: `${origin}${MOBILE_CALLBACK}`, response_type: "code",
    scope: SCOPE, state: flow.state, nonce: flow.nonce, prompt: "login", max_age: "0",
    code_challenge_method: "S256", code_challenge: createHash("sha256").update(flow.verifier).digest("base64url"),
  }).toString();
  return url;
}

const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

/** Only a signed, fresh OIDC identity AND matching verified phone claim are accepted. */
export async function verifyMobileCode(config: MobileConfig, flow: MobileFlow, code: string, origin: string): Promise<string> {
  const metadata = await discovery(config);
  const tokens = await providerJson(`${config.endpoint}/oauth2/token`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code, client_id: config.clientId,
      client_secret: config.clientSecret, redirect_uri: `${origin}${MOBILE_CALLBACK}`, code_verifier: flow.verifier }),
  });
  if (typeof tokens.id_token !== "string" || typeof tokens.access_token !== "string") throw new Error("Missing tokens");
  let keys = keySets.get(metadata.jwks.href);
  if (!keys) {
    keys = createRemoteJWKSet(metadata.jwks, { timeoutDuration: 10_000 });
    keySets.set(metadata.jwks.href, keys);
  }
  const { payload } = await jwtVerify(tokens.id_token, keys, {
    issuer: metadata.issuer, audience: config.clientId, algorithms: ["RS256"],
    requiredClaims: ["sub", "exp", "iat", "nonce", "auth_time"], maxTokenAge: MOBILE_FLOW_TTL, clockTolerance: 5,
  });
  const now = Date.now() / 1000;
  if (payload.nonce !== flow.nonce || !payload.sub ||
      (payload.azp !== undefined && payload.azp !== config.clientId) ||
      (Array.isArray(payload.aud) && payload.aud.length > 1 && payload.azp !== config.clientId) ||
      typeof payload.auth_time !== "number" || payload.auth_time > now + 5 || payload.auth_time < now - MOBILE_FLOW_TTL) {
    throw new Error("Invalid mobile identity");
  }
  const info = await providerJson(`${config.endpoint}/oauth2/userinfo`, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (info.sub !== payload.sub || info.phone_number_verified !== true ||
      typeof info.phone_number !== "string" || !/^\+[1-9]\d{7,14}$/.test(info.phone_number)) throw new Error("Phone not verified");
  // Include issuer so changing projects cannot accidentally reuse another project's subject.
  return createHash("sha256").update(`${metadata.issuer}\0${payload.sub}`).digest("hex");
}

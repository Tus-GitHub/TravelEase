import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPair, exportJWK, SignJWT, EncryptJWT } from "jose";
import { createHash } from "node:crypto";
import { mobileConfig, newMobileFlow, sealMobileFlow, openMobileFlow, mobileAuthorizationUrl, verifyMobileCode } from "../../src/lib/server/authgear";

const config = { endpoint: "https://test.authgear.cloud", clientId: "test-client", clientSecret: "test-only-secret" };

test("mobile auth is opt-in and only accepts a fixed Authgear Cloud endpoint", () => {
  const previous = { ...process.env };
  try {
    delete process.env.AUTHGEAR_MOBILE_ENABLED;
    assert.equal(mobileConfig(), null);
    Object.assign(process.env, { AUTHGEAR_MOBILE_ENABLED: "true", AUTHGEAR_ENDPOINT: config.endpoint,
      AUTHGEAR_CLIENT_ID: config.clientId, AUTHGEAR_CLIENT_SECRET: config.clientSecret });
    assert.deepEqual(mobileConfig(), config);
    for (const endpoint of ["http://test.authgear.cloud", "https://evil.test", "https://test.authgear.cloud.evil.test", "https://test.authgear.cloud/path", "https://test.authgear.cloud?next=evil", "https://user@test.authgear.cloud"]) {
      process.env.AUTHGEAR_ENDPOINT = endpoint;
      assert.equal(mobileConfig(), null, endpoint);
    }
  } finally { process.env = previous; }
});

test("encrypted OAuth flow binds state, nonce, PKCE, session and safe return path", async () => {
  const flow = newMobileFlow("//evil.test", { userId: "local-user", token: "private-session" });
  assert.equal(flow.returnTo, "/");
  assert.notEqual(flow.state, newMobileFlow("/").state);
  const encrypted = await sealMobileFlow(flow, config);
  assert.ok(!encrypted.includes("private-session"));
  const opened = await openMobileFlow(encrypted, config);
  for (const field of Object.keys(flow) as (keyof typeof flow)[]) assert.equal(opened[field], flow[field]);
  await assert.rejects(openMobileFlow(encrypted + "tampered", config));
  await assert.rejects(openMobileFlow(encrypted, { ...config, clientSecret: "different" }));
  const key = createHash("sha256").update(`mobile-flow\0${config.endpoint}\0${config.clientId}\0${config.clientSecret}`).digest();
  const expired = await new EncryptJWT({ ...flow }).setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setAudience("mobile-login").setIssuedAt(1).setExpirationTime(2).encrypt(key);
  await assert.rejects(openMobileFlow(expired, config));
  const url = mobileAuthorizationUrl(config, flow, "http://localhost:3000");
  assert.equal(url.searchParams.get("code_challenge"), createHash("sha256").update(flow.verifier).digest("base64url"));
  assert.equal(url.searchParams.get("prompt"), "login");
  assert.equal(url.searchParams.get("max_age"), "0");
  assert.equal(url.searchParams.get("redirect_uri"), "http://localhost:3000/api/auth/mobile/callback");
  assert.ok(!url.href.includes(config.clientSecret));
  assert.ok(!url.searchParams.get("scope")!.includes("offline_access"));
});

test("OIDC rejects forged, stale or mismatched identities and requires a verified mobile", async (t) => {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = { ...await exportJWK(publicKey), kid: "test-key", alg: "RS256", use: "sig" };
  const wrongKey = (await generateKeyPair("RS256")).privateKey;
  const flow = newMobileFlow("/bookings");
  const originalFetch = globalThis.fetch;
  let issuer = config.endpoint;
  let jwksUri = `${config.endpoint}/oauth2/jwks`;
  let token = "";
  let info: Record<string, unknown> = {};
  let exchangeStatus = 200;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith("/.well-known/openid-configuration")) return Response.json({ issuer, jwks_uri: jwksUri });
    if (url.endsWith("/oauth2/jwks")) return Response.json({ keys: [jwk] });
    if (url.endsWith("/oauth2/token")) {
      const body = new URLSearchParams(String(init?.body));
      assert.equal(body.get("code_verifier"), flow.verifier);
      assert.equal(body.get("client_secret"), config.clientSecret);
      return Response.json({ id_token: token, access_token: "test-access" }, { status: exchangeStatus });
    }
    if (url.endsWith("/oauth2/userinfo")) return Response.json(info);
    throw new Error("Unexpected URL");
  };
  async function signed(overrides: Record<string, unknown> = {}, forged = false) {
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({ iss: config.endpoint, aud: config.clientId, sub: "authgear-subject", iat: now, exp: now + 300,
      auth_time: now, nonce: flow.nonce, ...overrides }).setProtectedHeader({ alg: "RS256", kid: "test-key" }).sign(forged ? wrongKey : privateKey);
  }
  const validInfo = { sub: "authgear-subject", phone_number: "+919999999999", phone_number_verified: true };
  try {
    token = await signed(); info = validInfo;
    await t.test("valid proof returns issuer-bound subject; no local phone matching", async () => {
      assert.equal(await verifyMobileCode(config, flow, "code", "http://localhost:3000"),
        createHash("sha256").update(`${config.endpoint}\0authgear-subject`).digest("hex"));
    });
    for (const [name, claims] of Object.entries({ nonce: { nonce: "wrong" }, audience: { aud: "other" },
      issuer: { iss: "https://evil.test" }, expired: { exp: 1 }, future: { iat: Math.floor(Date.now() / 1000) + 100 },
      oldLogin: { auth_time: 1 }, authorizedParty: { azp: "other" }, multipleAudiences: { aud: [config.clientId, "other"] },
      missingNonce: { nonce: undefined }, missingSubject: { sub: undefined }, missingAuthTime: { auth_time: undefined } })) {
      await t.test(`reject ${name}`, async () => {
        token = await signed(claims); info = validInfo;
        await assert.rejects(verifyMobileCode(config, flow, "code", "http://localhost:3000"));
      });
    }
    await t.test("reject forged signature", async () => {
      token = await signed({}, true); await assert.rejects(verifyMobileCode(config, flow, "code", "http://localhost:3000"));
    });
    token = await signed();
    for (const [name, changed] of Object.entries({ unverified: { phone_number_verified: false }, stringVerified: { phone_number_verified: "true" },
      wrongSubject: { sub: "other-user" }, missingPhone: { phone_number: undefined }, localPhone: { phone_number: "9999999999" } })) {
      await t.test(`reject ${name}`, async () => {
        info = { ...validInfo, ...changed }; await assert.rejects(verifyMobileCode(config, flow, "code", "http://localhost:3000"));
      });
    }
    info = validInfo;
    await t.test("reject issuer metadata substitution", async () => {
      issuer = "https://evil.test"; await assert.rejects(verifyMobileCode(config, flow, "code", "http://localhost:3000")); issuer = config.endpoint;
    });
    await t.test("reject third-party JWKS endpoint", async () => {
      jwksUri = "https://evil.test/jwks"; await assert.rejects(verifyMobileCode(config, flow, "code", "http://localhost:3000")); jwksUri = `${config.endpoint}/oauth2/jwks`;
    });
    await t.test("provider denial fails without issuing local identity", async () => {
      exchangeStatus = 429; await assert.rejects(verifyMobileCode(config, flow, "code", "http://localhost:3000"));
    });
  } finally { globalThis.fetch = originalFetch; }
});

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import nodemailer from "nodemailer";
import { ContactError, isContactMailbox, parseContactInput } from "../../src/lib/contact.ts";
import { ContactGate, createContactHandler } from "../../src/lib/server/contact.ts";
import { sendContactMessage, sendVerificationEmail } from "../../src/lib/server/email.ts";
import { matchesRequestOrigin } from "../../src/lib/server/request-origin.ts";

const input = () => ({ name: "Visitor", email: "visitor@example.com", reason: "General enquiry", message: "Please help with my trip.", website: "", requestId: randomUUID() });
const request = (body: unknown, headers = {}) => new Request("http://localhost/api/contact", { method: "POST", headers: { "Content-Type": "application/json", Origin: "http://localhost", ...headers }, body: JSON.stringify(body) });
const status = (expected: number) => (error: unknown) => error instanceof ContactError && error.status === expected;
const inbox = async () => "support@example.com";
const configured = () => {};
let sent: Record<string, any>[] = [], smtpOptions: Record<string, any>[] = [], transportMode = "accepted";
nodemailer.createTransport = ((options: Record<string, unknown>) => {
  smtpOptions.push(options);
  return { sendMail: async (message: Record<string, any>) => {
    sent.push(message);
    if (transportMode === "throw") throw new Error("private SMTP detail");
    return transportMode === "accepted" ? { accepted: [message.to.address], rejected: [] } : { accepted: [], rejected: [message.to.address] };
  } };
}) as typeof nodemailer.createTransport;
Object.assign(process.env, { SMTP_HOST: "mock.invalid", SMTP_USER: "mock", SMTP_PASS: "mock", SMTP_PORT: "587", EMAIL_FROM: "Test Sender <sender@example.com>" });

test("strict validation accepts normal text and rejects headers, recipients, forged status and invalid fields", () => {
  assert.equal(parseContactInput({ ...input(), name: "  नमस्ते  " }).name, "नमस्ते");
  for (const invalid of [null, [], { ...input(), email: "a@example.com,b@example.com" }, { ...input(), name: "Name\r\nBcc: other" },
    { ...input(), email: "a@example.com\r\nBcc: other" }, { ...input(), email: "Name <a@example.com>" }, { ...input(), email: "a@-invalid.com" },
    { ...input(), name: "x".repeat(101) }, { ...input(), email: "x".repeat(65) + "@example.com" }, { ...input(), message: "short" },
    { ...input(), message: "x".repeat(4001) }, { ...input(), message: "test\u0000content" }, { ...input(), reason: "unknown" },
    { ...input(), website: "bot.example" }, { ...input(), to: "victim@example.com" }, { ...input(), from: "sender@example.com" },
    { ...input(), role: "admin" }, { ...input(), requestId: "123" }, { ...input(), message: {} }]) assert.throws(() => parseContactInput(invalid), status(400));
  for (const mail of ["first.last+trip@example.co.in", "o'brien@example.com"]) assert.equal(isContactMailbox(mail), true);
});

test("HTTP rejects cross-origin, wrong content type, invalid and oversized bodies before delivery", async () => {
  const handle = createContactHandler({ configured, inbox, gate: new ContactGate(), deliver: async () => assert.fail("must not send") });
  assert.equal((await handle(request(input(), { Origin: "https://other.example" }))).status, 403);
  assert.equal((await handle(request(input(), { "sec-fetch-site": "cross-site" }))).status, 403);
  assert.equal((await handle(request(input(), { "Content-Type": "text/plain" }))).status, 415);
  assert.equal((await handle(request({ ...input(), message: "x".repeat(22_000) }))).status, 400);
  assert.equal((await handle(new Request("http://localhost/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: "broken-json" }))).status, 400);
  assert.equal((await handle(request({ ...input(), bcc: "other@example.com" }))).status, 400);
});

test("origin guard uses the actual Host when Next normalizes its URL and rejects alternate origins", () => {
  const probe = (headers: Record<string, string>) => matchesRequestOrigin(new Request("http://localhost:3000/api/contact", { headers }));
  assert.equal(probe({ Host: "127.0.0.1:3000", Origin: "http://127.0.0.1:3000" }), true);
  assert.equal(probe({ Host: "localhost:3000", Origin: "http://localhost:3000" }), true);
  assert.equal(probe({ Host: "[::1]:3000", Origin: "http://[::1]:3000" }), true);
  for (const headers of [
    { Host: "127.0.0.1:3000", Origin: "http://127.0.0.1:3001" },
    { Host: "127.0.0.1:3000", Origin: "https://127.0.0.1:3000" },
    { Host: "127.0.0.1:3000", Origin: "http://localhost:3000" },
    { Host: "localhost:3000", Origin: "http://localhost.attacker.test:3000" },
    { Host: "localhost:3000", Origin: "null" },
    { Host: "localhost:3000", Origin: "http://attacker.test", "x-forwarded-host": "attacker.test" },
    { Host: "localhost:3000@attacker.test", Origin: "http://attacker.test" },
    { Host: "localhost:3000,attacker.test", Origin: "http://localhost:3000" },
    { Host: "localhost:3000/path", Origin: "http://localhost:3000" },
    { Host: "localhost:3000", Origin: "http://localhost:3000", "sec-fetch-site": "cross-site" },
  ]) assert.equal(probe(headers), false);
});

test("normalized localhost URL accepts an actual same-origin form submission through the handler", async () => {
  let calls = 0;
  const handle = createContactHandler({ configured, inbox, gate: new ContactGate(), deliver: async () => { calls++; } });
  const response = await handle(new Request("http://localhost:3000/api/contact", { method: "POST", headers: {
    "Content-Type": "application/json", Host: "127.0.0.1:3000", Origin: "http://127.0.0.1:3000", "sec-fetch-site": "same-origin",
  }, body: JSON.stringify(input()) }));
  assert.equal(response.status, 200); assert.equal((await response.json()).ok, true); assert.equal(calls, 1);
});

test("handler waits for acceptance and uses current admin inbox for each new submission", async () => {
  let address = "first@example.com"; const seen: string[] = [];
  let release!: () => void; const barrier = new Promise<void>(resolve => { release = resolve; });
  const handle = createContactHandler({ configured, gate: new ContactGate(), inbox: async () => address, deliver: async to => { seen.push(to); await barrier; } });
  let completed = false; const pending = handle(request(input())).then(response => { completed = true; return response; });
  await new Promise(resolve => setTimeout(resolve, 5)); assert.equal(completed, false);
  release(); const response = await pending;
  assert.equal(response.status, 200); assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.match((await response.json()).reference, /^CONTACT-[A-F0-9]{12}$/);
  address = "changed@example.com"; assert.equal((await handle(request(input()))).status, 200);
  assert.deepEqual(seen, ["first@example.com", "changed@example.com"]);
});

test("duplicate in-flight requests and accepted retries send only once on the warm instance", async () => {
  let calls = 0; let release!: () => void;
  const barrier = new Promise<void>(resolve => { release = resolve; });
  const handle = createContactHandler({ configured, inbox, gate: new ContactGate(), deliver: async () => { calls++; await barrier; } });
  const body = input(); const first = handle(request(body)); const second = handle(request(body));
  await new Promise(resolve => setTimeout(resolve, 5)); assert.equal(calls, 1); release();
  const one = await (await first).json(), two = await (await second).json();
  assert.deepEqual(one, two); assert.deepEqual(await (await handle(request(body))).json(), one); assert.equal(calls, 1);
  assert.equal((await handle(request({ ...body, message: "Changed message after submit" }))).status, 409);
});

test("delivery failure never reports success or automatically resends uncertain submissions", async () => {
  let calls = 0;
  const handle = createContactHandler({ configured, inbox, gate: new ContactGate(), deliver: async () => { calls++; throw new Error("SMTP private credentials detail"); } });
  const body = input();
  for (let i = 0; i < 2; i++) {
    const response = await handle(request(body)); assert.equal(response.status, 503);
    const data = await response.json(); assert.equal(data.ok, undefined); assert.match(data.error, /could not confirm delivery/);
    assert.ok(!data.error.includes("private"));
  }
  assert.equal(calls, 1);
});

test("missing mail setup, inbox and database failures do not send or expose internal details", async () => {
  const deliver = async () => { assert.fail("must not send"); };
  for (const options of [{ configured: () => { throw new ContactError("Not configured", 503); }, inbox },
    { configured, inbox: async () => { throw new ContactError("Inbox unavailable", 503); } },
    { configured, inbox: async () => { throw new Error("postgresql://private-credentials"); } }]) {
    const response = await createContactHandler({ ...options, deliver, gate: new ContactGate() })(request(input()));
    assert.equal(response.status, 503); assert.ok(!(await response.text()).includes("private-credentials"));
  }
});

test("quotas enforce email/global/concurrency limits and recover after the window", async () => {
  const gate = new ContactGate(); const body = input();
  for (let i = 0; i < 3; i++) await gate.run({ ...body, requestId: randomUUID() }, async () => {}, 1000);
  assert.throws(() => gate.run({ ...body, requestId: randomUUID() }, async () => {}, 1001), status(429));
  await gate.run({ ...body, requestId: randomUUID() }, async () => {}, 901001);
  const global = new ContactGate();
  for (let i = 0; i < 25; i++) await global.run({ ...input(), email: `person${i}@example.com` }, async () => {}, 1000);
  assert.throws(() => global.run(input(), async () => {}, 1001), status(429));
  const parallel = new ContactGate(); let release!: () => void; const barrier = new Promise<void>(resolve => { release = resolve; });
  const first = parallel.run(input(), () => barrier), second = parallel.run(input(), () => barrier);
  assert.throws(() => parallel.run(input(), async () => {}), status(429)); release(); await Promise.all([first, second]);
  const handle = createContactHandler({ configured, inbox, gate, deliver: async () => {} });
  for (let i = 0; i < 3; i++) await handle(request(input()));
  const limited = await handle(request(input())); assert.equal(limited.status, 429); assert.equal(limited.headers.get("Retry-After"), "900");
});

test("contact email uses trusted sender/inbox and safe Reply-To, escapes HTML, and bounds SMTP", async () => {
  sent = []; smtpOptions = []; transportMode = "accepted";
  const body = { ...input(), name: "A & B", message: '<img src="https://example.invalid/tracker"> Hello & goodbye' };
  await sendContactMessage("support@example.com", body, "CONTACT-123456ABCDEF");
  assert.equal(sent.length, 1); const mail = sent[0];
  assert.equal(mail.from, process.env.EMAIL_FROM); assert.equal(mail.to.address, "support@example.com");
  assert.deepEqual(mail.replyTo, { name: body.name, address: body.email });
  assert.equal(mail.cc, undefined); assert.equal(mail.bcc, undefined); assert.equal(mail.attachments, undefined);
  assert.equal(mail.disableFileAccess, true); assert.equal(mail.disableUrlAccess, true);
  assert.ok(!mail.html.includes('<img src="https://example.invalid/tracker">')); assert.match(mail.html, /&lt;img/);
  assert.match(mail.html, /A &amp; B/); assert.ok(mail.text.includes(body.message));
  assert.equal(smtpOptions[0].requireTLS, true); assert.equal(smtpOptions[0].connectionTimeout, 10000); assert.equal(smtpOptions[0].socketTimeout, 15000);
  assert.equal(smtpOptions[0].auth.pass, "mock");
});

test("SMTP rejected recipients and thrown send failures propagate; config must exist", async () => {
  for (const mode of ["rejected", "throw"]) { transportMode = mode; await assert.rejects(sendContactMessage("support@example.com", input(), "CONTACT-123456ABCDEF")); }
  transportMode = "accepted"; const previous = process.env.EMAIL_FROM; delete process.env.EMAIL_FROM;
  try { await assert.rejects(sendContactMessage("support@example.com", input(), "CONTACT-123456ABCDEF"), status(503)); }
  finally { process.env.EMAIL_FROM = previous; }
  await assert.rejects(sendContactMessage("one@example.com,two@example.com", input(), "CONTACT-123456ABCDEF"));
});

test("existing auth email keeps using the original mail transport behavior", async () => {
  const old = process.env.NODE_ENV; process.env.NODE_ENV = "production";
  try { await sendVerificationEmail("customer@example.com", "Customer", "https://example.com/verify"); }
  finally { if (old === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = old; }
  const mail = sent.at(-1)!; assert.equal(mail.to, "customer@example.com"); assert.match(mail.subject, /Verify your email/);
  assert.equal(smtpOptions.at(-1)?.socketTimeout, undefined, "contact-specific timeouts do not change existing callers");
});

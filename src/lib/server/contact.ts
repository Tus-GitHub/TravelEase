import { createHash, randomBytes } from "node:crypto";
import { ContactError, parseContactInput, type ContactInput } from "../contact";
import { getContactInbox } from "./site-settings";
import { requireContactMailConfig, sendContactMessage } from "./email";
import { readBoundedJson } from "./http-json";
import { matchesRequestOrigin } from "./request-origin";

const WINDOW = 15 * 60_000;
const uncertain = "We could not confirm delivery. Your message may have been sent. Please wait before trying again, or sign in to My Support.";
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
type Attempt = { fingerprint: string; until: number; pending: boolean; promise: Promise<string> };

/** Warm-instance safeguards only. No durable/distributed idempotency claim. */
export class ContactGate {
  private attempts = new Map<string, Attempt>();
  private emails = new Map<string, { count: number; until: number }>();
  private total = 0; private until = 0; private active = 0;
  run(input: ContactInput, deliver: (reference: string) => Promise<void>, now = Date.now()): Promise<string> {
    this.attempts.forEach((entry, key) => { if (entry.until <= now && !entry.pending) this.attempts.delete(key); });
    this.emails.forEach((entry, key) => { if (entry.until <= now) this.emails.delete(key); });
    const fingerprint = hash(JSON.stringify([input.name, input.email, input.reason, input.message]));
    const previous = this.attempts.get(input.requestId);
    if (previous) {
      if (previous.fingerprint !== fingerprint) throw new ContactError("This submission changed. Refresh the form before sending again.", 409);
      return previous.promise;
    }
    if (this.until <= now) { this.total = 0; this.until = now + WINDOW; }
    const key = hash(input.email.toLowerCase());
    const email = this.emails.get(key) ?? { count: 0, until: now + WINDOW };
    if (email.count >= 3 || this.total >= 25 || this.active >= 2 || this.attempts.size >= 200) {
      throw new ContactError("Too many messages right now. Please wait 15 minutes or use My Support.", 429);
    }
    email.count++; this.emails.set(key, email); this.total++; this.active++;
    const reference = `CONTACT-${randomBytes(6).toString("hex").toUpperCase()}`;
    const entry: Attempt = { fingerprint, until: now + WINDOW, pending: true, promise: Promise.resolve("") };
    entry.promise = Promise.resolve().then(() => deliver(reference)).then(() => reference).catch(() => {
      throw new ContactError(uncertain, 503);
    }).finally(() => { entry.pending = false; this.active--; });
    this.attempts.set(input.requestId, entry);
    return entry.promise;
  }
}
const globals = globalThis as unknown as { __contactGate?: ContactGate };
const gate = globals.__contactGate ??= new ContactGate();

export function createContactHandler(options: {
  gate?: ContactGate; inbox?: () => Promise<string>; configured?: () => void;
  deliver?: typeof sendContactMessage;
} = {}) {
  return async function POST(request: Request): Promise<Response> {
    const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: {
      "Cache-Control": "no-store", ...(status === 429 ? { "Retry-After": "900" } : {}),
    } });
    if (!matchesRequestOrigin(request)) return reply({ error: "Invalid origin." }, 403);
    if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? "")) return reply({ error: "Submit the contact form as JSON." }, 415);
    let input: ContactInput;
    try { input = parseContactInput(await readBoundedJson(request.body, 20 * 1024)); }
    catch (error) { return reply({ error: error instanceof ContactError ? error.message : "Please check your form details and message length." }, 400); }
    try {
      (options.configured ?? requireContactMailConfig)();
      const inbox = await (options.inbox ?? getContactInbox)();
      const reference = await (options.gate ?? gate).run(input, reference => (options.deliver ?? sendContactMessage)(inbox, input, reference));
      return reply({ ok: true, reference });
    } catch (error) {
      return reply({ error: error instanceof ContactError ? error.message : "The contact form is unavailable right now. Please use My Support or try again later." }, error instanceof ContactError ? error.status : 503);
    }
  };
}

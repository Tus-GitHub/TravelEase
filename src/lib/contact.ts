import { contactReasons } from "../data/pages";
import { isValidEmail } from "./validation";

export interface ContactInput {
  name: string; email: string; reason: string; message: string; website: string; requestId: string;
}
export class ContactError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

/** A single plain mailbox; never accept display names, address lists or headers. */
export function isContactMailbox(email: string): boolean {
  if (email.length > 254 || !isValidEmail(email) || /[\s<>,;:"\\\[\]\x00-\x1f\x7f]/.test(email)) return false;
  const [local, domain] = email.split("@");
  return local.length <= 64 && !local.startsWith(".") && !local.endsWith(".") && !local.includes("..") &&
    /^[\x21-\x7e]+$/.test(local) && domain.split(".").every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label));
}

export function parseContactInput(value: unknown): ContactInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ContactError("Please fill in the contact form.");
  const data = value as Record<string, unknown>;
  const keys = ["name", "email", "reason", "message", "website", "requestId"] as const;
  if (Object.keys(data).some(key => !keys.includes(key as typeof keys[number])) || keys.some(key => typeof data[key] !== "string")) {
    throw new ContactError("Please fill in the contact form.");
  }
  const input = Object.fromEntries(keys.map(key => [key, (data[key] as string).trim()])) as unknown as ContactInput;
  if (!input.name || input.name.length > 100 || /[\x00-\x1f\x7f]/.test(input.name)) throw new ContactError("Enter your name (up to 100 characters).");
  if (!isContactMailbox(input.email)) throw new ContactError("Enter one valid email address.");
  if (!contactReasons.includes(input.reason)) throw new ContactError("Choose a reason from the list.");
  if (input.message.length < 10 || input.message.length > 4000 || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(input.message)) {
    throw new ContactError("Write a message between 10 and 4,000 characters.");
  }
  if (input.website || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(input.requestId)) {
    throw new ContactError("Could not submit this form. Please refresh and try again.");
  }
  return input;
}

/** Shared client + server validation rules for auth forms. */

export const PASSWORD_MIN_LENGTH = 8;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Accepts an optional leading "+" followed by 7-15 digits, once separators are stripped.
const PHONE_RE = /^\+?\d{7,15}$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email);
}

export function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-().]/g, "");
}

export function isValidPhone(phone: string): boolean {
  return PHONE_RE.test(normalizePhone(phone));
}

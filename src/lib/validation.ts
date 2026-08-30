/** Shared client + server validation rules for auth forms. */

export const PASSWORD_MIN_LENGTH = 8;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Accepts an optional leading "+" followed by 7-15 digits, once separators are stripped.
const PHONE_RE = /^\+?\d{7,15}$/;
// Indian PIN code: exactly 6 digits.
const PINCODE_RE = /^\d{6}$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email);
}

/** Optional field: an empty string is considered valid; otherwise it must be 6 digits. */
export function isValidPincode(pincode: string): boolean {
  const trimmed = pincode.trim();
  return trimmed === "" || PINCODE_RE.test(trimmed);
}

/** A geographic coordinate pair within the valid WGS84 range. */
export function isValidLatLng(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

export function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-().]/g, "");
}

export function isValidPhone(phone: string): boolean {
  return PHONE_RE.test(normalizePhone(phone));
}

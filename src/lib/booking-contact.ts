import { isValidPhone, normalizePhone } from "./validation";

/** One booking contact snapshot, independent of whether an OAuth profile has a phone. */
export function bookingContact(input: unknown, owner: { name: string; phone: string }): { name: string; phone: string; isPrimary: true } {
  const rows = Array.isArray(input) ? input : [];
  const first = rows.find(p => p && typeof p === "object" && p.isPrimary === true) ?? rows[0];
  const name = typeof first?.name === "string" && first.name.trim() ? first.name.trim() : owner.name;
  const phone = typeof first?.phone === "string" && first.phone.trim() ? first.phone.trim() : owner.phone;
  if (!name || name.length > 200 || typeof phone !== "string" || phone.length > 30 || !isValidPhone(phone)) throw new Error("Enter a valid contact number for the lead traveller.");
  return { name, phone: normalizePhone(phone), isPrimary: true };
}

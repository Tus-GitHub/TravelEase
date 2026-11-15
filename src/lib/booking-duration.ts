import { bookingTimeValue } from "./booking-datetime";

/** Outstation daily allowances follow calendar dates in India, including pickup. */
export function tripDuration(start: string | Date, end: string | Date) {
  const a = new Date(start), b = new Date(end);
  if (!Number.isFinite(a.getTime()) || !Number.isFinite(b.getTime()) || b <= a) throw new Error("Return time must be after pickup time.");
  if (b.getTime() - a.getTime() > 90 * 86400000) throw new Error("Choose a return within 90 days of pickup.");
  const nights = Math.round((Date.parse(bookingTimeValue(b).slice(0, 10)) - Date.parse(bookingTimeValue(a).slice(0, 10))) / 86400000);
  return { days: nights + 1, nights };
}

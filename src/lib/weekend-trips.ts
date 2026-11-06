import { cmsSafeImage } from "./cms";

export const DEPARTURE_STATUSES = ["draft", "open", "guaranteed", "closed", "ongoing", "completed", "cancelled"] as const;
export type DepartureStatus = typeof DEPARTURE_STATUSES[number];
export class TripError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.name = "TripError"; this.status = status; }
}
export const tripUuid = (value: unknown): string => {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new TripError("Trip record not found.", 404);
  return value;
};
export const tripObject = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TripError("Check the form and try again.");
  return value as Record<string, unknown>;
};
export function tripText(value: unknown, label: string, max: number, required = false): string {
  if (typeof value !== "string" || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) throw new TripError(`${label} must be text, up to ${max} characters.`);
  const text = value.trim();
  if (required && !text) throw new TripError(`${label} is required.`);
  return text;
}
export function tripNumber(value: unknown, label: string, min: number, max: number, integer = true): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isSafeInteger(value))) throw new TripError(`Check ${label.toLowerCase()} (${min}–${max}).`);
  if (!integer && Math.abs(value * 100 - Math.round(value * 100)) > 0.00001) throw new TripError(`${label} supports up to two decimal places.`);
  return value;
}
const nullableId = (value: unknown, label: string) => value == null ? null : tripNumber(value, label, 1, 2147483647);
const photo = (value: unknown) => {
  const url = tripText(value ?? "", "Photo URL", 500);
  if (!cmsSafeImage(url)) throw new TripError("Use an uploaded photo or a supported HTTPS photo URL.");
  return url;
};
function timestamp(value: unknown, label: string) {
  if (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d(:\d\d(\.\d{1,3})?)?(Z|[+-]\d\d:\d\d)$/.test(value) || !Number.isFinite(Date.parse(value))) throw new TripError(`${label} needs a valid date, time and timezone.`);
  tripDate(value.slice(0, 10), label);
  return new Date(value).toISOString();
}
export function tripDate(value: unknown, label = "Date"): string {
  if (typeof value !== "string" || !/^\d{4}-\d\d-\d\d$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new TripError(`${label} is invalid.`);
  return value;
}
export const indiaDate = (iso: string) => new Date(new Date(iso).getTime() + 330 * 60000).toISOString().slice(0, 10);
export const indiaInput = (iso: string) => new Date(new Date(iso).getTime() + 330 * 60000).toISOString().slice(0, 16);
export const fromIndiaInput = (value: string) => timestamp(value + ":00+05:30", "Trip time");
export interface TripDay { day: number; title: string; description: string }
export interface TripContent { summary: string; description: string; imageUrl: string; imageAlt: string; itinerary: TripDay[]; inclusions: string[]; exclusions: string[]; stayNights: string[]; routeStops?:{id:number;name:string}[] }
const lines = (value: unknown, label: string, count: number, max: number) => {
  if (!Array.isArray(value) || value.length > count) throw new TripError(`${label} supports up to ${count} entries.`);
  return value.map(item => tripText(item, label, max, true));
};
export function validateTripContent(value: unknown): TripContent {
  const c = tripObject(value);
  if (!Array.isArray(c.itinerary) || !c.itinerary.length || c.itinerary.length > 14) throw new TripError("Add between one and fourteen itinerary days.");
  return { summary: tripText(c.summary, "Short introduction", 500), description: tripText(c.description, "Description", 6000), imageUrl: photo(c.imageUrl), imageAlt: tripText(c.imageAlt ?? "", "Photo description", 200),
    itinerary: c.itinerary.map((value, i) => { const day = tripObject(value); return { day: i + 1, title: tripText(day.title, "Day title", 200, true), description: tripText(day.description, "Day plan", 4000) }; }),
    inclusions: lines(c.inclusions, "Inclusions", 30, 300), exclusions: lines(c.exclusions, "Exclusions", 30, 300), stayNights: Array.from(new Set(lines(c.stayNights, "Hotel nights", 14, 10).map(date => tripDate(date)))) };
}
export interface GuideInput { name: string; phone: string; imageUrl: string; bio: string; languages: string[]; privateNotes: string; isActive: boolean }
export function validateGuide(value: unknown): GuideInput {
  const g = tripObject(value);
  if (typeof g.isActive !== "boolean") throw new TripError("Choose whether the guide is active.");
  return { name: tripText(g.name, "Guide name", 150, true), phone: tripText(g.phone, "Phone", 30, true), imageUrl: photo(g.imageUrl), bio: tripText(g.bio ?? "", "Introduction", 4000), languages: lines(g.languages, "Languages", 10, 60), privateNotes: tripText(g.privateNotes ?? "", "Private notes", 1000), isActive: g.isActive };
}
export interface Guide extends GuideInput { id: number }
export interface StayInput { id?: string; hotelName: string; hotelAddress: string; cityId: number | null; imageUrl: string; checkIn: string; checkOut: string; roomType: string; roomsReserved: number; occupancyPerRoom: number; staffBedsReserved: number; mealPlan: string; confirmationStatus: "pending" | "confirmed" | "cancelled"; supplierReference: string; contactName: string; contactPhone: string; supplierCost: number | null; publicNotes: string; privateNotes: string }
export function validateStay(value: unknown): StayInput {
  const s = tripObject(value), checkIn = tripDate(s.checkIn), checkOut = tripDate(s.checkOut);
  if (checkOut <= checkIn) throw new TripError("Hotel checkout must follow check-in.");
  if (!["pending", "confirmed", "cancelled"].includes(String(s.confirmationStatus))) throw new TripError("Choose a hotel confirmation status.");
  return { ...(s.id ? { id: tripUuid(s.id) } : {}), hotelName: tripText(s.hotelName, "Hotel name", 200, true), hotelAddress: tripText(s.hotelAddress, "Hotel address", 500, true), cityId: nullableId(s.cityId, "Hotel city"), imageUrl: photo(s.imageUrl), checkIn, checkOut, roomType: tripText(s.roomType, "Room type", 120, true), roomsReserved: tripNumber(s.roomsReserved, "Rooms reserved", 0, 1000), occupancyPerRoom: tripNumber(s.occupancyPerRoom, "Guests per room", 1, 20), staffBedsReserved: tripNumber(s.staffBedsReserved, "Staff beds", 0, 1000), mealPlan: tripText(s.mealPlan, "Meal plan", 200), confirmationStatus: s.confirmationStatus as StayInput["confirmationStatus"], supplierReference: tripText(s.supplierReference ?? "", "Supplier reference", 120), contactName: tripText(s.contactName ?? "", "Hotel contact", 150), contactPhone: tripText(s.contactPhone ?? "", "Hotel phone", 30), supplierCost: s.supplierCost == null ? null : tripNumber(s.supplierCost, "Supplier cost", 0, 9999999999.99, false), publicNotes: tripText(s.publicNotes ?? "", "Public hotel notes", 1000), privateNotes: tripText(s.privateNotes ?? "", "Private hotel notes", 2000) };
}
export interface DepartureInput {
  packageId: number; slug: string; title: string; startsAt: string; endsAt: string; pickupCityId: number; pickupAddress: string; returnAddress: string;
  vehicleId: number | null; driverId: number | null; guideId: number | null; capacity: number; staffReservedSeats: number; minTravellers: number;
  pricePerPerson: number; taxPercent: number; bookingOpensAt: string; bookingClosesAt: string; decisionDeadline: string; paymentHoldMinutes: number;
  content: TripContent; privateNotes: string; isFeatured: boolean; displayOrder: number; stays: StayInput[];
}
export interface AdminDeparture extends DepartureInput { id: string; status: DepartureStatus; version: number; confirmedSeats: number; heldSeats: number; packageName: string; pickupCity: string }
export function validateDeparture(value: unknown): DepartureInput {
  const d = tripObject(value), slug = tripText(d.slug, "Address", 160, true);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) throw new TripError("Use lowercase words separated by hyphens for the address.");
  const startsAt = timestamp(d.startsAt, "Departure"), endsAt = timestamp(d.endsAt, "Return"), bookingOpensAt = timestamp(d.bookingOpensAt, "Booking opens"), bookingClosesAt = timestamp(d.bookingClosesAt, "Booking closes"), decisionDeadline = timestamp(d.decisionDeadline, "Group decision deadline");
  if (new Date(startsAt).getTime() >= new Date(endsAt).getTime() || Date.parse(endsAt) - Date.parse(startsAt) > 14 * 86400000) throw new TripError("Return must follow departure within fourteen days.");
  if (new Date(indiaDate(startsAt)).getUTCDay() !== 5) throw new TripError("Weekend trips depart on Friday in India time.");
  if (!(bookingOpensAt < decisionDeadline && decisionDeadline <= bookingClosesAt && bookingClosesAt < startsAt)) throw new TripError("Use booking open < group decision ≤ booking close < departure.");
  const capacity = tripNumber(d.capacity, "Customer seats", 1, 1000), content = validateTripContent(d.content);
  if (content.stayNights.some(night => night < indiaDate(startsAt) || night >= indiaDate(endsAt))) throw new TripError("Hotel nights must fall within the trip dates.");
  if (!Array.isArray(d.stays) || d.stays.length > 30) throw new TripError("A trip supports up to thirty hotel room groups.");
  const stays = d.stays.map(validateStay);
  if (stays.some(stay => stay.checkIn < indiaDate(startsAt) || stay.checkOut > indiaDate(endsAt))) throw new TripError("Hotel dates must fall within the trip dates.");
  if (new Set(stays.filter(s => s.id).map(s => s.id)).size !== stays.filter(s => s.id).length) throw new TripError("A hotel entry was repeated.");
  if (typeof d.isFeatured !== "boolean") throw new TripError("Choose whether this trip is featured.");
  return { packageId: tripNumber(d.packageId, "Template", 1, 2147483647), slug, title: tripText(d.title, "Trip title", 200, true), startsAt, endsAt, pickupCityId: tripNumber(d.pickupCityId, "Pickup city", 1, 2147483647), pickupAddress: tripText(d.pickupAddress, "Pickup address", 300, true), returnAddress: tripText(d.returnAddress, "Return address", 300, true), vehicleId: nullableId(d.vehicleId, "Vehicle"), driverId: nullableId(d.driverId, "Driver"), guideId: nullableId(d.guideId, "Guide"), capacity, staffReservedSeats: tripNumber(d.staffReservedSeats, "Staff seats", 0, 1000), minTravellers: tripNumber(d.minTravellers, "Minimum group", 1, capacity), pricePerPerson: tripNumber(d.pricePerPerson, "Inclusive price", 0.01, 99999999.99, false), taxPercent: tripNumber(d.taxPercent, "Tax percentage", 0, 100, false), bookingOpensAt, bookingClosesAt, decisionDeadline, paymentHoldMinutes: tripNumber(d.paymentHoldMinutes, "Payment hold minutes", 5, 1440), content, privateNotes: tripText(d.privateNotes ?? "", "Private notes", 2000), isFeatured: d.isFeatured, displayOrder: tripNumber(d.displayOrder, "Display order", 0, 100000), stays };
}
/** Capacity on every explicitly included hotel night; overnight travel needs no hotel. */
export function hotelCapacity(nights: string[], stays: StayInput[]): number {
  return nights.length ? Math.min(...nights.map(night => stays.filter(s => s.confirmationStatus === "confirmed" && s.checkIn <= night && night < s.checkOut).reduce((sum, s) => sum + Math.max(0, s.roomsReserved * s.occupancyPerRoom - s.staffBedsReserved), 0))) : Infinity;
}
export const formatTripDate = (value: string) => new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(value));

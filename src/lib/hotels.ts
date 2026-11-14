export const HOTEL_NATIONALITIES = { IN: "India", GB: "United Kingdom", US: "United States", CA: "Canada", AU: "Australia", AE: "United Arab Emirates", SG: "Singapore", DE: "Germany", FR: "France", NZ: "New Zealand" } as const;
export interface HotelSearchInput { cityId: number; checkin: string; checkout: string; adults: number; nationality: string }
export interface HotelDestination { id: number; regionId: number; name: string; regionName: string }
export interface HotelFee { label: string; amount: number | null; currency: string | null }
export interface HotelResult {
  id: string; name: string; address: string; imageUrl: string | null; stars: number | null;
  room: string; board: string; total: number | null; currency: "INR";
  cancellation: string; propertyFees: HotelFee[];
}
export interface HotelSearchResult { hotels: HotelResult[]; sandbox: true; searchedAt: string; destination: HotelDestination }
export class HotelError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}
export function hotelToday(now = new Date()): string {
  return new Date(now.getTime() + 330 * 60_000).toISOString().slice(0, 10);
}
export function hotelDateAfter(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400_000).toISOString().slice(0, 10);
}
function validDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}
export function parseHotelSearch(value: unknown, now = new Date()): HotelSearchInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new HotelError("Choose a city, dates and guests.");
  const data = value as Record<string, unknown>;
  if (Object.keys(data).some(key => !["cityId", "checkin", "checkout", "adults", "nationality"].includes(key)) ||
      !Number.isSafeInteger(data.cityId) || Number(data.cityId) < 1 || Number(data.cityId) > 2147483647 ||
      !Number.isInteger(data.adults) || Number(data.adults) < 1 || Number(data.adults) > 4 ||
      typeof data.nationality !== "string" || !Object.hasOwn(HOTEL_NATIONALITIES, data.nationality) ||
      !validDate(data.checkin) || !validDate(data.checkout)) throw new HotelError("Choose a valid city, dates, nationality and 1–4 adults.");
  const today = hotelToday(now);
  if (data.checkin < today || data.checkout <= data.checkin || data.checkin > hotelDateAfter(today, 365) || data.checkout > hotelDateAfter(data.checkin, 30)) {
    throw new HotelError("Choose a future stay of 1–30 nights, checking in within the next year.");
  }
  return data as unknown as HotelSearchInput;
}
export function hotelEnquiry(input: HotelSearchInput, destination: HotelDestination, hotel: HotelResult | null, note: string) {
  return {
    subject: `Hotel enquiry: ${hotel?.name ?? destination.name}`.slice(0, 160), category: "general",
    message: ["DEVELOPMENT SANDBOX HOTEL ENQUIRY — no reservation or payment.",
      hotel ? `Property: ${hotel.name} (LiteAPI ${hotel.id})` : "Please recommend a suitable hotel.", `Destination: ${destination.name}, ${destination.regionName}`,
      `Stay: ${input.checkin} to ${input.checkout}; 1 room, ${input.adults} adults; nationality ${input.nationality}.`,
      hotel ? `Room: ${hotel.room}. Meal plan: ${hotel.board}.` : "Room and meal preferences need confirmation.",
      hotel?.total == null ? "Price requires a quote." : `Sample stay total: INR ${hotel.total.toFixed(2)}. Additional property charges may apply.`,
      "Traveller enquiry only. Staff must verify live availability, price and cancellation terms before confirming anything.",
      note.trim() ? `Traveller note: ${note.trim().slice(0, 1000)}` : "",
    ].filter(Boolean).join("\n"),
  };
}

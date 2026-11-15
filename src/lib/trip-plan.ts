/** Guest-facing plan details only. Supplier costs/contacts/references stay private. */
export const MEALS = ["breakfast", "lunch", "dinner"] as const;
export type Meal = typeof MEALS[number];
export interface GuestStay { hotelName: string; hotelAddress: string; roomType: string; notes: string }
export interface DayExtras { meals?: Meal[]; hotel?: GuestStay }
export interface MealCounts { breakfast: number; lunch: number; dinner: number }
export const emptyMeals = (): MealCounts => ({ breakfast: 0, lunch: 0, dinner: 0 });
function text(value: unknown, max: number) {
  if (typeof value !== "string" || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) throw new Error("Check the hotel details and their length.");
  return value.trim();
}
export function guestStay(value: unknown): GuestStay {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Check the hotel details.");
  const v = value as Record<string, unknown>;
  return { hotelName: text(v.hotelName ?? "", 200), hotelAddress: text(v.hotelAddress ?? "", 500), roomType: text(v.roomType ?? "", 120), notes: text(v.notes ?? "", 1000) };
}
export function dayExtras(value: Record<string, unknown>): DayExtras {
  const extras: DayExtras = {};
  if (value.meals !== undefined) {
    if (!Array.isArray(value.meals) || value.meals.length > 3 || value.meals.some(m => !MEALS.includes(m)) || new Set(value.meals).size !== value.meals.length) throw new Error("Choose each included meal once per day.");
    extras.meals = value.meals as Meal[];
  }
  if (value.hotel !== undefined) extras.hotel = guestStay(value.hotel);
  return extras;
}
export function mealSummary(meals: MealCounts) {
  return MEALS.filter(m => meals[m] > 0).map(m => `${meals[m]} ${m}${meals[m] === 1 ? "" : "s"}`).join(" · ");
}

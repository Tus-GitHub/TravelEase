/** Pickup clocks are always India Standard Time, independent of the visitor's device. */
export const INDIA_OFFSET_MS=330*60*1000;
export function bookingTimeValue(instant:Date):string { return new Date(instant.getTime()+INDIA_OFFSET_MS).toISOString().slice(0,16); }
export function bookingInstant(value:string):Date { return new Date(`${value}:00+05:30`); }
export function validBookingTime(value:string):boolean {
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))return false;
  const instant=bookingInstant(value);
  return Number.isFinite(instant.getTime())&&bookingTimeValue(instant)===value;
}

import type { BookingRoute } from "../booking-route";
import type { BookingTypeCode, PricingRuleInput } from "./pricing";
import { calculateBookingRoute, MapServiceError } from "./map-services";

/** The car-specific rule selects when a one-way job includes the driver's return.
 * Actual reverse roads may differ; never double the outbound distance. */
export async function emptyReturnRoute(type: BookingTypeCode, rule: PricingRuleInput, route?: BookingRoute) {
  if (!rule.emptyReturnEnabled || !rule.emptyReturnPerKmRate || !["point_to_point", "airport_transfer"].includes(type)) return undefined;
  if (!route || route.roundTrip) throw new MapServiceError("Choose a valid one-way route before calculating the return charge.", 422);
  try { return await calculateBookingRoute(route.drop, route.pickup, false); }
  catch (error) {
    if (!(error instanceof MapServiceError) || error.status !== 429 || error.retryAfter < 1 || error.retryAfter > 3) throw error;
    await new Promise(resolve => setTimeout(resolve, error.retryAfter * 1000));
    return calculateBookingRoute(route.drop, route.pickup, false);
  }
}

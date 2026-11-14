import { getPool } from "./db";
import { verifiedBookingRoute, MapServiceError } from "./map-services";
import type { BookingRoute } from "../booking-route";

export const distanceTrip = (type: string) => ["point_to_point", "airport_transfer", "outstation"].includes(type);
export async function carTripFacts(input: { vehicleId: unknown; vehicleTypeId?: unknown; bookingType: string;
  passengers?: unknown; routeId?: unknown; pickupPoint?: unknown; dropPoint?: unknown }) {
  if (typeof input.vehicleId !== "number" || !Number.isSafeInteger(input.vehicleId) || input.vehicleId < 1 || input.vehicleId > 2147483647) throw new MapServiceError("Choose a valid car.", 400);
  const vehicle = (await getPool().query(`SELECT v.vehicle_type_id,v.seating_capacity FROM vehicles v JOIN vehicle_types t USING(vehicle_type_id)
    WHERE v.vehicle_id=$1 AND v.is_active AND NOT v.is_deleted AND v.is_available AND t.is_active AND NOT t.is_deleted`, [input.vehicleId])).rows[0];
  if (!vehicle) throw new MapServiceError("That car is not currently available.", 409);
  if (input.vehicleTypeId != null && input.vehicleTypeId !== vehicle.vehicle_type_id) throw new MapServiceError("The car and selected vehicle type do not match.", 400);
  if (typeof input.passengers !== "number" || !Number.isInteger(input.passengers) || input.passengers < 1 || input.passengers > vehicle.seating_capacity) throw new MapServiceError("Choose a passenger count within this car's capacity.", 400);
  let route: BookingRoute | undefined;
  if (distanceTrip(input.bookingType)) route = await verifiedBookingRoute(input.routeId, input.pickupPoint, input.dropPoint, input.bookingType === "outstation");
  return { vehicleTypeId: vehicle.vehicle_type_id as number, route };
}

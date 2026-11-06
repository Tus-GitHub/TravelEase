import { randomBytes } from "node:crypto";
import type { PoolClient, QueryResultRow } from "pg";
import { TripError, tripUuid, tripNumber, tripText, tripObject } from "@/lib/weekend-trips";
import { calculatePrice, type PricingRuleInput } from "./pricing";
import type { PublicUser } from "./users";
import { getPool } from "./db";
import { getAdminDeparture, lockDeparture, tripSeats, tripTransaction } from "./weekend-trips";
import { notifyBookingCreated } from "./notifications";
import { logActivity } from "./activity-log";

export const WEEKEND_CANCELLATION_POLICY = "Whole-booking cancellation: more than 72 hours before pickup — full refund; 24–72 hours — 50% refund; less than 24 hours — no refund. If we cancel the departure, paid bookings receive a full refund. Offline refunds are settled by our team.";
const inclusiveRule = (taxPercent: number): PricingRuleInput => ({ baseAmount:0, perKmRate:0, perHourRate:0, includedKm:0, extraKmRate:0, perDayRate:0, driverAllowancePerDay:0, nightCharge:0, flatRate:0, taxPercent, minHours:null, minKm:null });
export function departurePrice(row: { price_per_person: string | number; tax_percent: string | number }, quantity: number) {
  const price = calculatePrice({ bookingType:"package", packagePricePerPerson:Number(row.price_per_person), packagePriceIncludesTax:true, passengers:quantity }, inclusiveRule(Number(row.tax_percent)));
  if (price.totalAmount > 99999999.99) throw new TripError("This booking total exceeds the supported limit. Contact our team.");
  return price;
}
export async function assertOpenDeparture(client: PoolClient | ReturnType<typeof getPool>, row: QueryResultRow, quantity: number) {
  const { rows: [clock] } = await client.query("SELECT clock_timestamp() AS time");
  const now = clock.time as Date;
  if (!row.is_active || !["open","guaranteed"].includes(row.status) || now < new Date(row.booking_opens_at) || now >= new Date(row.booking_closes_at)) throw new TripError("Bookings are not open for this departure.",409);
  if (row.status === "open" && now >= new Date(row.decision_deadline)) throw new TripError("The team is confirming this departure. Please check again shortly.",409);
  const seats = await tripSeats(client,row.departure_id);
  const availableSeats = Math.max(0,row.capacity-seats.confirmed-seats.held);
  if (quantity > availableSeats) throw new TripError(`Only ${availableSeats} seat${availableSeats === 1 ? "" : "s"} remain. Refresh your selection.`,409);
  return availableSeats;
}
export async function quoteSharedTrip(raw: Record<string, unknown>) {
  const id = tripUuid(raw.departureId), quantity = tripNumber(raw.passengerCount ?? raw.passengers,"Travellers",1,50);
  if (raw.couponCode) throw new TripError("Weekend Trips use the listed inclusive group price; coupons do not apply.");
  const row = (await getPool().query("SELECT * FROM trip_departures WHERE departure_id=$1 AND NOT is_deleted AND status<>'draft'",[id])).rows[0];
  if (!row) throw new TripError("Trip not found.",404);
  const availableSeats = await assertOpenDeparture(getPool(),row,quantity);
  return { quote: departurePrice(row,quantity), departureId:id, version:row.version, availableSeats, paymentHoldMinutes:row.payment_hold_minutes };
}
export async function sharedSnapshot(client: PoolClient, id: string) {
  const trip = await getAdminDeparture(id,client);
  return { version:1, departureId:id, title:trip.title, slug:trip.slug, startsAt:trip.startsAt, endsAt:trip.endsAt, pickupCity:trip.pickupCity,
    pickupAddress:trip.pickupAddress, returnAddress:trip.returnAddress, pricePerPerson:trip.pricePerPerson, taxPercent:trip.taxPercent,
    minTravellers:trip.minTravellers, decisionDeadline:trip.decisionDeadline, content:trip.content, cancellationPolicy:WEEKEND_CANCELLATION_POLICY,
    stays:trip.stays.filter(s=>s.confirmationStatus === "confirmed").map(s=>({ hotelName:s.hotelName, hotelAddress:s.hotelAddress, imageUrl:s.imageUrl, checkIn:s.checkIn, checkOut:s.checkOut, roomType:s.roomType, occupancyPerRoom:s.occupancyPerRoom, mealPlan:s.mealPlan, publicNotes:s.publicNotes })) };
}
export type SharedTripSnapshot = Awaited<ReturnType<typeof sharedSnapshot>>;
export async function createSharedBooking(raw: unknown, user: PublicUser) {
  const input = tripObject(raw), id = tripUuid(input.departureId), requestId = tripUuid(input.clientRequestId);
  const quantity = tripNumber(input.passengerCount,"Travellers",1,50);
  if (input.couponCode) throw new TripError("Weekend Trips use the listed inclusive group price; coupons do not apply.");
  const notes = tripText(input.customerNotes ?? "","Booking notes",1000);
  if (!Array.isArray(input.passengers) || input.passengers.length !== quantity) throw new TripError("Enter details for every traveller.");
  const passengers = input.passengers.map((value,index)=> { const p = tripObject(value); return { name:tripText(p.name,"Traveller name",200,true), age:p.age == null || p.age === "" ? null : tripNumber(p.age,"Age",0,120), phone:tripText(p.phone ?? "","Traveller phone",30), isPrimary:index===0 }; });
  if (!passengers[0].phone) throw new TripError("Add a contact number for the lead traveller.");
  const result = await tripTransaction(async client => {
    // Request-level lock also serializes the same key submitted for two departures.
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[`${user.id}:${requestId}`]);
    const prior = (await client.query("SELECT booking_id,departure_id,passenger_count,customer_notes FROM bookings WHERE user_id=$1 AND client_request_id=$2",[user.id,requestId])).rows[0];
    if (prior) {
      const saved = (await client.query("SELECT name,age,COALESCE(phone,'') AS phone,is_primary AS \"isPrimary\" FROM booking_passengers WHERE booking_id=$1 ORDER BY booking_passenger_id",[prior.booking_id])).rows;
      if (prior.departure_id!==id || prior.passenger_count!==quantity || (prior.customer_notes ?? "")!==notes || JSON.stringify(saved)!==JSON.stringify(passengers)) throw new TripError("This request was already used for different traveller details. Open the existing booking or start a new request.",409);
      return { id:prior.booking_id as string, created:false };
    }
    const row = await lockDeparture(client,id);
    if (input.quotedVersion !== undefined && input.quotedVersion !== row.version) throw new TripError("This departure was updated. Refresh the trip and price before reserving seats.",409);
    await assertOpenDeparture(client,row,quantity);
    if (!(await client.query("SELECT 1 FROM vehicle_availability WHERE departure_id=$1 AND NOT is_deleted",[id])).rowCount) throw new TripError("The team is reviewing transport for this trip. Please try again later.",409);
    const price = departurePrice(row,quantity), snapshot = await sharedSnapshot(client,id);
    const vehicle = (await client.query("SELECT vehicle_type_id FROM vehicles WHERE vehicle_id=$1",[row.vehicle_id])).rows[0];
    const type = (await client.query("SELECT booking_type_id FROM booking_types WHERE code='package'")).rows[0];
    if (!type || !vehicle) throw new TripError("This trip is not ready for booking.",409);
    let bookingId: string | undefined;
    for (let attempt=0; attempt<5 && !bookingId; attempt++) {
      bookingId = (await client.query(`INSERT INTO bookings(booking_reference,user_id,booking_type_id,vehicle_id,vehicle_type_id,driver_id,package_id,pickup_city_id,pickup_address,drop_address,start_datetime,end_datetime,passenger_count,duration_days,status,price_breakdown,subtotal,discount_amount,tax_amount,total_amount,currency,customer_notes,departure_id,seat_hold_expires_at,client_request_id,trip_snapshot,created_by,updated_by)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'PendingPayment',$15,$16,0,$17,$18,'INR',$19,$20,LEAST(clock_timestamp()+$21*interval '1 minute',$22::timestamptz),$23,$24,$2,$2)
        ON CONFLICT (booking_reference) DO NOTHING RETURNING booking_id`,[
        `TE-${randomBytes(4).toString('hex').toUpperCase()}`,user.id,type.booking_type_id,row.vehicle_id,vehicle.vehicle_type_id,row.driver_id,row.package_id,row.pickup_city_id,row.pickup_address,row.return_address,row.starts_at,row.ends_at,quantity,Math.ceil((new Date(row.ends_at).getTime()-new Date(row.starts_at).getTime())/86400000),JSON.stringify(price),price.subtotal,price.taxAmount,price.totalAmount,notes,id,row.payment_hold_minutes,row.booking_closes_at,requestId,JSON.stringify(snapshot)
      ])).rows[0]?.booking_id;
    }
    if (!bookingId) throw new Error("Could not allocate a booking reference");
    for (const p of passengers) await client.query("INSERT INTO booking_passengers(booking_id,name,age,phone,is_primary,created_by) VALUES($1,$2,$3,$4,$5,$6)",[bookingId,p.name,p.age,p.phone,p.isPrimary,user.id]);
    const stops=snapshot.content.routeStops??[];
    for(let index=0;index<stops.length;index++) await client.query("INSERT INTO booking_stops(booking_id,tourist_spot_id,custom_label,stop_order,created_by) VALUES($1,$2,$3,$4,$5)",[bookingId,stops[index].id,stops[index].name.slice(0,200),index+1,user.id]);
    await client.query("INSERT INTO booking_status_history(booking_id,from_status,to_status,changed_by_user_id,reason) VALUES($1,'Draft','PendingPayment',$2,'Weekend trip seats held; offline payment required before expiry')",[bookingId,user.id]);
    return { id:bookingId, created:true };
  });
  if (result.created) {
    await notifyBookingCreated(result.id);
    await logActivity({userId:user.id,action:"booking.create",entityType:"booking",entityId:result.id,details:{departureId:id,passengers:quantity}});
  }
  return result.id;
}

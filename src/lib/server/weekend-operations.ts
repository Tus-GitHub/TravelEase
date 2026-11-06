import type { PoolClient } from "pg";
import { TripError, tripNumber, tripText, tripUuid, type DepartureStatus } from "@/lib/weekend-trips";
import type { PublicUser } from "./users";
import { getPool } from "./db";
import { assertTripReady, checkReferences, getAdminDeparture, lockDeparture, tripSeats, tripTransaction } from "./weekend-trips";
import { hasConflict, lockVehicle } from "./availability";
import { assertDriverWindow } from "./weekend-resources";
import { transitionBookingInTransaction, notifyTransition, type BookingTransitionEvent } from "./bookings";
import { logActivity } from "./activity-log";

const adminOnly = (user: PublicUser) => { if (user.role !== "admin") throw new TripError("Only an administrator can manage group departures.",403); };
async function retireHolds(client: PoolClient, id: string, user: PublicUser, events: BookingTransitionEvent[], all = false) {
  const rows = (await client.query(`SELECT booking_id FROM bookings WHERE departure_id=$1 AND NOT is_deleted AND status='PendingPayment' ${all ? "" : "AND seat_hold_expires_at<=clock_timestamp()"} ORDER BY booking_id`,[id])).rows;
  for (const row of rows) {
    const result = await transitionBookingInTransaction(client,{bookingId:row.booking_id,toStatus:"Cancelled",user,reason:all ? "Departure no longer accepting unpaid reservations" : "Unpaid seat hold expired"},events,true);
    if (!result.ok) throw new TripError(result.message,409);
  }
}
export async function operateDeparture(id: string, raw: Record<string,unknown>, user: PublicUser) {
  adminOnly(user); tripUuid(id);
  const action = tripText(raw.action,"Trip action",20,true), version = tripNumber(raw.version,"Version",1,2147483647);
  const reason = tripText(raw.reason ?? "","Reason",500,action === "cancel");
  const events: BookingTransitionEvent[] = [];
  const result = await tripTransaction(async client => {
    const row = await lockDeparture(client,id);
    if (row.version !== version) throw new TripError("This trip changed. Reload it before continuing.",409);
    const status = row.status as DepartureStatus;
    let next: DepartureStatus = status;
    if (action === "expire") {
      await retireHolds(client,id,user,events);
    } else if (action === "open") {
      if (!["draft","closed"].includes(status)) throw new TripError("Only a draft or closed departure can open sales.",409);
      const data = await getAdminDeparture(id,client); assertTripReady(data);
      // Lock resources in the same order as private confirmation before reference validation.
      await lockVehicle(client,row.vehicle_id);
      await assertDriverWindow(client,row.driver_id,new Date(row.starts_at),new Date(row.ends_at),undefined,id);
      if (!(await client.query("SELECT 1 FROM tour_guides WHERE guide_id=$1 AND NOT is_deleted AND is_active FOR UPDATE",[row.guide_id])).rowCount) throw new TripError("Choose an active guide.");
      await checkReferences(client,data);
      if (!(await client.query("SELECT 1 FROM packages WHERE package_id=$1 AND booking_mode IN ('shared','both') AND NOT is_deleted AND is_active",[row.package_id])).rowCount) throw new TripError("Set the package template to Shared or Both before opening this departure.");
      if ((await client.query("SELECT 1 FROM trip_departures WHERE guide_id=$1 AND departure_id<>$2 AND NOT is_deleted AND status IN ('open','guaranteed','closed','ongoing') AND starts_at<$4 AND $3<ends_at",[row.guide_id,id,row.starts_at,row.ends_at])).rowCount) throw new TripError("This guide is assigned to an overlapping departure.",409);
      if (status === "draft") {
        if (await hasConflict(row.vehicle_id,new Date(row.starts_at),new Date(row.ends_at),null,client)) throw new TripError("The vehicle is already booked or blocked for those dates.",409);
        await client.query("INSERT INTO vehicle_availability(vehicle_id,starts_at,ends_at,kind,departure_id,note,created_by,updated_by) VALUES($1,$2,$3,'booked',$4,'Weekend group departure',$5,$5)",[row.vehicle_id,row.starts_at,row.ends_at,id,user.id]);
        const stops=(await client.query("SELECT s.tourist_spot_id AS id,s.name FROM package_stops ps JOIN tourist_spots s USING(tourist_spot_id) WHERE ps.package_id=$1 AND NOT ps.is_deleted AND NOT s.is_deleted AND s.is_active ORDER BY ps.stop_order",[row.package_id])).rows;
        await client.query("UPDATE trip_departures SET content=jsonb_set(content,'{routeStops}',$2::jsonb) WHERE departure_id=$1",[id,JSON.stringify(stops)]);
      } else if (!(await client.query("SELECT 1 FROM vehicle_availability WHERE departure_id=$1 AND NOT is_deleted",[id])).rowCount) throw new TripError("Transport reservation is missing. Contact the administrator.",409);
      next="open";
    } else if (action === "guarantee") {
      if (!["open","closed"].includes(status) || new Date(row.starts_at)<=new Date()) throw new TripError("Only a future open or closed departure can be guaranteed.",409);
      if ((await tripSeats(client,id)).confirmed < row.min_travellers) throw new TripError("The minimum number of paid travellers has not been reached.",409);
      next="guaranteed";
    } else if (action === "close") {
      if (!["open","guaranteed"].includes(status)) throw new TripError("Only an open departure can close sales.",409);
      next="closed";
    } else if (action === "draft") {
      if (status !== "closed") throw new TripError("Close sales before returning to draft.",409);
      await retireHolds(client,id,user,events);
      const seats = await tripSeats(client,id);
      if (seats.confirmed+seats.held) throw new TripError("This departure has committed seats. Cancel and arrange a replacement instead of changing the agreed plan.",409);
      await lockVehicle(client,row.vehicle_id);
      await client.query("UPDATE vehicle_availability SET is_deleted=true,updated_by=$2 WHERE departure_id=$1 AND NOT is_deleted",[id,user.id]);
      next="draft";
    } else if (action === "start" || action === "complete" || action === "cancel") {
      if (action === "start") {
        if (!["guaranteed","closed"].includes(status) || new Date(row.starts_at)>new Date()) throw new TripError("Guarantee or close the group first, then start it at the scheduled departure time.",409);
        if ((await tripSeats(client,id)).confirmed<row.min_travellers) throw new TripError("The paid group is below the minimum. Resolve this before departure.",409);
        await retireHolds(client,id,user,events,true); next="ongoing";
      } else if (action === "complete") {
        if (status!=="ongoing") throw new TripError("Only an ongoing departure can be completed.",409);
        next="completed";
      } else {
        if (["cancelled","completed"].includes(status)) throw new TripError("This departure has already ended.",409);
        next="cancelled";
      }
      const rows = (await client.query("SELECT booking_id,status FROM bookings WHERE departure_id=$1 AND NOT is_deleted AND status IN ('PendingPayment','Confirmed','Ongoing') ORDER BY booking_id",[id])).rows;
      for (const booking of rows) {
        const toStatus = action === "cancel" ? "Cancelled" : action === "start" ? "Ongoing" : "Completed";
        const changed = await transitionBookingInTransaction(client,{bookingId:booking.booking_id,toStatus,user,reason:reason || `Group departure ${next}`,refundInitiatedBy:action === "cancel" ? "operator" : undefined},events,true);
        if (!changed.ok) throw new TripError(changed.message,409);
      }
      if (action === "cancel") {
        if (row.vehicle_id) await lockVehicle(client,row.vehicle_id);
        await client.query("UPDATE vehicle_availability SET is_deleted=true,updated_by=$2 WHERE departure_id=$1 AND NOT is_deleted",[id,user.id]);
      }
    } else throw new TripError("Unknown trip action.");
    await client.query("UPDATE trip_departures SET status=$2,version=version+1,updated_by=$3 WHERE departure_id=$1",[id,next,user.id]);
    return getAdminDeparture(id,client);
  });
  for (const event of events) await notifyTransition(event);
  await logActivity({userId:user.id,action:`trip.${action}`,entityType:"trip_departure",entityId:id,details:{reason,status:result.status}});
  return result;
}

export async function departureManifest(id: string, user: PublicUser) {
  adminOnly(user); tripUuid(id);
  const [trip,bookings,passengers,rooms] = await Promise.all([
    getAdminDeparture(id),
    getPool().query(`SELECT b.booking_id AS id,b.booking_reference AS reference,b.status,b.passenger_count AS "passengerCount",b.total_amount::float8 AS "totalAmount",b.seat_hold_expires_at AS "holdExpiresAt",u.name,u.email,u.phone,b.customer_notes AS notes,r.status AS "refundStatus",r.amount::float8 AS "refundAmount"
      FROM bookings b JOIN users u USING(user_id) LEFT JOIN refunds r USING(booking_id) WHERE b.departure_id=$1 AND NOT b.is_deleted ORDER BY b.created_at`,[id]),
    getPool().query(`SELECT p.booking_passenger_id AS id,p.booking_id AS "bookingId",p.name,p.age,p.phone,p.is_primary AS "isPrimary",b.status FROM booking_passengers p JOIN bookings b USING(booking_id) WHERE b.departure_id=$1 AND NOT b.is_deleted ORDER BY b.created_at,p.booking_passenger_id`,[id]),
    getPool().query(`SELECT a.assignment_id AS id,a.stay_id AS "stayId",a.booking_passenger_id AS "passengerId",a.room_label AS "roomLabel",a.private_notes AS notes FROM trip_room_assignments a JOIN trip_stays s USING(stay_id) WHERE s.departure_id=$1 AND NOT a.is_deleted AND a.is_active ORDER BY a.room_label`,[id])]);
  return { trip,bookings:bookings.rows,passengers:passengers.rows,rooms:rooms.rows };
}
export async function assignTripRoom(id: string, raw: Record<string,unknown>, user: PublicUser) {
  adminOnly(user); const stayId = tripUuid(raw.stayId), passengerId = tripNumber(raw.passengerId,"Traveller",1,2147483647), label = tripText(raw.roomLabel ?? "","Room label",60), notes = tripText(raw.notes ?? "","Room notes",500);
  await tripTransaction(async client => {
    const trip = await lockDeparture(client,id);
    if (["draft","cancelled","completed"].includes(trip.status)) throw new TripError("Room allocation is available for operating departures.",409);
    const stay = (await client.query("SELECT *,check_in::text AS check_in,check_out::text AS check_out FROM trip_stays WHERE stay_id=$1 AND departure_id=$2 AND NOT is_deleted AND is_active AND confirmation_status='confirmed'",[stayId,id])).rows[0];
    const passenger = (await client.query("SELECT 1 FROM booking_passengers p JOIN bookings b USING(booking_id) WHERE p.booking_passenger_id=$1 AND b.departure_id=$2 AND NOT b.is_deleted AND b.status IN ('Confirmed','Ongoing')",[passengerId,id])).rows[0];
    if (!stay || !passenger) throw new TripError("Select a confirmed traveller and hotel belonging to this departure.",404);
    await client.query("UPDATE trip_room_assignments SET is_deleted=true,is_active=false,updated_by=$3 WHERE stay_id=$1 AND booking_passenger_id=$2 AND NOT is_deleted",[stayId,passengerId,user.id]);
    if (!label) return;
    const existing = (await client.query("SELECT room_label,count(*)::int AS count FROM trip_room_assignments WHERE stay_id=$1 AND NOT is_deleted AND is_active GROUP BY room_label",[stayId])).rows;
    if (existing.reduce((n,r)=>n+r.count,0)+1 > stay.rooms_reserved*stay.occupancy_per_room-stay.staff_beds_reserved || (existing.find(r=>r.room_label===label)?.count ?? 0)>=stay.occupancy_per_room || (!existing.some(r=>r.room_label===label) && existing.length>=stay.rooms_reserved)) throw new TripError("This allocation exceeds the confirmed room or customer-bed capacity.",409);
    // A traveller cannot occupy two different hotel groups covering the same night.
    if ((await client.query(`SELECT 1 FROM trip_room_assignments a JOIN trip_stays s USING(stay_id) WHERE a.booking_passenger_id=$1 AND NOT a.is_deleted AND a.is_active AND s.departure_id=$2 AND s.stay_id<>$3 AND s.check_in<$5::date AND $4::date<s.check_out`,[passengerId,id,stayId,stay.check_in,stay.check_out])).rowCount) throw new TripError("This traveller already has accommodation for an overlapping night.",409);
    await client.query("INSERT INTO trip_room_assignments(stay_id,booking_passenger_id,room_label,private_notes,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$5)",[stayId,passengerId,label,notes,user.id]);
  });
  await logActivity({userId:user.id,action:"trip.room_assignment",entityType:"trip_departure",entityId:id});
}

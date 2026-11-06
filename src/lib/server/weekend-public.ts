import type { QueryResultRow } from "pg";
import { TripError, tripDate } from "@/lib/weekend-trips";
import type { PublicTrip, TripFilters } from "@/lib/weekend-public";
import { getPool } from "./db";
import { WEEKEND_CANCELLATION_POLICY } from "./weekend-bookings";
export function readTripFilters(raw: Record<string,unknown>):TripFilters {
  const filters:TripFilters={};
  for(const key of ['cityId','regionId','minPrice','maxPrice','seats'] as const) {
    if(raw[key]==null||raw[key]==='')continue;
    const value=typeof raw[key]==='number'?raw[key]:typeof raw[key]==='string'&&/^\d+(\.\d{1,2})?$/.test(raw[key] as string)?Number(raw[key]):NaN;
    if(!Number.isFinite(value)||value<0||value>99999999.99||(['cityId','regionId','seats'].includes(key)&&(!Number.isSafeInteger(value)||value<1)))throw new TripError('Check your trip filters.');
    filters[key]=value;
  }
  for(const key of ['from','to'] as const)if(raw[key])filters[key]=tripDate(raw[key]);
  if(filters.from&&filters.to&&filters.from>filters.to)throw new TripError('Choose an end date after the start date.');
  if(filters.minPrice!=null&&filters.maxPrice!=null&&filters.minPrice>filters.maxPrice)throw new TripError('Check the minimum and maximum price.');
  if(raw.featured!=null&&raw.featured!==''){if(![true,false,'true','false'].includes(raw.featured as string))throw new TripError('Invalid featured filter.');filters.featured=raw.featured===true||raw.featured==='true';}
  if(raw.sort){if(!['date','price-low','price-high'].includes(String(raw.sort)))throw new TripError('Invalid trip order.');filters.sort=raw.sort as TripFilters['sort'];}
  return filters;
}
const publicSelect=`SELECT d.departure_id,d.slug,d.title,d.starts_at,d.ends_at,d.status,d.pickup_city_id,c.name AS pickup_city,p.region_id,r.name AS region,
  d.pickup_address,d.return_address,d.capacity,d.min_travellers,d.price_per_person,d.tax_percent,d.booking_opens_at,d.booking_closes_at,d.decision_deadline,d.payment_hold_minutes,d.is_featured,d.content,
  g.name AS guide_name,g.image_url AS guide_image,g.bio AS guide_bio,g.languages AS guide_languages,v.name AS vehicle_name,dr.name AS driver_name,
  COALESCE(s.confirmed,0)::int AS confirmed,GREATEST(0,d.capacity-COALESCE(s.reserved,0))::int AS available,
  (d.status IN ('open','guaranteed') AND clock_timestamp()>=d.booking_opens_at AND clock_timestamp()<d.booking_closes_at AND (d.status='guaranteed' OR clock_timestamp()<d.decision_deadline)) AS bookable
  FROM trip_departures d JOIN packages p USING(package_id) JOIN regions r USING(region_id) JOIN cities c ON c.city_id=d.pickup_city_id
  LEFT JOIN tour_guides g USING(guide_id) LEFT JOIN vehicles v USING(vehicle_id) LEFT JOIN drivers dr USING(driver_id)
  LEFT JOIN LATERAL(SELECT sum(passenger_count) FILTER(WHERE status IN ('Confirmed','Ongoing','Completed')) AS confirmed,
    sum(passenger_count) FILTER(WHERE status IN ('Confirmed','Ongoing','Completed') OR (status='PendingPayment' AND seat_hold_expires_at>clock_timestamp())) AS reserved FROM bookings WHERE departure_id=d.departure_id AND NOT is_deleted) s ON true
  WHERE NOT d.is_deleted AND d.is_active AND d.status<>'draft'`;
const iso=(v:Date)=>v.toISOString();
function publicTrip(r:QueryResultRow):PublicTrip {
  return {id:r.departure_id,slug:r.slug,title:r.title,startsAt:iso(r.starts_at),endsAt:iso(r.ends_at),status:r.status,pickupCityId:r.pickup_city_id,pickupCity:r.pickup_city,regionId:r.region_id,region:r.region,pickupAddress:r.pickup_address,returnAddress:r.return_address,capacity:r.capacity,availableSeats:r.available,confirmedSeats:r.confirmed,minTravellers:r.min_travellers,pricePerPerson:Number(r.price_per_person),taxPercent:Number(r.tax_percent),bookingOpensAt:iso(r.booking_opens_at),bookingClosesAt:iso(r.booking_closes_at),decisionDeadline:iso(r.decision_deadline),paymentHoldMinutes:r.payment_hold_minutes,bookable:r.bookable,isFeatured:r.is_featured,content:r.content,guide:r.guide_name?{name:r.guide_name,imageUrl:r.guide_image??'',bio:r.guide_bio,languages:r.guide_languages}:null,vehicleName:r.vehicle_name??'',driverName:r.driver_name??'',stays:[],cancellationPolicy:WEEKEND_CANCELLATION_POLICY};
}
export async function listPublicTrips(filters:TripFilters={}):Promise<PublicTrip[]> {
  const params:unknown[]=[], clauses=["d.status IN ('open','guaranteed','closed')","d.starts_at>clock_timestamp()"];
  const add=(condition:string,value:unknown)=>{params.push(value);clauses.push(condition.replace('?',`$${params.length}`));};
  if(filters.cityId)add('d.pickup_city_id=?',filters.cityId);
  if(filters.regionId)add('p.region_id=?',filters.regionId);
  if(filters.from)add("(d.starts_at AT TIME ZONE 'Asia/Kolkata')::date>=?::date",filters.from);
  if(filters.to)add("(d.starts_at AT TIME ZONE 'Asia/Kolkata')::date<=?::date",filters.to);
  if(filters.minPrice!=null)add('d.price_per_person>=?',filters.minPrice);
  if(filters.maxPrice!=null)add('d.price_per_person<=?',filters.maxPrice);
  if(filters.seats)add('GREATEST(0,d.capacity-COALESCE(s.reserved,0))>=?',filters.seats);
  if(filters.featured)clauses.push('d.is_featured');
  const order=filters.sort==='price-low'?'d.price_per_person ASC,':filters.sort==='price-high'?'d.price_per_person DESC,':'';
  return (await getPool().query(`${publicSelect} AND ${clauses.join(' AND ')} ORDER BY ${order} d.starts_at,d.display_order,d.departure_id LIMIT 200`,params)).rows.map(publicTrip);
}
export async function getPublicTrip(key:string):Promise<PublicTrip|null> {
  if(key.length>160||!/^[a-z0-9-]+$/.test(key))return null;
  const row=(await getPool().query(`${publicSelect} AND (d.slug=$1 OR d.departure_id::text=$1) LIMIT 1`,[key])).rows[0]; if(!row)return null;
  const result=publicTrip(row);
  result.stays=(await getPool().query(`SELECT hotel_name AS "hotelName",hotel_address AS "hotelAddress",COALESCE(image_url,'') AS "imageUrl",check_in::text AS "checkIn",check_out::text AS "checkOut",room_type AS "roomType",occupancy_per_room AS "occupancyPerRoom",meal_plan AS "mealPlan",COALESCE(public_notes,'') AS "publicNotes" FROM trip_stays WHERE departure_id=$1 AND NOT is_deleted AND is_active AND confirmation_status='confirmed' ORDER BY check_in,hotel_name`,[result.id])).rows;
  return result;
}

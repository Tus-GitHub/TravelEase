/** Real development transactions, synthetic fixtures, no schema changes/external mail. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import pg from "pg";
import nodemailer from "nodemailer";
import { runtimeDatabaseConfig } from "../../src/lib/server/db-config.ts";
import type { DepartureInput } from "../../src/lib/weekend-trips.ts";
assert(process.argv.includes('--dev') && !process.env.VERCEL);
assert.equal(execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim(),'development');
const owner=process.env.DATABASE_URL!, runtime=process.env.DATABASE_URL_APP!, prod=process.env.DATABASE_URL_PRODUCTION!;
const endpoint=(url:string)=>new URL(url).hostname.replace('-pooler.','.');
assert(owner&&runtime&&prod); assert.equal(endpoint(owner),endpoint(runtime)); assert.notEqual(endpoint(owner),endpoint(prod));
const tag='weekend-'+randomUUID(), pool=new pg.Pool({...runtimeDatabaseConfig(owner),max:6,application_name:tag});
const runtimePool=new pg.Pool({...runtimeDatabaseConfig(runtime),max:4,application_name:tag});
(globalThis as unknown as {__pgPool:pg.Pool}).__pgPool=runtimePool;
const transport=nodemailer.createTransport;
nodemailer.createTransport=(()=>transport({jsonTransport:true})) as typeof transport;
process.env.SMTP_HOST='in-memory.invalid'; process.env.SMTP_USER='test'; process.env.SMTP_PASS='test';
const {saveDeparture,saveGuide,getAdminDeparture,tripSeats}=await import('../../src/lib/server/weekend-trips.ts');
const {operateDeparture,assignTripRoom,departureManifest}=await import('../../src/lib/server/weekend-operations.ts');
const {createBooking,transitionBooking,getBookingForUser}=await import('../../src/lib/server/bookings.ts');
const {quoteSharedTrip}=await import('../../src/lib/server/weekend-bookings.ts');
const {assignBookingDriver}=await import('../../src/lib/server/admin/bookings.ts');
const {settleRefund}=await import('../../src/lib/server/refunds.ts');
const {updateVehicle,deleteVehicle}=await import('../../src/lib/server/admin/fleet.ts');
const {updateDriver}=await import('../../src/lib/server/admin/drivers.ts');
const users=['admin','customer','customer'].map(role=>({id:randomUUID(),name:'Weekend concurrency',email:randomUUID()+'@example.invalid',phone:'0000000000',role,emailVerified:true,createdAt:new Date().toISOString()}));
const [admin,a,b]=users, ids=users.map(u=>u.id);
let vt:number|undefined, vehicle:number|undefined, driver:number|undefined, pkg:number|undefined, guide:number|undefined;
const departures:string[]=[];
async function race<T>(sql:string,params:unknown[],calls:(()=>Promise<T>)[],holdMs=0) {
  const guard=await pool.connect(); let jobs:Promise<T>[]=[];
  try { await guard.query('BEGIN'); await guard.query(sql,params); jobs=calls.map(fn=>fn()); const results=Promise.allSettled(jobs);
    let waited=false; for(let i=0;i<50;i++) { const n=(await pool.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock'",[tag])).rows[0].n; if(n>=calls.length){waited=true;break;} await new Promise(resolve=>setTimeout(resolve,40)); }
    if(holdMs)await new Promise(resolve=>setTimeout(resolve,holdMs));
    await guard.query('ROLLBACK'); const settled=await results; assert(waited,'Concurrent requests reached real PostgreSQL locks'); return settled;
  } finally { await guard.query('ROLLBACK'); guard.release(); await Promise.allSettled(jobs); }
}
async function action(id:string,action:string,reason='Acceptance test') { const trip=await getAdminDeparture(id); return operateDeparture(id,{action,version:trip.version,reason},admin); }
const request=(departureId:string,user=a,clientRequestId=randomUUID())=>({bookingType:'package' as const,startDateTime:'',departureId,clientRequestId,passengerCount:1,passengers:[{name:user.name+' '+user.id.slice(0,4),age:25,phone:user.phone}],customerNotes:'Test notes'});
async function create(id:string,user=a) { const result=await createBooking(request(id,user),user); assert(result.ok,result.ok?'':result.message); return result.bookingId; }
try {
  for(const u of users) await pool.query("INSERT INTO users(user_id,name,email,phone,password_hash,role_id,email_verified_at) SELECT $1,$2,$3,$4,'disabled',role_id,now() FROM roles WHERE name=$5",[u.id,u.name,u.email,u.phone,u.role]);
  const city=(await pool.query("SELECT city_id,region_id FROM cities WHERE is_active AND NOT is_deleted ORDER BY city_id LIMIT 1")).rows[0]; assert(city);
  vt=(await pool.query("INSERT INTO vehicle_types(slug,title,created_by) VALUES($1,'Weekend contention',$2) RETURNING vehicle_type_id",[tag,admin.id])).rows[0].vehicle_type_id;
  vehicle=(await pool.query("INSERT INTO vehicles(vehicle_type_id,name,seating_capacity,base_price_per_day,created_by) VALUES($1,'Weekend contention coach',6,1000,$2) RETURNING vehicle_id",[vt,admin.id])).rows[0].vehicle_id;
  driver=(await pool.query("INSERT INTO drivers(name,phone,created_by) VALUES('Weekend contention driver','0000000000',$1) RETURNING driver_id",[admin.id])).rows[0].driver_id;
  guide=(await saveGuide({name:'Weekend contention guide',phone:'0000000000',imageUrl:'',bio:'Guide bio',languages:['Hindi'],privateNotes:'private-guide',isActive:true},admin.id)).id;
  pkg=(await pool.query("INSERT INTO packages(region_id,vehicle_type_id,name,slug,duration_days,max_persons,price_per_person,booking_mode,created_by) VALUES($1,$2,$3,$3,3,5,4999,'shared',$4) RETURNING package_id",[city.region_id,vt,tag,admin.id])).rows[0].package_id;
  const date=new Date('2090-01-01T16:30:00Z'); while(date.getUTCDay()!==5)date.setUTCDate(date.getUTCDate()+1);
  const start=date.toISOString(), end=new Date(date.getTime()+2*86400000).toISOString(), night=new Date(date.getTime()+86400000).toISOString().slice(0,10);
  const draft:DepartureInput={packageId:pkg!,slug:tag,title:'Friday contention',startsAt:start,endsAt:end,pickupCityId:city.city_id,pickupAddress:'Test pickup',returnAddress:'Test return',vehicleId:vehicle!,driverId:driver!,guideId:guide!,capacity:1,staffReservedSeats:1,minTravellers:1,pricePerPerson:4999,taxPercent:5,bookingOpensAt:new Date(Date.now()-60000).toISOString(),bookingClosesAt:new Date(date.getTime()-86400000).toISOString(),decisionDeadline:new Date(date.getTime()-2*86400000).toISOString(),paymentHoldMinutes:120,content:{summary:'Meet the group',description:'Shared weekend journey',imageUrl:'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b',imageAlt:'Mountains',itinerary:[{day:1,title:'Meet',description:'Evening pickup'}],inclusions:['Transport','Guide','Hotel'],exclusions:['Personal purchases'],stayNights:[night]},privateNotes:'private-trip',isFeatured:false,displayOrder:0,stays:[{hotelName:'Fixture hotel',hotelAddress:'Test road',cityId:null,imageUrl:'',checkIn:night,checkOut:end.slice(0,10),roomType:'Twin',roomsReserved:1,occupancyPerRoom:2,staffBedsReserved:0,mealPlan:'Breakfast',confirmationStatus:'confirmed',supplierReference:'PRIVATE-SUPPLIER',contactName:'Private hotel contact',contactPhone:'0000000000',supplierCost:1000,publicNotes:'Twin sharing',privateNotes:'private-hotel'}]};
  const trip=await saveDeparture(draft,admin.id); departures.push(trip.id);
  await action(trip.id,'open');
  await assert.rejects(()=>updateVehicle(vehicle!,{seatingCapacity:1},admin.id),/reserved/);
  await assert.rejects(()=>deleteVehicle(vehicle!,admin.id),/reserved/);
  await assert.rejects(()=>updateDriver(driver!,{isActive:false},admin.id),/reserved/);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM vehicle_availability WHERE departure_id=$1 AND NOT is_deleted",[trip.id])).rows[0].n,1);
  const quote=await quoteSharedTrip({departureId:trip.id,passengerCount:1,total:1}); assert.equal(quote.quote.totalAmount,4999);
  const last=await race("SELECT 1 FROM trip_departures WHERE departure_id=$1 FOR UPDATE",[trip.id],[a,b].map(u=>()=>createBooking(request(trip.id,u),u)));
  const results=last.map(r=>{if(r.status==='rejected')throw r.reason;return r.value;});
  assert.equal(results.filter(r=>r?.ok).length,1);
  const winner=results.find(r=>r?.ok)!; assert(winner?.ok); const booked=winner.bookingId;
  assert.equal((await tripSeats(runtimePool,trip.id)).held,1);
  console.log('PASS final-seat contention: one hold; inclusive quote equals stored total.');
  const own=(await pool.query("SELECT user_id FROM bookings WHERE booking_id=$1",[booked])).rows[0].user_id;
  const winnerUser=users.find(u=>u.id===own)!;
  const detail=await getBookingForUser(booked,winnerUser); assert(detail?.tripSnapshot); assert.equal(detail.totalAmount,4999);
  assert(!JSON.stringify(detail.tripSnapshot).includes('PRIVATE-SUPPLIER')); assert(!JSON.stringify(detail.tripSnapshot).includes('private-')); assert.equal(detail.guide,null);
  assert.equal(await getBookingForUser(booked,users.find(u=>u.role==='customer'&&u.id!==own)!),null);
  assert((await transitionBooking({bookingId:booked,toStatus:'Cancelled',user:winnerUser})).ok);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM vehicle_availability WHERE departure_id=$1 AND NOT is_deleted",[trip.id])).rows[0].n,1);
  const same=request(trip.id,a), replay=await race("SELECT 1 FROM trip_departures WHERE departure_id=$1 FOR UPDATE",[trip.id],[1,2].map(()=>()=>createBooking(same,a)));
  const replayIds=replay.map(r=>{assert(r.status==='fulfilled'&&r.value.ok);return r.value.bookingId;}); assert.equal(replayIds[0],replayIds[1]);
  const changed=await createBooking({...same,customerNotes:'Changed'},a); assert(!changed.ok&&changed.status===409);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM booking_status_history WHERE booking_id=$1",[replayIds[0]])).rows[0].n,1);
  console.log('PASS request replay returns one booking/history; changed payload rejected; stranger details private.');
  await pool.query("UPDATE bookings SET seat_hold_expires_at=clock_timestamp()+interval '1 second' WHERE booking_id=$1",[replayIds[0]]);
  const expiryRace=await race<{ok:boolean}>("SELECT 1 FROM trip_departures WHERE departure_id=$1 FOR UPDATE",[trip.id],[()=>transitionBooking({bookingId:replayIds[0],toStatus:'Confirmed',user:admin}),()=>createBooking(request(trip.id,b),b)],1250);
  assert(expiryRace[0].status==='fulfilled'&&!expiryRace[0].value.ok);assert(expiryRace[1].status==='fulfilled'&&expiryRace[1].value.ok);
  const replacement=(await pool.query("SELECT booking_id FROM bookings WHERE departure_id=$1 AND user_id=$2 AND status='PendingPayment'",[trip.id,b.id])).rows[0];assert(replacement);
  assert((await transitionBooking({bookingId:replacement.booking_id,toStatus:'Cancelled',user:b})).ok);
  assert.equal((await tripSeats(runtimePool,trip.id)).held,0);
  assert(!(await transitionBooking({bookingId:replayIds[0],toStatus:'Confirmed',user:admin})).ok);
  await action(trip.id,'expire'); assert.equal((await getBookingForUser(replayIds[0],a))?.status,'Cancelled');
  const paid=await create(trip.id,a); assert((await transitionBooking({bookingId:paid,toStatus:'Confirmed',user:admin})).ok);
  assert.equal((await tripSeats(runtimePool,trip.id)).confirmed,1);
  assert(!(await assignBookingDriver(paid,null,admin.id)).ok);
  assert(!(await transitionBooking({bookingId:paid,toStatus:'Ongoing',user:admin})).ok);
  await action(trip.id,'guarantee');
  const overlap=await saveDeparture({...draft,slug:tag+'-overlap'},admin.id);departures.push(overlap.id);
  await assert.rejects(()=>action(overlap.id,'open'),/driver|booked/);
  const insufficient=await saveDeparture({...draft,slug:tag+'-hotel',stays:draft.stays.map(s=>({...s,roomsReserved:0}))},admin.id);departures.push(insufficient.id);
  await assert.rejects(()=>action(insufficient.id,'open'),/hotel beds/);
  const manifest=await departureManifest(trip.id,admin), passenger=manifest.passengers.find(p=>p.bookingId===paid)!;
  await assert.rejects(()=>departureManifest(trip.id,a),/administrator/);
  await assignTripRoom(trip.id,{stayId:trip.stays[0].id,passengerId:passenger.id,roomLabel:'Room A'},admin);
  await assert.rejects(()=>assignTripRoom(trip.id,{stayId:randomUUID(),passengerId:passenger.id,roomLabel:'Room X'},admin),/belonging/);
  assert.equal((await departureManifest(trip.id,admin)).rooms.length,1);
  await assert.rejects(async()=>saveDeparture({...draft,title:'Overwrite sold plan'},admin.id,trip.id,(await getAdminDeparture(trip.id)).version),/draft/);
  assert((await transitionBooking({bookingId:paid,toStatus:'Cancelled',user:a})).ok);
  assert.equal((await departureManifest(trip.id,admin)).rooms.length,0);
  assert.equal((await pool.query("SELECT amount FROM refunds WHERE booking_id=$1",[paid])).rows[0].amount,'4999.00');
  assert((await settleRefund(paid,{status:'paid',method:'test',reference:tag},admin.id)).ok);
  assert((await transitionBooking({bookingId:paid,toStatus:'Refunded',user:admin})).ok);
  console.log('PASS expiry, payment, group-only assignment/start, room ownership, immutable sold plan and individual cancellation/refund.');
  // More seats for the second independent departure, after retiring the first vehicle block.
  await action(trip.id,'cancel');
  const second=await saveDeparture({...draft,slug:tag+'-second',capacity:2},admin.id); departures.push(second.id); await action(second.id,'open');
  const p1=await create(second.id,a),p2=await create(second.id,b);
  for(const id of [p1,p2])assert((await transitionBooking({bookingId:id,toStatus:'Confirmed',user:admin})).ok);
  // Inject an application failure on the second status write, after the first refund was inserted.
  const originalConnect=runtimePool.connect.bind(runtimePool); let writes=0;
  runtimePool.connect=((callback?: (error:Error,client:pg.PoolClient,done:(release?:boolean)=>void)=>void)=>{
    // Pool.query uses callback acquisition; preserve it. Only explicit transaction
    // clients receive this one-run failure injection.
    if(callback)return originalConnect(callback);
    return originalConnect().then(client=>{const query=client.query.bind(client); client.query=((...args:unknown[])=>{ if(typeof args[0]==='string'&&args[0].startsWith('UPDATE bookings SET status')&&++writes===2)return Promise.reject(Error('Injected bulk cancellation failure')); return (query as (...args:unknown[])=>unknown)(...args); }) as typeof client.query; const release=client.release.bind(client); client.release=(...args)=>{client.query=query as typeof client.query;release(...args);}; return client;});
  }) as typeof runtimePool.connect;
  try { await assert.rejects(()=>action(second.id,'cancel'),/Injected/); } finally { runtimePool.connect=originalConnect; }
  assert.equal(writes,2); assert.equal((await tripSeats(runtimePool,second.id)).confirmed,2);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM refunds WHERE booking_id=ANY($1::uuid[])",[[p1,p2]])).rows[0].n,0);
  assert.equal((await getAdminDeparture(second.id)).status,'open');
  await action(second.id,'cancel');
  for(const id of [p1,p2]){const d=await getBookingForUser(id,admin);assert.equal(d?.status,'Cancelled');assert.equal(d?.refund?.tier,'operator');assert.equal(d?.refund?.amount,4999);}
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM vehicle_availability WHERE departure_id=$1 AND NOT is_deleted",[second.id])).rows[0].n,0);
  console.log('PASS atomic whole-trip cancellation rollback, then full operator refunds and one shared vehicle release.');
  const running=await saveDeparture({...draft,slug:tag+'-running'},admin.id);departures.push(running.id);await action(running.id,'open');
  const onRoad=await create(running.id,a);assert((await transitionBooking({bookingId:onRoad,toStatus:'Confirmed',user:admin})).ok);await action(running.id,'guarantee');
  await assert.rejects(()=>action(running.id,'start'),/scheduled/);
  // Move only synthetic fixture times into the past to exercise group operation.
  await pool.query("UPDATE trip_departures SET booking_opens_at=clock_timestamp()-interval '4 days',decision_deadline=clock_timestamp()-interval '3 days',booking_closes_at=clock_timestamp()-interval '2 days',starts_at=clock_timestamp()-interval '1 day',ends_at=clock_timestamp()+interval '1 day' WHERE departure_id=$1",[running.id]);
  await action(running.id,'start');assert.equal((await getBookingForUser(onRoad,a))?.status,'Ongoing');
  await action(running.id,'complete');assert.equal((await getBookingForUser(onRoad,a))?.status,'Completed');
  console.log('PASS overlapping driver, insufficient hotel beds, early-start refusal and atomic group start/completion.');
} finally {
  await runtimePool.end();
  const client=await pool.connect();try {await client.query('BEGIN');
    await client.query("DELETE FROM trip_room_assignments WHERE stay_id IN(SELECT stay_id FROM trip_stays WHERE departure_id=ANY($1::uuid[]))",[departures]);
    await client.query("DELETE FROM notifications WHERE user_id=ANY($1::uuid[])",[ids]);
    await client.query("DELETE FROM activity_logs WHERE user_id=ANY($1::uuid[])",[ids]);
    await client.query("DELETE FROM vehicle_availability WHERE departure_id=ANY($1::uuid[])",[departures]);
    await client.query("DELETE FROM bookings WHERE user_id=ANY($1::uuid[])",[ids]);
    await client.query("DELETE FROM trip_stays WHERE departure_id=ANY($1::uuid[])",[departures]);
    await client.query("DELETE FROM trip_departures WHERE departure_id=ANY($1::uuid[])",[departures]);
    if(pkg)await client.query("DELETE FROM packages WHERE package_id=$1 AND created_by=$2",[pkg,admin.id]);
    if(guide)await client.query("DELETE FROM tour_guides WHERE guide_id=$1 AND created_by=$2",[guide,admin.id]);
    if(driver)await client.query("DELETE FROM drivers WHERE driver_id=$1 AND created_by=$2",[driver,admin.id]);
    if(vehicle)await client.query("DELETE FROM vehicles WHERE vehicle_id=$1 AND created_by=$2",[vehicle,admin.id]);
    if(vt)await client.query("DELETE FROM vehicle_types WHERE vehicle_type_id=$1 AND created_by=$2",[vt,admin.id]);
    await client.query("DELETE FROM users WHERE user_id=ANY($1::uuid[])",[ids]);
    assert.equal((await client.query("SELECT count(*)::int AS n FROM users WHERE user_id=ANY($1::uuid[])",[ids])).rows[0].n,0);
    await client.query('COMMIT'); console.log('Weekend booking fixtures cleaned; production never connected.');
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();await pool.end();}
}

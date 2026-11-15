// Real development database; all email is captured in a loopback sink.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {localMailSink} from './_local-smtp.mjs';
import {getPool} from '../../src/lib/server/db.ts';
import {cachedMapRequest} from '../../src/lib/server/map-services.ts';
import {createBooking} from '../../src/lib/server/bookings.ts';
const require=createRequire(import.meta.url),{Pool}=require('pg');
assert(process.argv.includes('--dev') && !process.env.VERCEL, 'Development only');
assert(process.env.DATABASE_URL && process.env.DATABASE_URL_APP && process.env.DATABASE_URL_PRODUCTION);
const host=s=>new URL(s).hostname.replace('-pooler.','.');
assert.notEqual(host(process.env.DATABASE_URL),host(process.env.DATABASE_URL_PRODUCTION));
assert.equal(host(process.env.DATABASE_URL),host(process.env.DATABASE_URL_APP));
const pool=new Pool({connectionString:process.env.DATABASE_URL,max:2,connectionTimeoutMillis:15000});
const id=randomUUID(),email=`service-${id}@example.invalid`,key=randomUUID().replaceAll('-','').repeat(2);
let type,car,route,booking;
const inbox=String((await pool.query("SELECT setting_value FROM site_settings WHERE setting_key='contact_email'")).rows[0]?.setting_value||'');
const sink=await localMailSink([email,...(inbox?[inbox]:[])]);
Object.assign(process.env,{SMTP_HOST:'127.0.0.1',SMTP_PORT:String(sink.port),SMTP_USER:'test',SMTP_PASS:'test',EMAIL_FROM:'Service test <test@example.invalid>'});
try{
 await pool.query("INSERT INTO users(user_id,name,email,phone,password_hash,email_verified_at,role_id) VALUES($1,'Development service test',$2,'','unusable',now(),(SELECT role_id FROM roles WHERE name='customer'))",[id,email]);
 type=(await pool.query('INSERT INTO vehicle_types(slug,title) VALUES($1,$2) RETURNING vehicle_type_id',[id,'Development service test'])).rows[0].vehicle_type_id;
 car=(await pool.query('INSERT INTO vehicles(vehicle_type_id,name,seating_capacity,base_price_per_day) VALUES($1,$2,4,2000) RETURNING vehicle_id',[type,'Development service test'])).rows[0].vehicle_id;
 await pool.query("INSERT INTO pricing_rules(vehicle_id,booking_type_id,name,per_km_rate) VALUES($1,(SELECT booking_type_id FROM booking_types WHERE code='point_to_point'),'Development service test',18)",[car]);
 const suggestions=await cachedMapRequest('photon',key,async()=>[{lat:28.6129,lng:77.2295,label:'Service fixture'}]);
 assert.equal(suggestions.length,1); assert.deepEqual(await cachedMapRequest('photon',key,async()=>{throw Error('Cache missed')}),suggestions);
 route={id:randomUUID().replaceAll('-','').repeat(2),pickup:{lat:28.6129,lng:77.2295},drop:{lat:28.6562,lng:77.241},roundTrip:false,distanceKm:12.34,durationHours:1,provider:'fossgis',geometry:[]};
 await pool.query("INSERT INTO map_service_cache(cache_key,provider,response,expires_at) VALUES($1,'fossgis',$2::jsonb,now()+interval '1 hour')",[route.id,JSON.stringify(route)]);
 const user={id,name:'Development service test',email,phone:'',role:'customer'};
 const input={bookingType:'point_to_point',vehicleId:car,vehicleTypeId:type,routeId:route.id,pickupPoint:route.pickup,dropPoint:route.drop,startDateTime:new Date(Date.now()+86400000*3).toISOString(),passengerCount:2,expectedTotal:222.12};
 assert.equal((await createBooking(input,user)).status,400);
 assert.equal((await createBooking({...input,passengers:[{name:user.name,phone:'invalid',isPrimary:true}]},user)).status,400);
 const result=await createBooking({...input,passengers:[{name:user.name,phone:'+91 99999 99999',isPrimary:true}]},user);assert.equal(result.ok,true,JSON.stringify(result));booking=result.bookingId;
 const stored=(await pool.query('SELECT total_amount,status,price_breakdown FROM bookings WHERE booking_id=$1',[booking])).rows[0];assert.equal(Number(stored.total_amount),222.12);assert.equal(stored.status,'PendingPayment');
 const contact=(await pool.query('SELECT phone,is_primary FROM booking_passengers WHERE booking_id=$1',[booking])).rows;assert.equal(contact.length,1);assert.equal(contact[0].phone,'+919999999999');assert(contact[0].is_primary);
 assert.equal((await pool.query('SELECT phone FROM users WHERE user_id=$1',[id])).rows[0].phone,'');
 assert.equal(sink.messages.length,2);assert.deepEqual(sink.rejected,[]);assert(sink.messages.some(m=>m.content.includes('+919999999999')));
 console.log('PASS real development Photon quota/cache constraints, cached read, missing/invalid phone rejection, trusted fare, saved lead contact, unchanged profile, two loopback emails with contact.');
}finally{
 await pool.query('DELETE FROM notifications WHERE user_id=$1 OR booking_id IN (SELECT booking_id FROM bookings WHERE user_id=$1)',[id]);
 await pool.query('DELETE FROM activity_logs WHERE user_id=$1',[id]);await pool.query('DELETE FROM bookings WHERE user_id=$1',[id]);
 if(car)await pool.query('DELETE FROM pricing_rules WHERE vehicle_id=$1',[car]);if(car)await pool.query('DELETE FROM vehicles WHERE vehicle_id=$1',[car]);if(type)await pool.query('DELETE FROM vehicle_types WHERE vehicle_type_id=$1',[type]);
 await pool.query("DELETE FROM users WHERE user_id=$1 AND email=$2",[id,email]);await pool.query('DELETE FROM map_service_cache WHERE cache_key=ANY($1::text[])',[[key,...(route?[route.id]:[])]]);
 assert.equal((await pool.query('SELECT 1 FROM users WHERE user_id=$1',[id])).rowCount,0);
 await sink.close();await pool.end();await getPool().end();console.log('PASS owned development fixtures removed.');
}

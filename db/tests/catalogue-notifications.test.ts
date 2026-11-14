/** Real development contention and immutable event payload tests. Synthetic
 * fixtures, no DDL, production access or external email/provider requests. */
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import pg from "pg";
import nodemailer from "nodemailer";
import { runtimeDatabaseConfig } from "../../src/lib/server/db-config.ts";
import * as geo from "../../src/lib/server/admin/geography.ts";
import * as fleet from "../../src/lib/server/admin/fleet.ts";
import * as catalogue from "../../src/lib/server/admin/catalog.ts";
import * as vendors from "../../src/lib/server/admin/vendors.ts";
import * as tickets from "../../src/lib/server/support-tickets.ts";
import { deleteAccount, type PublicUser } from "../../src/lib/server/users.ts";
import { createBooking, transitionBooking } from "../../src/lib/server/bookings.ts";
import { assignBookingDriver } from "../../src/lib/server/admin/bookings.ts";
import { DependentRowsError } from "../../src/lib/server/db-errors.ts";
import * as dbErrors from "../../src/lib/server/db-errors.ts";

assert(process.argv.includes("--dev") && !process.env.VERCEL && process.env.VERCEL_ENV !== "production");
assert.equal(execFileSync("git",["branch","--show-current"],{encoding:"utf8"}).trim(),"development");
const host=(s:string)=>new URL(s).hostname.replace(/-pooler\./,".");
const owner=process.env.DATABASE_URL!,runtime=process.env.DATABASE_URL_APP||owner;
assert(owner&&process.env.DATABASE_URL_PRODUCTION);assert.equal(host(owner),host(runtime));assert.notEqual(host(owner),host(process.env.DATABASE_URL_PRODUCTION));
const tag=`catalogue-events-${randomUUID()}`,waits={lock_timeout:20000,statement_timeout:30000,idle_in_transaction_session_timeout:45000};
const routeId=createHash("sha256").update(tag).digest("hex"),pickupPoint={lat:28.6129,lng:77.2295},dropPoint={lat:28.6562,lng:77.241};
const pool=new pg.Pool({...runtimeDatabaseConfig(owner),...waits,max:5,application_name:tag+"-fixtures"});
const app=new pg.Pool({...runtimeDatabaseConfig(runtime),...waits,max:8,application_name:tag});
(globalThis as unknown as {__pgPool:pg.Pool}).__pgPool=app;
const userIds:string[]=[],bookingIds:string[]=[];
let admin!:PublicUser,customer!:PublicUser;
let rootRegion=0,rootType=0,rootCity=0,driverA=0,driverB=0,bookingType=0,sequence=0,checks=0;
const mails:Record<string,any>[]=[],transport=nodemailer.createTransport;let failMail=false;
nodemailer.createTransport=(()=>{
  const t=transport({jsonTransport:true}),send=t.sendMail.bind(t);
  t.sendMail=(async(options:any)=>{if(failMail)throw new Error("injected transport failure");mails.push(structuredClone(options));return send(options);}) as typeof t.sendMail;
  return t;
}) as unknown as typeof transport;
process.env.SMTP_HOST="in-memory.invalid";process.env.SMTP_USER="synthetic";process.env.SMTP_PASS="synthetic";process.env.EMAIL_FROM="test@example.invalid";
const pass=(s:string)=>{checks++;console.log(`PASS ${s}`);};
async function user(role="customer"):Promise<PublicUser>{const id=randomUUID();userIds.push(id);await pool.query("INSERT INTO users(user_id,name,email,phone,password_hash,role_id,email_verified_at) VALUES($1,'Catalogue event test',$2,'9999999999','disabled',(SELECT role_id FROM roles WHERE name=$3),now())",[id,`${id}@example.invalid`,role]);return{id,name:"Catalogue event test",email:`${id}@example.invalid`,phone:"9999999999",role,emailVerified:true,createdAt:new Date().toISOString()};}
const cityInput=(regionId:number)=>({regionId,name:`Synthetic city ${++sequence}`,latitude:null,longitude:null,isPickupPoint:true,isAirport:false});
const spotInput=(cityId:number)=>({cityId,name:`Synthetic spot ${++sequence}`,tag:"nature",description:""});
const vehicleInput=(vehicleTypeId:number)=>({vehicleTypeId,name:`Synthetic vehicle ${++sequence}`,registrationNumber:"",seatingCapacity:6,features:[],basePricePerDay:1000,perKmRate:18});
const packageInput=(regionId=rootRegion,vehicleTypeId=rootType)=>({regionId,vehicleTypeId,name:`Synthetic package ${randomUUID()}`,durationDays:1,maxPersons:6,pricePerPerson:1000,tag:"nature",rating:null});
async function region(){return(await geo.createRegion({name:`Synthetic region ${++sequence}`,state:"Synthetic"},admin.id)).id;}
async function type(){return(await fleet.createVehicleType({slug:`synthetic-${randomUUID()}`,title:"Synthetic type",description:""},admin.id)).id;}
async function waiting(count:number){for(let i=0;i<120;i++){if((await pool.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock'",[tag])).rows[0].n>=count)return;await new Promise(r=>setTimeout(r,25));}assert.fail(`Expected ${count} real PostgreSQL lock waiters`);}
async function ordered(lock:string,params:unknown[],calls:(()=>Promise<unknown>)[]){const guard=await pool.connect(),tasks:Promise<unknown>[]=[];try{await guard.query("BEGIN");await guard.query(lock,params);for(const call of calls){const task=call();tasks.push(task);void task.catch(()=>{});await waiting(tasks.length);}await guard.query("COMMIT");return await Promise.allSettled(tasks);}finally{await guard.query("ROLLBACK");guard.release();await Promise.allSettled(tasks);}}
function value<T=any>(result:PromiseSettledResult<unknown>):T{if(result.status==="rejected")throw result.reason;return result.value as T;}
const catalogueLock="SELECT pg_advisory_xact_lock(hashtextextended('admin-catalogue-relations',0))";
type Effect=(sql:string,args:unknown[],run:()=>Promise<any>)=>Promise<any>;
async function intercept<T>(effect:Effect,work:()=>Promise<T>):Promise<T>{const connect=app.connect;app.connect=((cb?:Parameters<typeof connect>[0])=>{if(cb)return connect.call(app,cb);return(connect as()=>Promise<pg.PoolClient>).call(app).then(client=>new Proxy(client,{get(target,key){if(key==="query")return(sql:string,...args:unknown[])=>effect(sql,args,()=>Reflect.apply(target.query,target,[sql,...args]));const x=Reflect.get(target,key);return typeof x==="function"?x.bind(target):x;}}));}) as typeof app.connect;try{return await work();}finally{app.connect=connect;}}
async function afterCommit<T>(hook:()=>Promise<void>,work:()=>Promise<T>){let fired=false;return intercept(async(sql,_args,run)=>{const r=await run();if(sql==="COMMIT"&&!fired){fired=true;await hook();}return r;},work);}
async function rawTicket(u:PublicUser,status="open"){const id=randomUUID();await pool.query("INSERT INTO support_tickets(support_ticket_id,reference,user_id,subject,status,created_by,updated_by) VALUES($1,$2,$3,'Original subject',$4,$3,$3)",[id,`T-${randomUUID().slice(0,8)}`,u.id,status]);return id;}
async function seedCap(u:PublicUser,n:number){for(let i=0;i<n;i++)await rawTicket(u);}
const openCount=async(u:PublicUser)=>(await pool.query("SELECT count(*)::int AS n FROM support_tickets WHERE user_id=$1 AND NOT is_deleted AND status IN ('open','pending')",[u.id])).rows[0].n;
const newTicket=(u:PublicUser)=>tickets.createTicket(u,{subject:"Synthetic support",message:"Synthetic first message"});
async function booking(status="PendingPayment",driverId:number|null=driverA){const id=randomUUID();bookingIds.push(id);sequence++;await pool.query(`INSERT INTO bookings(booking_id,booking_reference,user_id,booking_type_id,vehicle_type_id,driver_id,start_datetime,end_datetime,status,total_amount)
 VALUES($1,$2,$3,$4,$5,$6,$7::timestamptz,$7::timestamptz+interval '2 hours',$8,1000)`,[id,`T-${randomUUID().slice(0,8)}`,customer.id,bookingType,rootType,driverId,new Date(Date.UTC(2090,0,1+sequence)).toISOString(),status]);return id;}
const text=(m:Record<string,any>)=>String(m.text);
const require=createRequire(import.meta.url);
function route(file:string,aliases:Record<string,unknown>){const source=ts.transpileModule(readFileSync(file,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,mod={exports:{} as Record<string,(...args:any[])=>Promise<Response>>};new Function("require","module","exports",source)((id:string)=>aliases[id]??require(id),mod,mod.exports);return mod.exports;}
try{
  await pool.query("INSERT INTO map_service_cache(cache_key,provider,response,expires_at) VALUES($1,'fossgis',$2::jsonb,now()+interval '2 hours')",[routeId,JSON.stringify({id:routeId,pickup:pickupPoint,drop:dropPoint,roundTrip:false,distanceKm:10,durationHours:1,geometry:[[77.2295,28.6129],[77.241,28.6562]],provider:"fossgis"})]);
  admin=await user("admin");customer=await user();rootRegion=await region();rootType=await type();rootCity=(await geo.createCity(cityInput(rootRegion),admin.id)).id;
  bookingType=(await pool.query("SELECT booking_type_id FROM booking_types WHERE code='point_to_point'")).rows[0].booking_type_id;
  for(const name of ["Original driver","Replacement driver"]){const id=(await pool.query("INSERT INTO drivers(name,phone,created_by,updated_by) VALUES($1,'9999999999',$2,$2) RETURNING driver_id",[name,admin.id])).rows[0].driver_id;if(!driverA)driverA=id;else driverB=id;}
  const families=[
    {name:"region/city",setup:async()=>{const p=await region();return{remove:()=>geo.deleteRegion(p,admin.id),add:()=>geo.createCity(cityInput(p),admin.id),table:"regions",column:"region_id",id:p};}},
    {name:"region/package",setup:async()=>{const p=await region();return{remove:()=>geo.deleteRegion(p,admin.id),add:()=>catalogue.createPackage(packageInput(p),admin.id),table:"regions",column:"region_id",id:p};}},
    {name:"city/spot",setup:async()=>{const p=(await geo.createCity(cityInput(rootRegion),admin.id)).id;return{remove:()=>geo.deleteCity(p,admin.id),add:()=>geo.createTouristSpot(spotInput(p),admin.id),table:"cities",column:"city_id",id:p};}},
    {name:"spot/package-stop",setup:async()=>{const p=(await geo.createTouristSpot(spotInput(rootCity),admin.id)).id,k=await catalogue.createPackage(packageInput(),admin.id);return{remove:()=>geo.deleteTouristSpot(p,admin.id),add:()=>catalogue.addPackageStop(k.id,{touristSpotId:p,stopOrder:1,nightsHere:0},admin.id),table:"tourist_spots",column:"tourist_spot_id",id:p};}},
    {name:"vehicle-type/vehicle",setup:async()=>{const p=await type();return{remove:()=>fleet.deleteVehicleType(p,admin.id),add:()=>fleet.createVehicle(vehicleInput(p),admin.id),table:"vehicle_types",column:"vehicle_type_id",id:p};}},
    {name:"vehicle-type/package",setup:async()=>{const p=await type();return{remove:()=>fleet.deleteVehicleType(p,admin.id),add:()=>catalogue.createPackage(packageInput(rootRegion,p),admin.id),table:"vehicle_types",column:"vehicle_type_id",id:p};}},
    {name:"vendor/vehicle-assignment",setup:async()=>{const p=await vendors.createVendor({businessName:"Synthetic vendor"},admin.id);assert(p.ok);const k=await fleet.createVehicle(vehicleInput(rootType),admin.id);return{remove:()=>vendors.deleteVendor(p.vendor.id,admin.id),add:()=>fleet.updateVehicle(k.id,{vendorProfileId:p.vendor.id,perKmRate:19},admin.id),table:"vendor_profiles",column:"vendor_profile_id",id:p.vendor.id};}},
  ];
  for(const family of families)for(const deletionFirst of [true,false]){
    const f=await family.setup(),r=await ordered(catalogueLock,[],deletionFirst?[f.remove,f.add]:[f.add,f.remove]);
    if(deletionFirst){assert.equal(value(r[0]),true);assert.equal(r[1].status,"rejected");assert.equal((r[1] as PromiseRejectedResult).reason.code,"23503");}
    else{assert(value(r[0]));assert.equal(r[1].status,"rejected");assert((r[1] as PromiseRejectedResult).reason instanceof DependentRowsError);}
    assert.equal((await pool.query(`SELECT is_deleted FROM ${f.table} WHERE ${f.column}=$1`,[f.id])).rows[0].is_deleted,deletionFirst);
    pass(`${family.name}: ${deletionFirst?"delete-first blocks child":"child-first blocks parent deletion"}`);
  }
  for(const deletionFirst of [true,false]){
    const k=await catalogue.createPackage(packageInput(),admin.id),s=await geo.createTouristSpot(spotInput(rootCity),admin.id);
    const add=()=>catalogue.addPackageStop(k.id,{touristSpotId:s.id,stopOrder:1,nightsHere:0},admin.id),remove=()=>catalogue.deletePackage(k.id,admin.id);
    const r=await ordered(catalogueLock,[],deletionFirst?[remove,add]:[add,remove]);assert.equal(value(r[deletionFirst?0:1]),true);if(deletionFirst)assert.equal(value(r[1]),null);
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM package_stops WHERE package_id=$1 AND NOT is_deleted",[k.id])).rows[0].n,0);
    pass(`package deletion / stop insertion ${deletionFirst?"delete-first":"insert-first"}: no live orphan stops`);
  }
  {
    const r=await region(),c=await geo.createCity(cityInput(rootRegion),admin.id);await geo.deleteRegion(r,admin.id);
    await assert.rejects(geo.updateCity(c.id,{regionId:r},admin.id),(e:any)=>e.code==="23503");
    const deadCity=await geo.createCity(cityInput(rootRegion),admin.id),s=await geo.createTouristSpot(spotInput(rootCity),admin.id);await geo.deleteCity(deadCity.id,admin.id);
    await assert.rejects(geo.updateTouristSpot(s.id,{cityId:deadCity.id},admin.id),(e:any)=>e.code==="23503");
    const t=await type(),v=await fleet.createVehicle(vehicleInput(rootType),admin.id);await fleet.deleteVehicleType(t,admin.id);
    await assert.rejects(fleet.updateVehicle(v.id,{vehicleTypeId:t,perKmRate:19},admin.id),(e:any)=>e.code==="23503");
    const p=await catalogue.createPackage(packageInput(),admin.id);await assert.rejects(catalogue.updatePackage(p.id,{vehicleTypeId:t},admin.id),(e:any)=>e.code==="23503");
    assert(await geo.updateCity(c.id,{regionId:rootRegion,name:"Still editable"},admin.id));
    assert.equal((await fleet.listVehicles()).find(row=>row.id===v.id)?.perKmRate,18);
    pass("reparenting cannot target deleted region/city/type; pricing stays unchanged on rejection");
  }
  {
    const before=(await pool.query("SELECT count(*)::int AS n FROM vehicles WHERE created_by=$1",[admin.id])).rows[0].n;
    await assert.rejects(fleet.createVehicle({...vehicleInput(rootType),perKmRate:-1},admin.id),/greater than zero/);
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM vehicles WHERE created_by=$1",[admin.id])).rows[0].n,before);
    pass("invalid per-car pricing rolls back the vehicle insert atomically");
  }
  {
    const k=await catalogue.createPackage(packageInput(),admin.id),s=await geo.createTouristSpot(spotInput(rootCity),admin.id);await catalogue.addPackageStop(k.id,{touristSpotId:s.id,stopOrder:1,nightsHere:0},admin.id);
    await assert.rejects(intercept(async(sql,_args,run)=>{if(sql.startsWith("UPDATE package_stops SET is_deleted"))throw new Error("injected cascade failure");return run();},()=>catalogue.deletePackage(k.id,admin.id)),/cascade failure/);
    assert.equal((await pool.query("SELECT is_deleted FROM packages WHERE package_id=$1",[k.id])).rows[0].is_deleted,false);
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM package_stops WHERE package_id=$1 AND NOT is_deleted",[k.id])).rows[0].n,1);assert(await catalogue.deletePackage(k.id,admin.id));assert(!await catalogue.deletePackage(k.id,admin.id));
    pass("package/stop deletion is atomic on rollback, releases locks and remains idempotent");
  }
  {
    const u=await user();await seedCap(u,tickets.OPEN_TICKET_LIMIT-1);const r=await ordered("SELECT 1 FROM users WHERE user_id=$1 FOR NO KEY UPDATE",[u.id],[()=>newTicket(u),()=>newTicket(u)]);
    const results=r.map(x=>value<tickets.CreateTicketResult>(x));assert.equal(results.filter(x=>x.ok).length,1);assert(results.some(x=>!x.ok&&x.status===409));assert.equal(await openCount(u),20);
    const closed=(await pool.query("SELECT support_ticket_id FROM support_tickets WHERE user_id=$1 LIMIT 1",[u.id])).rows[0].support_ticket_id;
    assert(await tickets.setTicketStatus(closed,"closed",admin.id));assert((await newTicket(u)).ok);assert.equal(await openCount(u),20);
    pass("concurrent ticket creation at 19/20 has one winner; closing frees exactly one slot");
  }
  {
    const u=await user();await seedCap(u,19);const a=await rawTicket(u,"closed"),b=await rawTicket(u,"resolved");
    const r=await ordered("SELECT 1 FROM users WHERE user_id=$1 FOR NO KEY UPDATE",[u.id],[()=>tickets.setTicketStatus(a,"open",admin.id),()=>tickets.setTicketStatus(b,"pending",admin.id)]);
    assert.equal(r.filter(x=>x.status==="fulfilled").length,1);assert((r.find(x=>x.status==="rejected") as PromiseRejectedResult).reason instanceof tickets.TicketLimitError);assert.equal(await openCount(u),20);
    const resolved=await rawTicket(u,"resolved"),before=mails.length;
    const reply=await tickets.addTicketMessage(resolved,admin,"Would reopen");assert(!reply.ok&&reply.status===409);assert.equal(mails.length,before);
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM support_ticket_messages WHERE support_ticket_id=$1",[resolved])).rows[0].n,0);
    pass("admin reopen and resolved-ticket replies share the cap; losing transitions create no message/email");
  }
  {
    const u=await user(),v=await user(),guard=await pool.connect();let pending:Promise<unknown>|undefined;
    try{await guard.query("BEGIN");await guard.query("SELECT 1 FROM users WHERE user_id=$1 FOR NO KEY UPDATE",[u.id]);pending=newTicket(u);void pending.catch(()=>{});await waiting(1);assert((await newTicket(v)).ok);await guard.query("COMMIT");assert((await pending as tickets.CreateTicketResult).ok);}finally{await guard.query("ROLLBACK");guard.release();await pending?.catch(()=>{});}
    const deleted=await user();const r=await ordered("SELECT 1 FROM users WHERE user_id=$1 FOR UPDATE",[deleted.id],[()=>deleteAccount(deleted.id),()=>newTicket(deleted)]);assert(value(r[0]));const result=value<tickets.CreateTicketResult>(r[1]);assert(!result.ok&&result.status===401);assert.equal(await openCount(deleted),0);
    pass("ticket caps are per owner; in-flight creation cannot recreate a ticket after account deletion");
  }
  {
    const u=await user(),existing=await rawTicket(u),ref=(await pool.query("SELECT reference FROM support_tickets WHERE support_ticket_id=$1",[existing])).rows[0].reference;let once=false;
    const r=await intercept(async(sql,args,run)=>{if(!once&&sql.startsWith("INSERT INTO support_tickets")){once=true;(args[0] as unknown[])[0]=ref;}return run();},()=>newTicket(u));assert(r.ok);assert.notEqual(r.ticket.reference,ref);
    const count=await openCount(u);await assert.rejects(intercept(async(sql,_args,run)=>{if(sql.startsWith("INSERT INTO support_ticket_messages"))throw new Error("injected ticket failure");return run();},()=>newTicket(u)),/ticket failure/);assert.equal(await openCount(u),count);assert((await newTicket(u)).ok);
    pass("reference collision retries without aborting the transaction; failed first message rolls back ticket and capacity");
  }
  {
    const v=await vendors.createVendor({businessName:"Synthetic guarded vendor"},admin.id);assert(v.ok);const vehicle=await fleet.createVehicle(vehicleInput(rootType),admin.id);await fleet.updateVehicle(vehicle.id,{vendorProfileId:v.vendor.id},admin.id);
    const http=route("src/lib/server/api-errors.ts",{"./db-errors":dbErrors});
    const vendorRoute=route("src/app/api/admin/vendors/[id]/route.ts",{"@/lib/server/auth-guard":{requireRole:async()=>({ok:true,user:admin})},"@/lib/server/admin/vendors":vendors,"@/lib/server/api-errors":http});
    assert.equal((await vendorRoute.DELETE(new Request("http://localhost/api/admin/vendors"),{params:{id:String(v.vendor.id)}})).status,409);
    const u=await user();await seedCap(u,20);const id=await rawTicket(u,"resolved");
    const supportRoute=route("src/app/api/admin/support-tickets/[id]/route.ts",{"@/lib/server/auth-guard":{requireRole:async()=>({ok:true,user:admin})},"@/lib/server/support-tickets":tickets,"@/lib/server/http-json":await import("../../src/lib/server/http-json.ts"),"@/lib/server/request-origin":await import("../../src/lib/server/request-origin.ts")});
    const response=await supportRoute.PATCH(new Request("http://localhost/api/admin/support-tickets",{method:"PATCH",headers:{origin:"http://localhost","content-type":"application/json"},body:JSON.stringify({status:"open"})}),{params:{id}});assert.equal(response.status,409);
    pass("real vendor-delete and ticket-reopen routes return deliberate409 responses for parent/cap conflicts");
  }
  for(const reopenFirst of [true,false]){
    const u=await user();await seedCap(u,19);const id=await rawTicket(u,"closed"),open=()=>tickets.setTicketStatus(id,"open",admin.id),create=()=>newTicket(u);
    const r=await ordered("SELECT 1 FROM users WHERE user_id=$1 FOR NO KEY UPDATE",[u.id],reopenFirst?[open,create]:[create,open]);
    if(reopenFirst){assert(value(r[0]));const x=value<tickets.CreateTicketResult>(r[1]);assert(!x.ok&&x.status===409);}else{assert(value<tickets.CreateTicketResult>(r[0]).ok);assert((r[1] as PromiseRejectedResult).reason instanceof tickets.TicketLimitError);}
    assert.equal(await openCount(u),20);pass(`mixed create/reopen ${reopenFirst?"reopen-first":"create-first"} shares the last ticket slot`);
  }
  {
    const other=await user("admin"),a=await rawTicket(admin),b=await rawTicket(other);let locked=0,release=()=>{};const barrier=new Promise<void>(r=>{release=r;});
    const r=await intercept(async(sql,_args,run)=>{const result=await run();if(sql.includes("FOR NO KEY UPDATE")){locked++;if(locked===2)release();await barrier;}return result;},()=>Promise.all([tickets.addTicketMessage(a,other,"Other administrator reply"),tickets.addTicketMessage(b,admin,"Root administrator reply")]));assert(r.every(x=>x.ok));
    pass("two administrators replying across each other's tickets do not deadlock on author foreign keys");
  }
  {
    const id=await rawTicket(customer),n=mails.length;
    await afterCommit(async()=>{assert((await tickets.addTicketMessage(id,admin,"Second staff event")).ok);},()=>tickets.addTicketMessage(id,admin,"First staff event"));
    const sent=mails.slice(n);assert.equal(sent.length,2);assert.equal(sent.filter(m=>text(m).includes("First staff event")).length,1);assert.equal(sent.filter(m=>text(m).includes("Second staff event")).length,1);
    pass("two staff replies committing before first delivery each send their own message snapshot exactly once");
  }
  {
    const id=await rawTicket(customer),ref=(await pool.query("SELECT reference FROM support_tickets WHERE support_ticket_id=$1",[id])).rows[0].reference,n=mails.length;
    await afterCommit(async()=>{await pool.query("INSERT INTO support_ticket_messages(support_ticket_id,author_user_id,author_role,body) VALUES($1,$2,'customer','Later private customer message')",[id,customer.id]);await pool.query("UPDATE support_tickets SET subject='Later subject' WHERE support_ticket_id=$1",[id]);},()=>tickets.addTicketMessage(id,admin,"Exact staff reply"));
    assert.equal(mails.length,n+1);assert(text(mails[n]).includes("Exact staff reply"));assert(!text(mails[n]).includes("Later private customer message"));assert(String(mails[n].subject).includes("Original subject"));assert(String(mails[n].subject).includes(ref));
    pass("support email retains triggering staff body, subject and reference after later customer/message metadata changes");
  }
  {
    await pool.query("INSERT INTO pricing_rules(booking_type_id,vehicle_type_id,name,base_amount,created_by,updated_by) VALUES($1,$2,'Synthetic notification price',1000,$3,$3)",[bookingType,rootType,admin.id]);
    const n=mails.length;
    const result=await afterCommit(async()=>{const row=(await pool.query("SELECT booking_id FROM bookings WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1",[customer.id])).rows[0];await pool.query("UPDATE bookings SET total_amount=9999,passenger_count=7,status='Confirmed',driver_id=$2 WHERE booking_id=$1",[row.booking_id,driverB]);await pool.query("UPDATE users SET email=$2 WHERE user_id=$1",[customer.id,`late-${customer.id}@example.invalid`]);},()=>createBooking({bookingType:"point_to_point",vehicleTypeId:rootType,startDateTime:"2099-01-01T10:00:00Z",estimatedDistanceKm:10,routeId,pickupPoint,dropPoint},customer));
    assert(result.ok);bookingIds.push(result.bookingId);assert.equal(mails.length,n+1);assert.equal(mails[n].to,customer.email);assert(text(mails[n]).includes("₹1,000"));assert(!text(mails[n]).includes("₹9,999"));assert(!text(mails[n]).includes("Replacement driver"));await pool.query("UPDATE users SET email=$2 WHERE user_id=$1",[customer.id,customer.email]);
    pass("initial booking email snapshots original amount, passengers, recipient and driver visibility before later confirmation/edit");
  }
  {
    const id=await booking(),n=mails.length;
    assert((await afterCommit(async()=>{await pool.query("UPDATE bookings SET status='Cancelled',total_amount=9999,driver_id=$2 WHERE booking_id=$1",[id,driverB]);},()=>transitionBooking({bookingId:id,toStatus:"Confirmed",user:admin}))).ok);
    assert.equal(mails.length,n+1);assert(String(mails[n].subject).startsWith("Booking confirmed"));assert(text(mails[n]).includes("Original driver"));assert(!text(mails[n]).includes("Replacement driver"));
    pass("confirmation notification retains committed status and driver after a newer cancellation/reassignment");
  }
  {
    const id=await booking("Confirmed"),n=mails.length;
    assert((await afterCommit(async()=>{await pool.query("UPDATE refunds SET amount=0,status='waived' WHERE booking_id=$1",[id]);await pool.query("UPDATE bookings SET status='Refunded',driver_id=$2 WHERE booking_id=$1",[id,driverB]);},()=>transitionBooking({bookingId:id,toStatus:"Cancelled",user:admin}))).ok);
    assert.equal(mails.length,n+1);assert(text(mails[n]).includes("A refund of ₹1,000 is being processed."));assert(!text(mails[n]).includes("Replacement driver"));assert(!text(mails[n]).includes("Original driver"));
    pass("cancellation captures its refund note and hides driver details despite later refund settlement/status changes");
  }
  {
    const id=await booking("Confirmed",null),n=mails.length;
    assert((await afterCommit(async()=>{await pool.query("UPDATE bookings SET driver_id=$2 WHERE booking_id=$1",[id,driverB]);},()=>assignBookingDriver(id,driverA,admin.id))).ok);
    assert.equal(mails.length,n+1);assert(text(mails[n]).includes("Original driver"));assert(!text(mails[n]).includes("Replacement driver"));
    pass("driver assignment email uses the driver assigned by its event, not a later assignment");
  }
  {
    const id=await booking(),n=mails.length;await assert.rejects(intercept(async(sql,_args,run)=>{if(sql==="COMMIT")throw new Error("injected pre-commit failure");return run();},()=>transitionBooking({bookingId:id,toStatus:"Confirmed",user:admin})),/pre-commit failure/);assert.equal(mails.length,n);assert.equal((await pool.query("SELECT status FROM bookings WHERE booking_id=$1",[id])).rows[0].status,"PendingPayment");
    failMail=true;assert((await transitionBooking({bookingId:id,toStatus:"Confirmed",user:admin})).ok);failMail=false;
    assert.equal((await pool.query("SELECT status FROM notifications WHERE booking_id=$1",[id])).rows[0].status,"failed");assert.equal((await pool.query("SELECT status FROM bookings WHERE booking_id=$1",[id])).rows[0].status,"Confirmed");
    pass("rollback sends no event; transport failure cannot undo committed booking and is logged failed");
  }
  console.log(`PASS ${checks} catalogue/ticket/notification race groups; ${mails.length} emails captured in memory.`);
}finally{
  failMail=false;
  try{
    await pool.query("DELETE FROM map_service_cache WHERE cache_key=$1",[routeId]);
      assert.equal((await pool.query("SELECT count(*)::int AS n FROM map_service_cache WHERE cache_key=$1",[routeId])).rows[0].n,0);
    await pool.query("DELETE FROM notifications WHERE user_id=ANY($1::uuid[])",[userIds]);
    await pool.query("DELETE FROM activity_logs WHERE user_id=ANY($1::uuid[])",[userIds]);
    await pool.query("DELETE FROM support_tickets WHERE user_id=ANY($1::uuid[])",[userIds]);
    await pool.query("DELETE FROM bookings WHERE user_id=ANY($1::uuid[])",[userIds]);
    for(const table of ["package_stops","packages","tourist_spots","cities","vehicle_images","vehicle_availability","pricing_rules","vehicles","vehicle_types","regions","vendor_profiles","drivers"]){await pool.query(`DELETE FROM ${table} WHERE created_by=$1`,[admin?.id??null]);}
    await pool.query("DELETE FROM users WHERE user_id=ANY($1::uuid[])",[userIds]);
    assert.equal(Number((await pool.query("SELECT (SELECT count(*) FROM users WHERE user_id=ANY($1::uuid[]))+(SELECT count(*) FROM bookings WHERE user_id=ANY($1::uuid[]))+(SELECT count(*) FROM support_tickets WHERE user_id=ANY($1::uuid[])) AS n",[userIds])).rows[0].n),0);
    console.log("Synthetic development fixtures removed and absence verified; no production access or external messages.");
  }finally{nodemailer.createTransport=transport;await app.end();await pool.end();}
}

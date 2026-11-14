/** Real Chrome -> API -> DEVELOPMENT DB journey; provider responses and SMTP are loopback-only. */
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { execFileSync, fork } from "node:child_process";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { mkdir, realpath, lstat, unlink, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import pg from "pg";
import { isContactMailbox } from "../../src/lib/contact";
import { runtimeDatabaseConfig } from "../../src/lib/server/db-config";
import { localMailSink } from "./_local-smtp.mjs";

assert(process.argv.includes("--dev")&&!process.env.VERCEL,"Development only");
assert.equal(execFileSync("git",["-c","safe.directory=C:/my/projects/Travel_Agent","branch","--show-current"],{encoding:"utf8"}).trim(),"development");
const owner=process.env.DATABASE_URL!,runtime=process.env.DATABASE_URL_APP??owner,production=process.env.DATABASE_URL_PRODUCTION!;
const host=(s:string)=>new URL(s).hostname.replace(/-pooler\./,".");
assert(owner&&runtime&&production);assert.equal(host(owner),host(runtime));assert.notEqual(host(owner),host(production));
const modulePath=process.argv.find(s=>s.startsWith("--browser-module="))?.slice(17);assert(modulePath);
const {chromium}=createRequire(import.meta.url)(modulePath);
const artifacts=process.argv.find(s=>s.startsWith("--artifacts="))?.slice(12);
const pool=new pg.Pool({...runtimeDatabaseConfig(owner),max:4});
const tag=randomUUID(),ids=[randomUUID(),randomUUID()],tokens=[randomUUID(),randomUUID()];
const emails=ids.map(id=>`car-${id}@example.invalid`),base="http://127.0.0.1:3103";
let vehicleType:number|undefined,vehicle:number|undefined,child:ReturnType<typeof fork>|undefined,browser:{close():Promise<void>}|undefined,sandbox:string|undefined;
let sink:Awaited<ReturnType<typeof localMailSink>>|undefined,log="",checks=0;
let capturePage:{screenshot(options:{path:string;fullPage:boolean}):Promise<unknown>}|undefined;
const providerKeys=new Set<string>();
const hash=(value:string)=>createHash("sha256").update(value).digest("hex");
providerKeys.add(hash(`nominatim:search:https://geocode-acceptance.invalid:pickup test ${tag}`));
providerKeys.add(hash(`nominatim:search:https://geocode-acceptance.invalid:destination test ${tag}`));
providerKeys.add(hash("fossgis:https://car-acceptance.invalid:77.2295,28.6129;77.241,28.6562"));
const providerRequests:{kind:string;path:string}[]=[];
const provider=createServer((req,res)=>{
  const url=new URL(req.url!,"http://127.0.0.1");res.setHeader("Content-Type","application/json");
  if(url.pathname==="/search"){
    providerRequests.push({kind:"search",path:url.pathname});
    const drop=url.searchParams.get("q")?.toLowerCase().includes("destination");
    res.end(JSON.stringify([{lat:drop?"28.65620":"28.61290",lon:drop?"77.24100":"77.22950",display_name:drop?"Destination test landmark, Delhi, India":"Pickup test landmark, Delhi, India",address:{city:"Delhi",state:"Delhi"}}]));
  }else if(url.pathname.includes("/route/v1/")){
    providerRequests.push({kind:"route",path:url.pathname});
    const coordinates=url.pathname.split("/").at(-1)!.split(";").map(p=>p.split(",").map(Number));
    res.end(JSON.stringify({code:"Ok",routes:[{distance:coordinates.length===3?26000:12340,duration:coordinates.length===3?7200:3600,geometry:{coordinates}}],waypoints:coordinates.map(()=>({distance:1}))}));
  }else{res.statusCode=404;res.end("{}");}
});
async function api(route:string,body?:unknown,who=0,method="POST"){
  return fetch(base+route,{method,redirect:"manual",signal:AbortSignal.timeout(90000),headers:{Origin:base,"Content-Type":"application/json",Cookie:`session_token=${tokens[who]}`},...(body===undefined?{}:{body:JSON.stringify(body)})});
}
async function expectStatus(response:Promise<Response>,status:number,label:string){const r=await response;assert.equal(r.status,status,`${label}: ${await r.clone().text()}`);checks++;return r;}
async function waitBudget(providerName:string){const state=(await pool.query("SELECT EXTRACT(EPOCH FROM(clock_timestamp()-last_request_at))*1000 AS gap FROM map_service_usage WHERE provider=$1",[providerName])).rows[0];if(state&&Number(state.gap)<1150)await new Promise(r=>setTimeout(r,1150-Number(state.gap)));}
try{
  for(let i=0;i<ids.length;i++){
    await pool.query("INSERT INTO users(user_id,name,email,phone,password_hash,email_verified_at,role_id) VALUES($1,$2,$3,'9999999999','unusable-test-hash',now(),(SELECT role_id FROM roles WHERE name=$4))",[ids[i],`Car booking ${tag}`,emails[i],i?"admin":"customer"]);
    await pool.query("INSERT INTO sessions(token,user_id,expires_at) VALUES($1,$2,now()+interval '2 hours')",[tokens[i],ids[i]]);
  }
  vehicleType=(await pool.query("INSERT INTO vehicle_types(slug,title) VALUES($1,$2) RETURNING vehicle_type_id",[`car-${tag}`,`Car acceptance ${tag}`])).rows[0].vehicle_type_id;
  const configuredInbox=String((await pool.query("SELECT setting_value FROM site_settings WHERE setting_key='contact_email'")).rows[0]?.setting_value??"").trim();
  sink=await localMailSink([...emails,...(isContactMailbox(configuredInbox)?[configuredInbox]:[])]);await new Promise<void>(resolve=>provider.listen(0,"127.0.0.1",resolve));
  const address=provider.address();assert(address&&typeof address!=="string");
  const preload=path.resolve("db/tests/_car-map-provider.cjs").replaceAll("\\","/");
  child=fork(path.resolve("db/tests/_booking-server.cjs"),[],{execArgv:[],silent:true,windowsHide:true,env:{...process.env,
    NODE_OPTIONS:`${process.env.NODE_OPTIONS??""} --require=${preload}`,DATABASE_URL_PRODUCTION:undefined,VERCEL_ENV:undefined,DATABASE_URL:runtime,
    BOOKING_SMOKE_SERVER:"dev-only",BOOKING_SMOKE_BUILD:process.argv.includes("--built")?"1":"0",NODE_ENV:process.argv.includes("--built")?"production":"development",APP_ORIGIN:base,
    BOOKING_ROUTING_ORIGIN:"https://car-acceptance.invalid",BOOKING_GEOCODE_ORIGIN:"https://geocode-acceptance.invalid",
    CAR_BOOKING_MAP_STUB_URL:`http://127.0.0.1:${address.port}`,SMTP_HOST:"127.0.0.1",SMTP_PORT:String(sink.port),SMTP_USER:"test",SMTP_PASS:"test",EMAIL_FROM:"Car acceptance <test@example.invalid>"}});
  for(const stream of[child.stdout,child.stderr])stream?.on("data",chunk=>{log=(log+chunk.toString()).slice(-10000);});
  await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error("Server startup timed out")),process.argv.includes("--built")?600000:120000);child!.on("message",(m:{ready?:boolean;sandbox?:string})=>{if(m.sandbox)sandbox=m.sandbox;if(m.ready){clearTimeout(timer);resolve();}});child!.once("exit",code=>{clearTimeout(timer);reject(Error(`Server exited ${code}`));});});
  console.log("Isolated car booking server ready; no real provider or SMTP delivery.");
  await expectStatus(api("/api/admin/pricing-rules",undefined,0,"GET"),403,"Customer cannot edit prices");
  const instance=await chromium.launch({channel:"chrome",headless:true});browser=instance;
  const adminContext=await instance.newContext({viewport:{width:1280,height:900},timezoneId:"Asia/Kolkata"});
  await adminContext.addCookies([{name:"session_token",value:tokens[1],url:base}]);
  const adminPage=await adminContext.newPage();
  capturePage=adminPage;
  await adminPage.goto(base+"/admin/vehicles",{waitUntil:"networkidle",timeout:90000});
  await adminPage.getByRole("button",{name:"Vehicles",exact:true}).click();
  await adminPage.getByRole("button",{name:"Add Vehicle",exact:true}).click();
  const vehicleEditor=adminPage.getByRole("dialog");
  await vehicleEditor.getByLabel("Name",{exact:true}).fill(`Booking test car ${tag}`);
  await vehicleEditor.getByLabel("Vehicle Type",{exact:true}).selectOption(String(vehicleType));
  await vehicleEditor.getByLabel("Seating Capacity",{exact:true}).fill("4");
  await vehicleEditor.getByLabel("Price / Day (₹)",{exact:true}).fill("2000");
  await vehicleEditor.getByLabel("Price / km (₹)",{exact:true}).fill("18");
  if(artifacts){await mkdir(artifacts,{recursive:true});await adminPage.screenshot({path:path.join(artifacts,"vehicle-add-per-km.png"),fullPage:true});}
  const createdPromise=adminPage.waitForResponse((r:{url():string;request():{method():string}})=>r.url()===base+"/api/admin/vehicles"&&r.request().method()==="POST");
  await vehicleEditor.getByRole("button",{name:"Add vehicle",exact:true}).click();
  const created=await createdPromise;assert.equal(created.status(),201,await created.text());checks++;
  vehicle=(await created.json()).item.id;
  await vehicleEditor.waitFor({state:"hidden"});
  assert.equal(Number((await pool.query("SELECT count(*) AS n FROM pricing_rules WHERE vehicle_id=$1 AND per_km_rate=18",[vehicle])).rows[0].n),3);
  const pricing=(await(await expectStatus(api("/api/admin/pricing-rules",undefined,1,"GET"),200,"Load pricing editor")).json()).rules;
  const rule=pricing.find((r:{vehicleId:number;bookingType:string})=>r.vehicleId===vehicle&&r.bookingType==="point_to_point");assert(rule);
  await expectStatus(api("/api/admin/pricing-rules",{...rule,baseAmount:100,minKm:10,taxPercent:5},1),200,"Set car-specific optional charges");
  const context=await instance.newContext({viewport:{width:1280,height:900},timezoneId:"America/New_York"});
  await context.addCookies([{name:"session_token",value:tokens[0],url:base}]);
  const page=await context.newPage(),errors:string[]=[];page.on("pageerror",(error:Error)=>errors.push(error.message));
  capturePage=page;
  // Prevent automated tile crawling. Provider/attribution UI still renders normally.
  await page.route("https://tile.openstreetmap.org/**",(route:{fulfill(p:unknown):Promise<void>})=>route.fulfill({status:200,contentType:"image/png",body:Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j4l8AAAAASUVORK5CYII=","base64")}));
  await page.goto(`${base}/booking/new?vehicle=${vehicle}`,{waitUntil:"networkidle",timeout:90000});
  await page.getByRole("button",{name:"Start date & time",exact:true}).click();
  const dialog=page.getByRole("dialog");await dialog.getByLabel("Hour",{exact:true}).selectOption("10");await dialog.getByLabel("Minute",{exact:true}).selectOption("30");
  await dialog.getByLabel("AM / PM",{exact:true}).selectOption("AM");
  const future=await page.evaluate(()=>{const d=new Date(Date.now()+2*24*60*60*1000);return d.toLocaleDateString("en-IN",{timeZone:"Asia/Kolkata",day:"numeric",month:"long",year:"numeric"});});
  // The two-day target may be in the next calendar month.
  if(!await dialog.getByRole("button",{name:future,exact:true}).count())await dialog.getByRole("button",{name:"Next month",exact:true}).click();
  await dialog.getByRole("button",{name:future,exact:true}).click();await dialog.getByRole("button",{name:"Use this date & time",exact:true}).click();
  await page.getByLabel("Pickup location",{exact:true}).fill(`Pickup test ${tag}`);await waitBudget("nominatim");
  await page.getByRole("button",{name:"Search pickup",exact:true}).click();await page.getByRole("button",{name:"Pickup test landmark, Delhi, India",exact:true}).click();
  await page.getByLabel("Destination location",{exact:true}).fill(`Destination test ${tag}`);await waitBudget("nominatim");
  await page.getByRole("button",{name:"Search destination",exact:true}).click();await page.getByRole("button",{name:"Destination test landmark, Delhi, India",exact:true}).click();
  await page.getByRole("status").filter({hasText:"12.34 km by road"}).waitFor({timeout:90000});
  await page.getByText("₹338.23",{exact:true}).waitFor({timeout:90000});
  assert.equal(await page.getByLabel("Distance (km)",{exact:true}).getAttribute("readonly"),"");
  await page.getByRole("button",{name:"Choose on map (optional)",exact:true}).click();await page.locator(".leaflet-container").waitFor();
  if(artifacts){await mkdir(artifacts,{recursive:true});await page.screenshot({path:path.join(artifacts,"car-quote-desktop.png"),fullPage:true});await page.setViewportSize({width:390,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false);await page.screenshot({path:path.join(artifacts,"car-quote-mobile.png"),fullPage:true});await page.setViewportSize({width:1280,height:900});}
  let submitted:Record<string,unknown>|undefined;
  page.on("request",(request:{url():string;method():string;postDataJSON():Record<string,unknown>})=>{if(request.url()===`${base}/api/bookings`&&request.method()==="POST")submitted=request.postDataJSON();});
  const responsePromise=page.waitForResponse((r:{url():string;request():{method():string}})=>r.url()===`${base}/api/bookings`&&r.request().method()==="POST");
  await page.getByRole("button",{name:"Confirm booking",exact:true}).click();const booked=await responsePromise;assert.equal(booked.status(),201,await booked.text());checks++;
  const booking=(await booked.json()).booking;await page.waitForURL(`${base}/booking/${booking.id}/confirm`,{timeout:90000});
  assert(submitted);providerKeys.add(String(submitted.routeId));
  const stored=(await pool.query("SELECT * FROM bookings WHERE booking_id=$1 AND user_id=$2",[booking.id,ids[0]])).rows[0];
  assert.equal(stored.status,"PendingPayment");assert.equal(Number(stored.total_amount),338.23);assert.equal(Number(stored.estimated_distance_km),12.34);
  assert.equal(new Date(stored.start_datetime).getUTCHours(),5);assert.equal(new Date(stored.start_datetime).getUTCMinutes(),0,"10:30 IST is 05:00 UTC even on an overseas device");
  assert.equal(stored.price_breakdown.route.pickup.lat,28.6129);assert.equal(stored.price_breakdown.route.provider,"fossgis");
  assert.equal(stored.pickup_address,"Pickup test landmark, Delhi, India");assert.equal(stored.drop_address,"Destination test landmark, Delhi, India");
  assert.equal((await pool.query("SELECT count(*)::int n FROM booking_status_history WHERE booking_id=$1",[booking.id])).rows[0].n,1);
  console.log("PASS custom date/time, explicit place search, optional map, automatic km, car-specific quote, saved booking/route/fare and mobile layout.");
  const quote={bookingType:"point_to_point",vehicleId:vehicle,vehicleTypeId:vehicleType,passengers:2,routeId:submitted.routeId,pickupPoint:submitted.pickupPoint,dropPoint:submitted.dropPoint,distanceKm:0.01};
  const tampered=(await(await expectStatus(api("/api/quotes",quote),200,"Client distance is ignored")).json()).quote;assert.equal(tampered.totalAmount,338.23);
  await expectStatus(api("/api/quotes",{...quote,routeId:"f".repeat(64)}),422,"Unknown route rejected");
  await expectStatus(api("/api/quotes",{...quote,dropPoint:{lat:0,lng:0}}),422,"Altered drop rejected");
  await expectStatus(api("/api/quotes",{...quote,passengers:9}),400,"Capacity enforced");
  await expectStatus(api("/api/quotes",{...quote,vehicleTypeId:2147483647}),400,"Car/type tampering rejected");
  await expectStatus(api("/api/bookings",{...submitted,routeId:undefined,estimatedDistanceKm:0.01}),400,"No manual-distance bypass");
  await expectStatus(api("/api/bookings",{...submitted,startDateTime:"2000-01-01T10:00:00Z"}),400,"Past booking rejected");
  await expectStatus(api("/api/admin/vehicles/"+vehicle,{perKmRate:19},1,"PATCH"),200,"Fleet edit updates per-km prices");
  await expectStatus(api("/api/bookings",submitted),409,"Changed fare must be reviewed");
  assert.equal(Number((await pool.query("SELECT total_amount FROM bookings WHERE booking_id=$1",[booking.id])).rows[0].total_amount),338.23,"Existing price is immutable");
  await expectStatus(api("/api/admin/bookings/"+booking.id,{status:"Confirmed"},1,"PATCH"),200,"Admin confirms offline payment");
  const refreshed=(await(await api("/api/quotes",quote)).json()).quote;
  await expectStatus(api("/api/bookings",{...submitted,expectedTotal:refreshed.totalAmount}),409,"Overlapping confirmed vehicle rejected");
  assert.deepEqual(errors,[]);assert.deepEqual(sink.rejected,[]);assert(sink.messages.length>=2);
  console.log(`PASS ${checks} HTTP checks plus real browser/DB assertions; ${sink.messages.length} local emails, ${providerRequests.length} loopback map responses. No real provider calls.`);
}catch(error){if(artifacts&&capturePage){await mkdir(artifacts,{recursive:true});await capturePage.screenshot({path:path.join(artifacts,"failure.png"),fullPage:true}).catch(()=>{});}console.error("Isolated server tail:",log.replace(/postgres(?:ql)?:\/\/\S+/g,"[database URL]"));throw error;}
finally{
  await browser?.close();
  if(child&&child.exitCode===null)await new Promise<void>(resolve=>{const timer=setTimeout(()=>{child?.kill();resolve();},20000);child!.once("exit",()=>{clearTimeout(timer);resolve();});if(child!.connected)child!.send("stop");else child!.kill();});
  await sink?.close();await new Promise<void>(resolve=>provider.close(()=>resolve()));
  try{
    const bookings=(await pool.query("SELECT booking_id FROM bookings WHERE user_id=ANY($1::uuid[])",[ids])).rows.map(r=>r.booking_id);
    for(const table of["notifications","activity_logs"])await pool.query(`DELETE FROM ${table} WHERE user_id=ANY($1::uuid[])${table==="notifications"?" OR booking_id=ANY($2::uuid[])":""}`,table==="notifications"?[ids,bookings]:[ids]);
    await pool.query("DELETE FROM vehicle_availability WHERE booking_id=ANY($1::uuid[])",[bookings]);
    await pool.query("DELETE FROM bookings WHERE user_id=ANY($1::uuid[])",[ids]);
    if(vehicle)await pool.query("DELETE FROM pricing_rules WHERE vehicle_id=$1",[vehicle]);
    if(vehicleType)await pool.query("DELETE FROM vehicles WHERE vehicle_type_id=$1",[vehicleType]);
    if(vehicleType)await pool.query("DELETE FROM vehicle_types WHERE vehicle_type_id=$1",[vehicleType]);
    await pool.query("DELETE FROM users WHERE user_id=ANY($1::uuid[]) AND email=ANY($2::text[])",[ids,emails]);
    // Remove only cache entries generated by this test's unique search text or collected route IDs.
    if(providerKeys.size)await pool.query("DELETE FROM map_service_cache WHERE cache_key=ANY($1::text[])",[[...providerKeys]]);
    assert.equal(Number((await pool.query("SELECT count(*) n FROM users WHERE user_id=ANY($1::uuid[])",[ids])).rows[0].n),0);
    assert.equal(Number((await pool.query("SELECT count(*) n FROM bookings WHERE user_id=ANY($1::uuid[])",[ids])).rows[0].n),0);
    console.log("Synthetic car/customer/admin/booking/rate fixtures removed; absence verified.");
  }finally{await pool.end();}
  if(sandbox){const resolved=await realpath(sandbox),temp=await realpath(os.tmpdir());assert.equal(path.dirname(resolved),temp);assert(path.basename(resolved).startsWith("travel-booking-acceptance-"));
    const deps=path.join(resolved,"node_modules"),link=await lstat(deps).catch(()=>null);if(link){assert(link.isSymbolicLink());assert.equal(await realpath(deps),await realpath("node_modules"));await unlink(deps);}await rm(resolved,{recursive:true,force:true});}
}

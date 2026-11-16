import test from "node:test";
import assert from "node:assert/strict";
import { cachedMapRequest, calculateBookingRoute, verifiedBookingRoute, searchMapPlaces, suggestMapPlaces, MapServiceError } from "../../src/lib/server/map-services";
import { routePoint } from "../../src/lib/booking-route";
import {bookingInstant,bookingTimeValue,validBookingTime} from "../../src/lib/booking-datetime";

const globals=globalThis as unknown as {__pgPool:unknown};
function fakeDb(options:{count?:number;gap?:number;today?:boolean;locked?:boolean;failCache?:boolean;failCommit?:boolean}={}){
  const state={count:options.count??0,cache:new Map<string,unknown>(),queries:[] as string[]};
  let pending=state.count;
  const client={release(){},async query(sql:string,values:unknown[]=[]):Promise<{rows:Record<string,unknown>[]}>{
    state.queries.push(sql);
    if(sql==="BEGIN"){pending=state.count;return{rows:[]};}
    if(sql==="COMMIT"){state.count=pending;if(options.failCommit)throw new Error("lost commit acknowledgement");return{rows:[]};}
    if(sql==="ROLLBACK"){pending=state.count;return{rows:[]};}
    if(sql.includes("pg_try_advisory"))return{rows:[{locked:options.locked!==false}]};
    if(sql.startsWith("SELECT request_count"))return{rows:[{request_count:pending,today:options.today!==false,gap:options.gap??2000}]};
    if(sql.startsWith("UPDATE map_service_usage")){pending=options.today===false?1:pending+1;return{rows:[]};}
    if(sql.startsWith("SELECT response")){const response=state.cache.get(String(values[0]));return{rows:response?[{response}]:[]};}
    if(sql.startsWith("INSERT INTO map_service_cache")){if(options.failCache)throw new Error("cache write failed");state.cache.set(String(values[0]),JSON.parse(String(values[2])));}
    return{rows:[]};
  }};
  return{state,pool:{query:client.query,connect:async()=>client}};
}
async function withDb(options:Parameters<typeof fakeDb>[0],work:(db:ReturnType<typeof fakeDb>)=>Promise<void>){const old=globals.__pgPool;const db=fakeDb(options);globals.__pgPool=db.pool;try{await work(db);}finally{globals.__pgPool=old;}}
const a={lat:28.61291,lng:77.22951},b={lat:28.65621,lng:77.24101};
test("pickup clocks use IST and reject invalid calendar dates",()=>{
  assert.equal(bookingInstant("2026-11-21T17:24").toISOString(),"2026-11-21T11:54:00.000Z");
  assert.equal(bookingTimeValue(new Date("2026-11-21T11:54:00Z")),"2026-11-21T17:24");
  assert(validBookingTime("2028-02-29T12:00"));
  for(const value of["2026-02-29T12:00","2026-02-30T12:00","2026-11-21T24:00","invalid"])assert.equal(validBookingTime(value),false);
});

test("coordinate validation rejects coercion and bounds; normalizes pins",()=>{
  for(const point of [null,[],{lat:"28",lng:77},{lat:91,lng:77},{lat:0,lng:Infinity}])assert.equal(routePoint(point),null);
  assert.deepEqual(routePoint({lat:28.123456,lng:77.654321}),{lat:28.12346,lng:77.65432});
});
test("cache hit uses no upstream call or allowance",()=>withDb({},async db=>{db.state.cache.set("key",{distance:42});assert.deepEqual(await cachedMapRequest("fossgis","key",async()=>{throw Error("must not fetch");}),{distance:42});assert.equal(db.state.count,0);}));
test("successful provider fetch plus failed cache write still consumes durable allowance",()=>withDb({failCache:true},async db=>{let calls=0;await assert.rejects(cachedMapRequest("fossgis","key",async()=>{calls++;assert.equal(db.state.count,1,"reservation must commit before fetch");return{distance:42};}));assert.equal(calls,1);assert.equal(db.state.count,1);}));
test("provider failure consumes allowance",()=>withDb({},async db=>{await assert.rejects(cachedMapRequest("fossgis","key",async()=>{throw Error("provider down");}));assert.equal(db.state.count,1);}));
test("uncertain reservation commit never contacts provider",()=>withDb({failCommit:true},async db=>{let calls=0;await assert.rejects(cachedMapRequest("fossgis","key",async()=>{calls++;return{};}));assert.equal(calls,0);assert.equal(db.state.count,1);}));
test("global daily limit, request spacing and contention fail closed",async t=>{
  for(const options of [{count:200},{gap:100},{locked:false}])await t.test(JSON.stringify(options),()=>withDb(options,async db=>{let calls=0;await assert.rejects(cachedMapRequest("nominatim","key",async()=>{calls++;return[];}),error=>error instanceof MapServiceError&&error.status===429);assert.equal(calls,0);assert.equal(db.state.count,options.count??0);}));
});
test("UTC day rollover resets usage to one",()=>withDb({count:200,today:false},async db=>{await cachedMapRequest("nominatim","key",async()=>[]);assert.equal(db.state.count,1);}));
test("map kill switch prevents database/provider access",async()=>{const previous=process.env.BOOKING_MAPS_DISABLED;process.env.BOOKING_MAPS_DISABLED="true";try{await assert.rejects(cachedMapRequest("fossgis","key",async()=>{throw Error("should not fetch");}),MapServiceError);}finally{if(previous===undefined)delete process.env.BOOKING_MAPS_DISABLED;else process.env.BOOKING_MAPS_DISABLED=previous;}});
test("route uses actual road distance, includes return leg, and verifies trusted cache",()=>withDb({},async db=>{
  const old=globalThis.fetch;let path="";
  globalThis.fetch=async input=>{path=String(input);return Response.json({code:"Ok",routes:[{distance:26432,duration:7234,geometry:{coordinates:[[a.lng,a.lat],[b.lng,b.lat],[a.lng,a.lat]]}}],waypoints:[{distance:1},{distance:2},{distance:1}]});};
  try{const route=await calculateBookingRoute(a,b,true);assert.equal(route.distanceKm,26.44);assert.equal(route.roundTrip,true);assert(path.includes(`${a.lng},${a.lat};${b.lng},${b.lat};${a.lng},${a.lat}`));
    assert.deepEqual(await verifiedBookingRoute(route.id,a,b,true),route);
    await assert.rejects(verifiedBookingRoute(route.id,a,b,false));await assert.rejects(verifiedBookingRoute(route.id,b,a,true));
    await assert.rejects(verifiedBookingRoute("f".repeat(64),a,b,true));await assert.rejects(verifiedBookingRoute(route.id,{lat:"28",lng:77},b,true));
    assert.equal(db.state.count,1);
  }finally{globalThis.fetch=old;}
}));
test("invalid/no-road responses are rejected and counted",()=>withDb({},async db=>{const old=globalThis.fetch;globalThis.fetch=async()=>Response.json({code:"NoRoute",routes:[]});try{await assert.rejects(calculateBookingRoute(a,b,false),error=>error instanceof MapServiceError&&error.status===422);assert.equal(db.state.count,1);}finally{globalThis.fetch=old;}}));
test("search length and identical route points fail before provider access",()=>withDb({},async db=>{await assert.rejects(searchMapPlaces("ab"));await assert.rejects(searchMapPlaces("x".repeat(151)));await assert.rejects(calculateBookingRoute(a,a,false));assert.equal(db.state.count,0);}));

test("type-ahead uses Photon with India filtering, shared quota/cache and validated coordinates",()=>withDb({},async db=>{
  const previous=globalThis.fetch;let requested="",calls=0;
  globalThis.fetch=async url=>{calls++;requested=String(url);return Response.json({features:[
    {geometry:{type:"Point",coordinates:[77.2295,28.6129]},properties:{name:"India Gate",city:"New Delhi",state:"Delhi",countrycode:"IN"}},
    {geometry:{type:"Point",coordinates:[77.2295,28.6129]},properties:{name:"India Gate",city:"New Delhi",state:"Delhi",countrycode:"IN"}},
    {geometry:{type:"Point",coordinates:[-73,40]},properties:{name:"Outside India",countrycode:"US"}},
    {geometry:{type:"Point",coordinates:[999,999]},properties:{name:"Invalid",countrycode:"IN"}}
  ]});};
  try{const places=await suggestMapPlaces(" India Gate ");assert.equal(places.length,1);assert.equal(places[0].label,"India Gate, New Delhi, Delhi");
    assert.equal(new URL(requested).hostname,"photon.komoot.io");assert.equal(new URL(requested).searchParams.get("countrycode"),"IN");
    assert.deepEqual(await suggestMapPlaces("india gate"),places);assert.equal(calls,1);assert.equal(db.state.count,1);
    await assert.rejects(suggestMapPlaces("ab"));
  }finally{globalThis.fetch=previous;}
}));
test("Photon daily allowance fails closed without a provider request",()=>withDb({count:200},async()=>{
  const previous=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;return Response.json({features:[]});};
  try{await assert.rejects(suggestMapPlaces("Dehradun"),e=>e instanceof MapServiceError&&e.status===429);assert.equal(calls,0);}finally{globalThis.fetch=previous;}
}));

test("automatic geography metadata keeps the place name and resolves town/village city fields",()=>withDb({},async()=>{
  const previous=globalThis.fetch;
  globalThis.fetch=async()=>Response.json({features:[{geometry:{type:"Point",coordinates:[77.86,30.7]},properties:{name:"Deoban",town:"Chakrata",state:"Uttarakhand",postcode:"248123",countrycode:"IN"}}]});
  try {const [place]=await suggestMapPlaces("Deoban Chakrata");assert.equal(place.name,"Deoban");assert.equal(place.city,"Chakrata");assert.equal(place.state,"Uttarakhand");assert.equal(place.pincode,"248123");assert.equal(place.lat,30.7);assert.equal(place.lng,77.86);}finally{globalThis.fetch=previous;}
}));

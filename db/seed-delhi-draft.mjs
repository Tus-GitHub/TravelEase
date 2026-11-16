// Explicitly requested, idempotent operator draft. Default is a rolled-back rehearsal.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import pg from 'pg';
import {runtimeDatabaseConfig} from '../src/lib/server/db-config.ts';
import {blankPackageContent,validatePackageContent,packagePlanDays} from '../src/lib/package-content.ts';
import {ROUTE_STOP_TAG} from '../src/lib/route-stop.ts';
import {listPublicRegions,listPublicPackages,getPublicPackage} from '../src/lib/server/catalogue.ts';
import {resolvePrivatePackage} from '../src/lib/server/package-plan.ts';

assert(!process.env.VERCEL,'Run only as an explicit local operator task.');
const production=process.argv.includes('--production'),apply=process.argv.includes('--apply');
assert(production||process.argv.includes('--dev'),'Specify --production or --dev.');
const config=production?process.env.DATABASE_URL_PRODUCTION:process.env.DATABASE_URL;
assert(config&&new URL(config).hostname.endsWith('.neon.tech'),'Expected the configured Neon connection.');
const plan=JSON.parse(readFileSync(new URL('./data/delhi-draft-route.json',import.meta.url),'utf8'));
const client=new pg.Client(runtimeDatabaseConfig(config));
const oldPool=globalThis.__pgPool;
let committed=false,result;
await client.connect();
try{
 await client.query('BEGIN');
 await client.query("SELECT pg_advisory_xact_lock(hashtextextended('admin-catalogue-relations',0))");
 globalThis.__pgPool={query:(...args)=>client.query(...args)};
 const existing=(await client.query('SELECT package_id,name,slug,is_active,price_per_person FROM packages WHERE slug=$1 OR (NOT is_deleted AND geography_name_key(name)=geography_name_key($2)) FOR UPDATE',[plan.slug,plan.name])).rows;
 assert(existing.length<=1,'Ambiguous draft package; refusing to create a duplicate.');
 if(existing.length){
  result={status:'already exists; owner edits preserved',packageId:existing[0].package_id,name:existing[0].name,isActive:existing[0].is_active,createdCities:0,createdSpots:0};
 }else{
  const beforeDiscovery=await listPublicRegions();
  const snapshots={};
  for(const [table,id] of [['cities','city_id'],['tourist_spots','tourist_spot_id'],['packages','package_id']])snapshots[table]=(await client.query(`SELECT ${id} AS id,to_jsonb(t) AS value FROM ${table} t ORDER BY ${id}`)).rows;
  const region=(await client.query('SELECT region_id FROM regions WHERE geography_name_key(name)=geography_name_key($1) AND is_active AND NOT is_deleted',[plan.region])).rows;
  assert.equal(region.length,1,'Need the existing active North region.');
  const vehicle=(await client.query("SELECT v.vehicle_type_id,v.seating_capacity FROM vehicles v JOIN vehicle_types vt USING(vehicle_type_id) WHERE v.is_active AND NOT v.is_deleted AND vt.is_active AND NOT vt.is_deleted AND lower(vt.title) LIKE '%traveller%' ORDER BY v.seating_capacity DESC,v.vehicle_id LIMIT 1")).rows[0];
  assert(vehicle,'Need an active Traveller vehicle type.');
  const mapping=new Map(),cityCache=new Map();let createdCities=0,createdSpots=0;
  for(const place of plan.places){
   const cityKey=place.state+'/'+place.city;let city=cityCache.get(cityKey);
   if(!city){
    const states=(await client.query('SELECT state_id FROM states WHERE region_id=$1 AND geography_name_key(name)=geography_name_key($2) AND is_active AND NOT is_deleted',[region[0].region_id,place.state])).rows;
    assert.equal(states.length,1,'Missing or ambiguous active parent State: '+place.state);
    const cities=(await client.query('SELECT city_id,is_active FROM cities WHERE state_id=$1 AND geography_name_key(name)=geography_name_key($2) AND NOT is_deleted FOR SHARE',[states[0].state_id,place.city])).rows;
    assert(cities.length<=1,'Duplicate city: '+cityKey);
    if(cities.length){assert(cities[0].is_active,'Existing city is inactive: '+place.city);city=cities[0].city_id;}
    else{city=(await client.query('INSERT INTO cities(state_id,name,is_pickup_point,is_airport,display_order) VALUES($1,$2,false,false,(SELECT COALESCE(MAX(display_order),0)+1 FROM cities WHERE state_id=$1 AND NOT is_deleted)) RETURNING city_id',[states[0].state_id,place.city])).rows[0].city_id;createdCities++;}
    cityCache.set(cityKey,city);
   }
   const spots=(await client.query('SELECT tourist_spot_id,is_active FROM tourist_spots WHERE city_id=$1 AND geography_name_key(name)=geography_name_key($2) AND NOT is_deleted FOR SHARE',[city,place.name])).rows;
   assert(spots.length<=1,'Duplicate route destination: '+place.name);
   let spot;
   if(spots.length){assert(spots[0].is_active,'Existing destination is inactive: '+place.name);spot=spots[0].tourist_spot_id;}
   else{spot=(await client.query('INSERT INTO tourist_spots(city_id,name,tag,description,display_order) VALUES($1,$2,$3,$4,(SELECT COALESCE(MAX(display_order),0)+1 FROM tourist_spots WHERE city_id=$1 AND NOT is_deleted)) RETURNING tourist_spot_id',[city,place.name,ROUTE_STOP_TAG,'Route checkpoint for an operator-authored travel package. Activities and inclusions are configured in the package.'])).rows[0].tourist_spot_id;createdSpots++;}
   mapping.set(place.id,spot);
  }
  const content=validatePackageContent({...blankPackageContent(),summary:'Draft route template. Set prices, nights, stays, meals and inclusions before making it live.',description:'Choose and review the route branches. The draft does not include hotels, meals, activities or a guide until you configure them.',guideIncluded:false,itinerary:[{day:1,title:'Set your day plan',description:'',meals:[]}],inclusions:[],exclusions:[],routeTree:{roots:plan.roots.map(id=>mapping.get(id)),nodes:plan.connections.map(node=>({spotId:mapping.get(node.id),next:node.next.map(id=>mapping.get(id)),nights:0,extraPricePerPerson:0,description:'',meals:{breakfast:0,lunch:0,dinner:0},canFinish:node.canFinish}))}});
  assert(content&&content.routeTree.nodes.length===32);
  const pkg=(await client.query("INSERT INTO packages(region_id,vehicle_type_id,name,slug,duration_days,max_persons,price_per_person,booking_mode,trip_content,is_active,highlights,display_order) VALUES($1,$2,$3,$4,$5,$6,0,'private',$7::jsonb,false,'[]'::jsonb,(SELECT COALESCE(MAX(display_order),0)+1 FROM packages WHERE NOT is_deleted)) RETURNING package_id,is_active,price_per_person",[region[0].region_id,vehicle.vehicle_type_id,plan.name,plan.slug,packagePlanDays(content,'private',0,1),vehicle.seating_capacity,JSON.stringify(content)])).rows[0];
  assert.equal(pkg.is_active,false);assert.equal(Number(pkg.price_per_person),0);
  assert.equal(await getPublicPackage(plan.slug),null);
  assert(!(await listPublicPackages()).some(row=>row.slug===plan.slug));
  await assert.rejects(()=>resolvePrivatePackage({packageId:pkg.package_id,guidedPath:[mapping.get(1),mapping.get(2),mapping.get(10)]},client),/unavailable|not found/i);
  assert.deepEqual(await listPublicRegions(),beforeDiscovery,'Route checkpoints must not alter tourist discovery.');
  for(const [table,id] of [['cities','city_id'],['tourist_spots','tourist_spot_id'],['packages','package_id']]){
   const after=new Map((await client.query(`SELECT ${id} AS id,to_jsonb(t) AS value FROM ${table} t WHERE ${id}=ANY($1::int[])`,[snapshots[table].map(row=>row.id)])).rows.map(row=>[row.id,row.value]));
   for(const row of snapshots[table])assert.deepEqual(after.get(row.id),row.value,'Existing record changed: '+table+'/'+row.id);
  }
  await client.query("INSERT INTO activity_logs(action,entity_type,entity_id,details) VALUES('admin.import','packages',$1,$2::jsonb)",[String(pkg.package_id),JSON.stringify({source:'requested-delhi-draft',destinations:32,connections:plan.connections.reduce((n,node)=>n+node.next.length,0),createdCities,createdSpots,isActive:false,pricePerPerson:0})]);
  result={status:apply?'created':'rehearsed; rolled back',packageId:pkg.package_id,name:plan.name,slug:plan.slug,isActive:false,pricePerPerson:0,vehicleTypeId:vehicle.vehicle_type_id,maxPersons:vehicle.seating_capacity,destinations:32,connections:plan.connections.reduce((n,node)=>n+node.next.length,0),createdCities,createdSpots,publiclyListed:false,publicCheckoutRejected:true,discoveryUnchanged:true,existingRecordsUnchanged:true};
 }
 if(apply){await client.query('COMMIT');committed=true;}else await client.query('ROLLBACK');
 console.log(JSON.stringify(result,null,2));
}catch(error){if(!committed)await client.query('ROLLBACK');throw error;}
finally{if(oldPool===undefined)delete globalThis.__pgPool;else globalThis.__pgPool=oldPool;await client.end();}

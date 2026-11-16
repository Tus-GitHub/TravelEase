import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {runtimeDatabaseConfig} from '../../src/lib/server/db-config.ts';
import {getPool} from '../../src/lib/server/db.ts';
import * as geo from '../../src/lib/server/admin/geography.ts';
import {listPublicRegions} from '../../src/lib/server/catalogue.ts';
import {planSpotNames} from '../../src/lib/server/package-plan.ts';
import {DependentRowsError} from '../../src/lib/server/db-errors.ts';
assert(process.argv.includes('--dev')&&!process.env.VERCEL);
assert.notEqual(new URL(process.env.DATABASE_URL_APP).hostname,new URL(process.env.DATABASE_URL_PRODUCTION).hostname);
const {Pool}=createRequire(import.meta.url)('pg');
const pool=new Pool({...runtimeDatabaseConfig(process.env.DATABASE_URL),max:2}),tag=randomUUID(),actor=randomUUID(),regions=[];let checks=0;
const pass=message=>{checks++;console.log('PASS '+message);},unique=e=>e.code==='23505';
try{
 await pool.query("INSERT INTO users(user_id,name,email,phone,password_hash,email_verified_at,role_id) VALUES($1,$2,$3,'','unusable',now(),(SELECT role_id FROM roles WHERE name='admin'))",[actor,'Geography fixture '+tag,'geo-'+tag+'@example.invalid']);
 const north=await geo.createRegion({name:'Owned North '+tag},actor),south=await geo.createRegion({name:'Owned South '+tag},actor);regions.push(north.id,south.id);
 const results=await Promise.allSettled([geo.createRegion({name:'  owned  north '+tag+' '},actor),geo.createRegion({name:'OWNED NORTH '+tag},actor)]);assert(results.every(r=>r.status==='rejected'&&unique(r.reason)));pass('case/space duplicate region requests cannot create another North');
 const up=await geo.createState({regionId:north.id,name:'Owned Uttar Pradesh'},actor),uk=await geo.createState({regionId:north.id,name:'Owned Uttarakhand'},actor);await assert.rejects(geo.createState({regionId:north.id,name:' owned   UTTARAKHAND '},actor),unique);pass('one region owns multiple states; duplicate state blocked within its parent');
 const cityInput={name:'Owned Dehradun',latitude:30.3165,longitude:78.0322,isPickupPoint:true,isAirport:false};
 const city=await geo.createCity({...cityInput,stateId:uk.id},actor);assert.equal(city.regionId,north.id);assert.equal(city.stateId,uk.id);assert.equal(city.stateName,uk.name);
 await assert.rejects(geo.createCity({...cityInput,name:' owned  DEHRADUN ',stateId:uk.id},actor),unique);
 const otherCity=await geo.createCity({...cityInput,stateId:up.id},actor);assert.notEqual(otherCity.id,city.id);pass('city derives region from State; duplicates blocked per State while same name in another State is valid');
 const spot=await geo.createTouristSpot({cityId:city.id,name:'Owned destination',tag:'Nature',description:'Owned fixture',latitude:30.46,longitude:78.07},actor);
 await assert.rejects(geo.createTouristSpot({cityId:city.id,name:' owned   DESTINATION ',tag:'',description:''},actor),unique);
 await assert.rejects(geo.deleteState(uk.id,actor),DependentRowsError);await assert.rejects(geo.deleteRegion(north.id,actor),DependentRowsError);await assert.rejects(geo.deleteCity(city.id,actor),DependentRowsError);pass('spot uniqueness and Region/State/City dependency guards protect the complete hierarchy');
 assert((await planSpotNames(pool,[spot.id])).has(spot.id));await geo.updateState(uk.id,{isActive:false},actor);assert.equal((await planSpotNames(pool,[spot.id])).size,0);assert(!(await listPublicRegions()).find(r=>r.id===north.id).spots.some(s=>s.id===spot.id));await geo.updateState(uk.id,{isActive:true},actor);pass('inactive State hides its destinations and prevents their package use');
 await geo.updateState(uk.id,{regionId:south.id},actor);const moved=(await geo.listCities()).find(c=>c.id===city.id);assert.equal(moved.regionId,south.id);assert.equal(moved.stateId,uk.id);assert((await listPublicRegions()).find(r=>r.id===south.id).spots.some(s=>s.id===spot.id));pass('moving State reassigns derived city region without replacing city/spot IDs');
 const changed=await geo.updateCity(otherCity.id,{stateId:uk.id,name:'Second owned city'},actor);assert.equal(changed.regionId,south.id);await assert.rejects(geo.updateCity(otherCity.id,{stateId:2147483647},actor),e=>e.code==='23503');pass('explicit city reparent uses State and rejects nonexistent parents');
 await assert.rejects(pool.query("INSERT INTO cities(region_id,name) VALUES($1,'Ambiguous legacy city')",[south.id+1000000]),e=>e.code==='23503');
 const legacy=await geo.createRegion({name:'Owned legacy '+tag,state:'Owned legacy state'},actor);regions.push(legacy.id);const legacyCity=await geo.createCity({...cityInput,regionId:legacy.id},actor);assert(legacyCity.stateId);pass('previous released single-state writer remains compatible without guessing a parent');
 console.log('PASS '+checks+' geography database groups; no external providers/mail used');
}catch(error){console.error('Geography regression failed:',error);throw error;}finally{
 await pool.query('DELETE FROM activity_logs WHERE user_id=$1',[actor]);
 await pool.query('DELETE FROM tourist_spots WHERE created_by=$1',[actor]);await pool.query('DELETE FROM cities WHERE created_by=$1',[actor]);await pool.query('DELETE FROM states WHERE created_by=$1',[actor]);await pool.query('DELETE FROM regions WHERE created_by=$1',[actor]);await pool.query('DELETE FROM users WHERE user_id=$1',[actor]);assert.equal((await pool.query('SELECT 1 FROM users WHERE user_id=$1',[actor])).rowCount,0);await pool.end();await getPool().end();console.log('PASS owned geography fixtures removed');
}

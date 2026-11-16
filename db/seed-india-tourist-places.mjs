// Explicit, data-only catalogue import. Defaults to read-only dry run.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runtimeDatabaseConfig } from '../src/lib/server/db-config.ts';
const { Client } = createRequire(import.meta.url)('pg');
const data = JSON.parse(readFileSync(new URL('./data/india-tourist-places.json', import.meta.url), 'utf8'));
const key = value => value.trim().replace(/\s+/g, ' ').toLowerCase();
const names = row => new Set([row.name, ...(row.aliases ?? [])].map(key));
assert.equal(data.cities.length,24);
assert.equal(data.cities.flatMap(c=>c.spots).length,48);
for(const city of data.cities) for(const place of [city,...city.spots]) {
  assert(place.latitude>=6&&place.latitude<=38&&place.longitude>=67&&place.longitude<=99,'Coordinate outside India: '+place.name);
  assert(place.coordinateSource.startsWith('https://'));
  const nearby=Math.hypot((place.latitude-city.latitude)*111,(place.longitude-city.longitude)*111*Math.cos((place.latitude+city.latitude)*Math.PI/360));
  assert(nearby<70,'Spot coordinate needs review near its parent city: '+city.name+' / '+place.name);
}
const production=process.argv.includes('--production'), apply=process.argv.includes('--apply'), rehearse=process.argv.includes('--verify-rollback');
assert(!(apply&&rehearse)); assert(!process.env.VERCEL,'Explicit maintenance only');
const target=process.env[production?'DATABASE_URL_PRODUCTION':'DATABASE_URL']; assert(target,'Database configuration missing');
if(!production&&process.env.DATABASE_URL_PRODUCTION)assert.notEqual(new URL(target).hostname.replace('-pooler.','.'),new URL(process.env.DATABASE_URL_PRODUCTION).hostname.replace('-pooler.','.'));
const client=new Client({...runtimeDatabaseConfig(target),statement_timeout:30000,lock_timeout:15000,application_name:'travelease-india-tourist-import'});
async function snapshot(){
  const result={};
  for(const [table,id] of [['regions','region_id'],['states','state_id'],['cities','city_id'],['tourist_spots','tourist_spot_id']])result[table]=(await client.query(`SELECT * FROM ${table} ORDER BY ${id}`)).rows;
  return result;
}
function inspect(rows){
  const found=[],missingCities=[],missingSpots=[];
  for(const city of data.cities){
    const parents=rows.states.filter(s=>!s.is_deleted&&key(s.name)===key(city.state));
    assert.equal(parents.length,1,'Missing or ambiguous State: '+city.state);
    const state=parents[0],region=rows.regions.find(r=>r.region_id===state.region_id);
    assert(state.is_active&&region?.is_active&&!region.is_deleted,'Inactive parent; refusing to expose '+city.name);
    const aliases=names(city),existing=rows.cities.filter(c=>!c.is_deleted&&c.state_id===state.state_id&&aliases.has(key(c.name)));
    assert(existing.length<=1,'Duplicate city aliases: '+city.name);
    const row=existing[0];
    if(!row)missingCities.push(city.name);
    for(const spot of city.spots){const alias=names(spot),matches=row?rows.tourist_spots.filter(s=>!s.is_deleted&&s.city_id===row.city_id&&alias.has(key(s.name))):[];assert(matches.length<=1,'Duplicate spot aliases: '+spot.name);if(!matches.length)missingSpots.push(city.name+' / '+spot.name);}
    found.push({city,state,row});
  }
  return {found,missingCities,missingSpots};
}
await client.connect();
try{
  await client.query('BEGIN');await client.query("SELECT pg_advisory_xact_lock(hashtextextended('admin-catalogue-relations',0))");
  const before=await snapshot(),plan=inspect(before),addedCities=[],addedSpots=[];
  if(apply||rehearse){
    const actor=(await client.query("SELECT u.user_id FROM users u JOIN roles r USING(role_id) WHERE r.name='admin' AND u.is_active AND NOT u.is_deleted ORDER BY u.created_at LIMIT 1")).rows[0]?.user_id;assert(actor,'No existing administrator');
    for(const {city,state,row} of plan.found){
      let cityId=row?.city_id;
      if(!cityId){const inserted=await client.query('INSERT INTO cities(state_id,region_id,name,latitude,longitude,is_pickup_point,created_by,updated_by) VALUES($1,$2,$3,$4,$5,false,$6,$6) RETURNING city_id',[state.state_id,state.region_id,city.name,city.latitude,city.longitude,actor]);cityId=inserted.rows[0].city_id;addedCities.push({id:cityId,name:city.name,state:city.state});}
      // A deliberately hidden existing city remains hidden. Its spots keep that visibility.
      for(const spot of city.spots){const aliases=names(spot),existing=before.tourist_spots.filter(s=>!s.is_deleted&&s.city_id===cityId&&aliases.has(key(s.name)));if(existing.length)continue;
        const inserted=await client.query('INSERT INTO tourist_spots(city_id,name,tag,description,latitude,longitude,image_url,is_active,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$9) RETURNING tourist_spot_id',[cityId,spot.name,spot.tag,spot.description,spot.latitude,spot.longitude,'/images/destination-illustration.svg',row?.is_active??true,actor]);addedSpots.push({id:inserted.rows[0].tourist_spot_id,cityId,name:spot.name});
      }
    }
    const after=await snapshot(),repeat=inspect(after);
    assert.equal(repeat.missingCities.length,0);assert.equal(repeat.missingSpots.length,0);
    for(const [table,id] of [['regions','region_id'],['states','state_id'],['cities','city_id'],['tourist_spots','tourist_spot_id']])for(const row of before[table])assert.deepEqual(after[table].find(item=>item[id]===row[id]),row,'Existing record changed: '+table);
    if(addedCities.length||addedSpots.length)await client.query('INSERT INTO activity_logs(user_id,action,entity_type,details) VALUES($1,$2,$3,$4::jsonb)',[actor,'admin.seed_india_tourist_places','geography',JSON.stringify({verifiedOn:data.verifiedOn,addedCities,addedSpots})]);
  }
  const after=await snapshot();
  await client.query(apply?'COMMIT':'ROLLBACK');
  const report={environment:production?'production':'development',mode:apply?'apply':rehearse?'verify-rollback':'dry-run',committed:apply,citiesToAdd:plan.missingCities.length,spotsToAdd:plan.missingSpots.length,addedCities,addedSpots,before,after,repeatWouldAdd:apply||rehearse?0:undefined};
  const path=process.argv.find(s=>s.startsWith('--report='))?.slice(9);if(path)writeFileSync(path,JSON.stringify(report,null,2));
  console.log(JSON.stringify({environment:report.environment,mode:report.mode,committed:apply,citiesToAdd:report.citiesToAdd,spotsToAdd:report.spotsToAdd,addedCities:addedCities.length,addedSpots:addedSpots.length,repeatWouldAdd:report.repeatWouldAdd}));
}catch(error){await client.query('ROLLBACK');throw error;}finally{await client.end();}

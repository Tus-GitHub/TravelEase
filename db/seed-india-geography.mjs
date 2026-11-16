// Data-only import. Dry run by default; never changes schema or existing places.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runtimeDatabaseConfig} from '../src/lib/server/db-config.ts';
const {Client}=createRequire(import.meta.url)('pg');
const catalogue=JSON.parse(readFileSync(new URL('./data/india-geography.json',import.meta.url),'utf8'));
const key=value=>value.trim().replace(/\s+/g,' ').toLowerCase();
const entries=catalogue.regions.flatMap(region=>region.states.map(state=>({...state,region:region.name})));
assert.equal(catalogue.regions.length,6);assert.equal(entries.length,36);assert.equal(entries.filter(s=>s.kind==='state').length,28);assert.equal(entries.filter(s=>s.kind==='union_territory').length,8);
assert.equal(new Set(entries.map(s=>key(s.name))).size,36);assert.equal(new Set(catalogue.regions.map(r=>key(r.name))).size,6);
const production=process.argv.includes('--production'),apply=process.argv.includes('--apply'),rehearse=process.argv.includes('--verify-rollback');
assert(!(apply&&rehearse),'Choose apply or verify-rollback');assert(!process.env.VERCEL,'Run this maintenance command explicitly');
const target=process.env[production?'DATABASE_URL_PRODUCTION':'DATABASE_URL'];assert(target,'Database configuration missing');
if(!production&&process.env.DATABASE_URL_PRODUCTION)assert.notEqual(new URL(target).hostname.replace('-pooler.','.'),new URL(process.env.DATABASE_URL_PRODUCTION).hostname.replace('-pooler.','.'));
const client=new Client({...runtimeDatabaseConfig(target),statement_timeout:30000,lock_timeout:15000,application_name:'travelease-india-geography-import'});
async function snapshot(){return{regions:(await client.query('SELECT region_id AS id,name,is_active,is_deleted,state,display_order FROM regions ORDER BY region_id')).rows,states:(await client.query('SELECT state_id AS id,region_id AS "regionId",name,is_active,is_deleted,display_order FROM states ORDER BY state_id')).rows,cities:(await client.query('SELECT city_id,state_id,region_id,name,is_active,is_deleted FROM cities ORDER BY city_id')).rows,spots:(await client.query('SELECT tourist_spot_id,city_id,name,is_active,is_deleted FROM tourist_spots ORDER BY tourist_spot_id')).rows};}
function inspect(rows){
 const liveRegions=rows.regions.filter(r=>!r.is_deleted),liveStates=rows.states.filter(s=>!s.is_deleted),regionIds=new Map(),stateIds=new Map(),missingRegions=[],missingStates=[];
 for(const region of catalogue.regions){const found=liveRegions.filter(r=>key(r.name)===key(region.name));if(found.length>1)throw Error('Ambiguous existing region: '+region.name);if(found.length)regionIds.set(region.name,found[0].id);else missingRegions.push(region.name);}
 for(const state of entries){const aliases=new Set([state.name,...(state.aliases??[])].map(key)),found=liveStates.filter(s=>aliases.has(key(s.name)));if(found.length>1)throw Error('Existing duplicate state/alias needs review before import: '+state.name);if(found.length){if(found[0].regionId!==regionIds.get(state.region))throw Error('Existing state belongs to another region; refusing to move or duplicate '+state.name);stateIds.set(state.name,found[0].id);}else missingStates.push(state.name);}
 return{regionIds,stateIds,missingRegions,missingStates};
}
await client.connect();let report;
try{
 await client.query('BEGIN');await client.query("SELECT pg_advisory_xact_lock(hashtextextended('admin-catalogue-relations',0))");
 const before=await snapshot(),plan=inspect(before);const addedRegions=[],addedStates=[];
 if(apply||rehearse){
  const actor=(await client.query("SELECT u.user_id FROM users u JOIN roles r USING(role_id) WHERE r.name='admin' AND u.is_active AND NOT u.is_deleted ORDER BY u.created_at LIMIT 1")).rows[0]?.user_id;assert(actor,'No existing admin actor');
  for(const name of plan.missingRegions){const inserted=await client.query(`INSERT INTO regions(name,state,created_by,updated_by) VALUES($1,'',$2,$2) ON CONFLICT (geography_name_key(name)) WHERE NOT is_deleted DO NOTHING RETURNING region_id`,[name,actor]);const id=(await client.query('SELECT region_id FROM regions WHERE geography_name_key(name)=geography_name_key($1) AND NOT is_deleted',[name])).rows[0]?.region_id;assert(id);plan.regionIds.set(name,id);if(inserted.rowCount)addedRegions.push({id,name});}
  for(const state of entries){if(plan.stateIds.has(state.name))continue;const regionId=plan.regionIds.get(state.region);assert(regionId);const inserted=await client.query(`INSERT INTO states(region_id,name,created_by,updated_by) VALUES($1,$2,$3,$3) ON CONFLICT (region_id,geography_name_key(name)) WHERE NOT is_deleted DO NOTHING RETURNING state_id`,[regionId,state.name,actor]);const id=(await client.query('SELECT state_id FROM states WHERE region_id=$1 AND geography_name_key(name)=geography_name_key($2) AND NOT is_deleted',[regionId,state.name])).rows[0]?.state_id;assert(id);plan.stateIds.set(state.name,id);if(inserted.rowCount)addedStates.push({id,name:state.name,regionId});}
  const after=await snapshot(),again=inspect(after);assert.equal(again.missingRegions.length,0);assert.equal(again.missingStates.length,0);
  for(const row of before.regions)assert.deepEqual(after.regions.find(r=>r.id===row.id),row,'Existing Region changed');for(const row of before.states)assert.deepEqual(after.states.find(r=>r.id===row.id),row,'Existing State changed');assert.deepEqual(after.cities,before.cities);assert.deepEqual(after.spots,before.spots);
  if(addedRegions.length||addedStates.length)await client.query('INSERT INTO activity_logs(user_id,action,entity_type,details) VALUES($1,$2,$3,$4::jsonb)',[actor,'admin.seed_india_geography','geography',JSON.stringify({source:catalogue.sources,addedRegions,addedStates})]);
  report={environment:production?'production':'development',mode:apply?'apply':'verify-rollback',verifiedOn:catalogue.verifiedOn,source:catalogue.sources,addedRegions,addedStates,canonicalRegions:again.regionIds.size,canonicalPlaces:again.stateIds.size,states:28,unionTerritories:8,unchangedExistingRows:true,citiesUnchanged:true,spotsUnchanged:true,repeatWouldAdd:0,before,after};
 }else report={environment:production?'production':'development',mode:'dry-run',missingRegions:plan.missingRegions,missingStates:plan.missingStates,before};
 await client.query(apply?'COMMIT':'ROLLBACK');report.committed=apply;
 const reportPath=process.argv.find(arg=>arg.startsWith('--report='))?.slice('--report='.length);if(reportPath)writeFileSync(reportPath,JSON.stringify(report,null,2));
 console.log(JSON.stringify({environment:report.environment,mode:report.mode,committed:report.committed,regionsToAdd:plan.missingRegions.length,statesAndUTsToAdd:plan.missingStates.length,addedRegions:addedRegions.length,addedStatesAndUTs:addedStates.length,canonicalRegions:report.canonicalRegions,canonicalPlaces:report.canonicalPlaces,repeatWouldAdd:report.repeatWouldAdd}));
}catch(error){await client.query('ROLLBACK');throw error;}finally{await client.end();}

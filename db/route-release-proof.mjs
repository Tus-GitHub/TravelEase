// Review migration034 against the prior Development baseline and its production-derived replay.
// This script never mutates a database. Final proof requires separate verified branch cleanup.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import pg from 'pg';
import snapshots from './schema-snapshot.js';
import checks from './check-dev.js';
import proofTools from './release-replay-proof.js';
import {runtimeDatabaseConfig} from '../src/lib/server/db-config.ts';
assert(!process.env.VERCEL&&process.argv.includes('--review'));
const pending=['034_route_templates.sql'],baselineFile=new URL('./dev-schema-baseline.json',import.meta.url),old=JSON.parse(fs.readFileSync(baselineFile)),hashes=checks.migrationHashes();
assert.equal(old.snapshot.migrations.length,33,'Review this transition once, from the untouched33-migration baseline.');
assert.deepEqual(checks.compareHashes(old.hashes,hashes,old.snapshot.migrations),[]);
async function observe(url){const db=new pg.Client(runtimeDatabaseConfig(url));await db.connect();try{await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');const snapshot=await snapshots.schemaSnapshot(db);await db.query('ROLLBACK');return snapshot;}finally{await db.end();}}
const [development,production,replayed]=await Promise.all([observe(process.env.DATABASE_URL),observe(process.env.DATABASE_URL_PRODUCTION),observe(process.env.DATABASE_URL_TEST)]);
assert.deepEqual(development.migrations.filter(name=>!production.migrations.includes(name)),pending);
assert.deepEqual(production.migrations,old.snapshot.migrations);
const withoutRoute={...development,migrations:old.snapshot.migrations};
for(const [category,value] of Object.entries(development)){if(category==='migrations')continue;withoutRoute[category]=value.filter(row=>{const key=row.key;return !(key==='route_templates'||key.startsWith('route_templates.')||key.startsWith('route_templates:')||key==='route_templates_pkey'||key==='route_templates_slug_key'||key==='idx_route_templates_region'||key==='route_templates_route_template_id_seq'||key.startsWith('route_templates_route_template_id_seq:'));});}
assert.deepEqual(snapshots.compareSnapshots(old.snapshot,withoutRoute),[],'Unrelated Development schema drift; do not update baseline.');
assert.deepEqual(snapshots.compareSnapshots(development,replayed,{includeGrants:false}),[],'The production-derived migration replay must exactly explain Development.');
assert.deepEqual(snapshots.compareSnapshots(production,{...old.snapshot,grants:production.grants,schemaGrants:production.schemaGrants},{includeGrants:false}),[],'Production differs from the reviewed33-migration baseline.');
const report={format:1,kind:'schema-only-migration-replay',verified:true,cleanupComplete:false,verifiedAt:new Date().toISOString(),productionEndpoint:proofTools.endpointDigest(process.env.DATABASE_URL_PRODUCTION),developmentEndpoint:proofTools.endpointDigest(process.env.DATABASE_URL),productionSchema:proofTools.schemaDigest(production),developmentSchema:proofTools.schemaDigest(development),replayedSchema:proofTools.schemaDigest(replayed),pending,migrationHashes:hashes,temporaryBranch:'br-late-sunset-b3skbkzo',note:'Schema-only migration034 replayed on an isolated production-copy branch; full application tests also used owned rows there. Cleanup approval is required before finalizing proof.'};
assert(process.env.ROUTE_RELEASE_REPORT);fs.writeFileSync(process.env.ROUTE_RELEASE_REPORT,JSON.stringify(report,null,2));
if(process.argv.includes('--advance-reviewed-baseline')){fs.copyFileSync(baselineFile,new URL('./dev-schema-baseline-before-routes.json',import.meta.url),fs.constants.COPYFILE_EXCL);fs.writeFileSync(baselineFile,JSON.stringify({format:1,recordedAt:new Date().toISOString(),note:'Reviewed append-only034 additions only; prior schema/hash baseline unchanged after excluding the new route template objects, and replay matches the production-copy branch.',hashes,snapshot:development},null,2)+'\n');}
console.log('PASS only approved migration034 route-template objects added; old definitions/checksums preserved; production-derived replay equals Development. Report awaits verified test-branch cleanup.');

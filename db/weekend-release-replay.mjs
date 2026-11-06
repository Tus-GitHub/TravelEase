// Approved schema-only rehearsal on DEVELOPMENT. Production is read-only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { rootCertificates } from 'node:tls';
import pg from 'pg';
import snapshots from './schema-snapshot.js';
import checks from './check-dev.js';
import proofTools from './release-replay-proof.js';
const TARGET = 'travel_weekend_release_check_20261106';
const reviewBytes = fs.readFileSync(new URL('./weekend-release-schema-review.json', import.meta.url));
const review = JSON.parse(reviewBytes);
const reviewHash = createHash('sha256').update(reviewBytes).digest('hex');
assert.equal(process.argv.find(arg => arg.startsWith('--approved-schema='))?.split('=')[1], reviewHash, 'Exact schema approval required');
assert.equal(execFileSync('git', ['branch','--show-current'], {encoding:'utf8'}).trim(), 'development');
assert(!process.env.VERCEL && review.target_database === TARGET && review.target_branch === 'development');
const direct = value => { const url = new URL(value); url.hostname = url.hostname.replace(/-pooler\./,'.'); url.searchParams.set('sslmode','verify-full'); return url; };
const dev = direct(process.env.DATABASE_URL), prod = direct(process.env.DATABASE_URL_PRODUCTION);
assert.notEqual(dev.hostname,prod.hostname); assert.notEqual(decodeURIComponent(dev.pathname.slice(1)),TARGET);
const target = new URL(dev); target.pathname = '/' + TARGET;
const config = url => ({connectionString:url.toString(),connectionTimeoutMillis:10000,statement_timeout:60000});
const admin = new pg.Client(config(dev)), source = new pg.Client(config(prod));
const tools = process.env.PG18_BIN;
assert(tools, 'PG18_BIN required');
for (const command of ['pg_dump','pg_restore']) assert.match(execFileSync(path.join(tools,command+'.exe'),['--version'],{encoding:'utf8'}), /\b18\./);
let replay, created = false, scratch, report;
async function observe(client) {
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  try { return await snapshots.schemaSnapshot(client); } finally { await client.query('ROLLBACK'); }
}
function run(executable,args,env) {
  return new Promise((resolve,reject) => {
    const child = spawn(executable,args,{env,windowsHide:true,stdio:['ignore','ignore','pipe']});
    let diagnostic = ''; child.stderr.on('data',chunk=>{diagnostic=(diagnostic+chunk).slice(-2000);});
    child.on('error',()=>reject(new Error('PostgreSQL tool could not start')));
    child.on('exit',code=>code===0?resolve():reject(new Error(`PostgreSQL tool failed (${code}; ${/permission denied/i.test(diagnostic)?'permission':/SSL|certificate/i.test(diagnostic)?'TLS':'restore/dump'}). Details suppressed.`)));
  });
}
function libpq(url) {
  return {...process.env,PGHOST:url.hostname,PGPORT:url.port||'5432',PGDATABASE:decodeURIComponent(url.pathname.slice(1)),PGUSER:decodeURIComponent(url.username),PGPASSWORD:decodeURIComponent(url.password),PGSSLMODE:'verify-full',PGSSLROOTCERT:path.join(scratch,'roots.pem'),PGCONNECT_TIMEOUT:'10'};
}
try {
  await admin.connect(); await source.connect();
  assert.equal((await admin.query('SELECT 1 FROM pg_database WHERE datname=$1',[TARGET])).rowCount,0,'Temporary target already exists; refusing overwrite');
  const development = await observe(admin);
  const baseline = JSON.parse(fs.readFileSync(new URL('./dev-schema-baseline.json',import.meta.url)));
  const hashes = checks.migrationHashes();
  assert.deepEqual(snapshots.compareSnapshots(baseline.snapshot,development),[],'Dev drift');
  assert.deepEqual(checks.compareHashes(baseline.hashes,hashes,development.migrations),[],'SQL hashes changed');
  const inventory = development.columns.map(row=>{const [table,column]=row.key.split('.');return {table,column,...row.definition};});
  assert.deepEqual(inventory,review.columns,'Approved inventory changed');
  await source.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const production = await snapshots.schemaSnapshot(source);
  const pending = development.migrations.filter(name=>!production.migrations.includes(name));
  assert.deepEqual(pending,['029_weekend_trip_departures.sql']);
  assert(production.migrations.every(name=>development.migrations.includes(name)));
  const exported = (await source.query('SELECT pg_export_snapshot() AS id')).rows[0].id;
  scratch = fs.mkdtempSync(path.join(os.tmpdir(),'travel-cms-replay-'));
  const identity = execFileSync('whoami',[],{encoding:'utf8'}).trim();
  execFileSync('icacls',[scratch,'/inheritance:r','/grant:r',`${identity}:(OI)(CI)F`,'SYSTEM:(OI)(CI)F'],{stdio:'ignore',windowsHide:true});
  fs.writeFileSync(path.join(scratch,'roots.pem'),rootCertificates.join('\n'));
  const archive = path.join(scratch,'production-schema.dump');
  await run(path.join(tools,'pg_dump.exe'),['--schema-only','--format=custom','--no-owner','--no-acl','--schema=public','--extension=pgcrypto',`--snapshot=${exported}`,`--file=${archive}`],libpq(prod));
  await source.query('ROLLBACK');
  console.log('Production schema read consistently; no customer data or production writes.');
  await admin.query(`CREATE DATABASE "${TARGET}" TEMPLATE template0`); created=true;
  replay = new pg.Client(config(target)); await replay.connect();
  await replay.query('DROP SCHEMA public'); // Empty newly created DB only; no CASCADE.
  await run(path.join(tools,'pg_restore.exe'),['--exit-on-error','--single-transaction','--no-owner','--no-acl','--dbname='+TARGET,archive],libpq(target));
  for(const name of production.migrations) await replay.query('INSERT INTO schema_migrations(migration_id) VALUES($1)',[name]);
  assert.deepEqual(snapshots.compareSnapshots(production,await observe(replay),{includeGrants:false,restoreCasts:true}),[],'Schema copy differs');
  for(const name of pending) {
    await replay.query('BEGIN');
    try {
      await replay.query(fs.readFileSync(new URL('./pg-migrations/'+name,import.meta.url),'utf8'));
      await replay.query('INSERT INTO schema_migrations(migration_id) VALUES($1)',[name]);
      await replay.query('COMMIT');
    } catch(error) { await replay.query('ROLLBACK'); throw error; }
    console.log('Replayed in temporary DEVELOPMENT database:',name);
  }
  const after = await observe(replay);
  assert.deepEqual(snapshots.compareSnapshots(development,after,{includeGrants:false,restoreCasts:true}),[],'Migration replay does not explain dev schema');
  const seeded = (await replay.query("SELECT slug,status,version,draft_content=published_content AS matching FROM cms_pages ORDER BY slug")).rows;
  assert.deepEqual(seeded,[],'Schema-only rehearsal copies no existing CMS content');
  assert.equal(Number((await replay.query('SELECT count(*) AS n FROM cms_page_revisions')).rows[0].n),0);
  assert.deepEqual(snapshots.compareSnapshots(production,await observe(source)),[],'Production schema changed during rehearsal');
  const {schemaDigest,endpointDigest} = proofTools;
  report={format:1,kind:'schema-only-migration-replay',verified:true,verifiedAt:new Date().toISOString(),cleanupComplete:false,
    targetDatabase:TARGET,reviewHash,pending,migrationHashes:hashes,productionEndpoint:endpointDigest(prod),developmentEndpoint:endpointDigest(dev),
    productionSchema:schemaDigest(production),developmentSchema:schemaDigest(development),replayedSchema:schemaDigest(after),tableCount:after.tables.length,columnCount:after.columns.length};
  console.log(`Rehearsal matches development: ${report.tableCount} tables, ${report.columnCount} columns; Weekend Trips migration matches the approved schema.`);
} catch(error) {
  console.error(error instanceof assert.AssertionError ? error.message : 'Rehearsal failed; connection/SQL details suppressed.'); process.exitCode=1;
} finally {
  await source.query('ROLLBACK').catch(()=>{}); await source.end().catch(()=>{}); await replay?.end().catch(()=>{});
  try {
    if(created) {
      assert.equal(decodeURIComponent(target.pathname.slice(1)),TARGET); assert.equal(target.hostname,dev.hostname); assert.notEqual(target.hostname,prod.hostname);
      await admin.query(`DROP DATABASE "${TARGET}" WITH (FORCE)`);
      assert.equal((await admin.query('SELECT 1 FROM pg_database WHERE datname=$1',[TARGET])).rowCount,0);
      console.log('Approved temporary database deleted and absence verified.');
    }
  } catch { process.exitCode=1; report=undefined; console.error('Temporary database cleanup failed; release proof withheld.'); }
  await admin.end().catch(()=>{});
  if(scratch) {
    const resolved=fs.realpathSync(scratch);assert.equal(path.dirname(resolved),fs.realpathSync(os.tmpdir()));assert(path.basename(resolved).startsWith('travel-cms-replay-'));
    fs.rmSync(resolved,{recursive:true,force:true});
  }
  if(report && !process.exitCode) {
    report.cleanupComplete=true;
    fs.writeFileSync(new URL('./cms-release-replay.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
    console.log('Fresh replay evidence recorded; db:check can verify exact schemas and migration hashes.');
  }
}

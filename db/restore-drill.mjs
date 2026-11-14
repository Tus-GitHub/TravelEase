// Only run after explicit approval of db/restore-schema-review.json and cleanup.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync,spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {rootCertificates} from 'node:tls';
import pg from 'pg';
import snapshots from './schema-snapshot.js';
const TARGET='travel_restore_drill_20261105';
const ident=s=>'"'+s.replaceAll('"','""')+'"';
const endpoint=s=>new URL(s).hostname.replace('-pooler.','.');
const reviewPath=new URL('./restore-schema-review.json',import.meta.url);
const reviewBytes=fs.readFileSync(reviewPath);
const review=JSON.parse(reviewBytes);
const fingerprint=createHash('sha256').update(reviewBytes).digest('hex');
const supplied=process.argv.find(x=>x.startsWith('--approved-schema='))?.split('=')[1];
if(supplied!==fingerprint || process.env.VERCEL) throw Error('Explicit approval of the exact schema inventory is required.');
if(execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim()!=='development') throw Error('Development branch required.');
const dev=process.env.DATABASE_URL,prod=process.env.DATABASE_URL_PRODUCTION;
if(!dev||!prod||endpoint(dev)===endpoint(prod))throw Error('Development isolation guard failed.');
const source=new URL(dev);source.hostname=endpoint(dev);source.searchParams.set('sslmode','verify-full');
const target=new URL(source);target.pathname='/'+TARGET;
if(source.pathname===target.pathname || review.target_database!==TARGET)throw Error('Invalid restore target.');
const tools=process.env.PG18_BIN;
if(!tools)throw Error('PG18_BIN is required.');
for(const exe of ['pg_dump','pg_restore']) {
  const version=execFileSync(path.join(tools,exe+'.exe'),['--version'],{encoding:'utf8'});
  if(!/\b18\./.test(version))throw Error('PostgreSQL 18 tools required.');
}
function run(exe,args,env=process.env) {
  return new Promise((resolve,reject)=>{
    const child=spawn(exe,args,{env,windowsHide:true,stdio:['ignore','ignore','pipe']});
    // Do not echo restore statements, data or connection strings from errors.
    let diagnostic='';
    child.stderr.on('data',chunk=>{ if(diagnostic.length<16000)diagnostic+=chunk.toString(); });
    child.on('error',()=>reject(Error('External tool could not start.')));
    child.on('exit',code=>{
      const category=/certificate|root.crt|SSL error/i.test(diagnostic)?'TLS certificate verification':
        /permission denied/i.test(diagnostic)?'permission denied':/extension/i.test(diagnostic)?'extension restore':
        /snapshot/i.test(diagnostic)?'exported snapshot':'unspecified';
      const headline=(diagnostic.match(/pg_(?:dump|restore): error: [^\r\n]+/)?.[0]||'')
        .replace(/"[^"]*"|'[^']*'/g,'<redacted>').slice(0,300);
      code===0?resolve():reject(Error(`External tool failed (${code}; ${category}). ${headline}`));
    });
  });
}
function libpqEnv(url) {
  return {...process.env,PGHOST:url.hostname,PGPORT:url.port||'5432',PGDATABASE:decodeURIComponent(url.pathname.slice(1)),
    PGUSER:decodeURIComponent(url.username),PGPASSWORD:decodeURIComponent(url.password),PGSSLMODE:'verify-full',
    PGSSLROOTCERT:path.join(scratch,'roots.pem'),PGCONNECT_TIMEOUT:'10'};
}
async function dataHashes(client,tables) {
  const rows=[];
  for(const table of tables) {
    const r=await client.query(`SELECT count(*)::text AS count,
      md5(coalesce(string_agg(row_to_json(t)::text,E'\\n' ORDER BY row_to_json(t)::text),'')) AS digest
      FROM public.${ident(table)} t`);
    rows.push({table,...r.rows[0]});
  }
  return rows;
}
const admin=new pg.Client({connectionString:source.toString(),connectionTimeoutMillis:10000});
const reader=new pg.Client({connectionString:source.toString(),connectionTimeoutMillis:10000});
let restored,created=false,scratch,archive;
const started=Date.now();
try {
  await admin.connect();await reader.connect();
  if((await admin.query('SELECT 1 FROM pg_database WHERE datname=$1',[TARGET])).rowCount)throw Error('Target already exists; refusing overwrite.');
  await reader.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const columns=(await reader.query(`SELECT c.table_name,c.column_name,c.udt_name,c.data_type,c.character_maximum_length,c.numeric_precision,c.numeric_scale,c.is_nullable,c.column_default
    FROM information_schema.columns c JOIN information_schema.tables t USING(table_catalog,table_schema,table_name)
    WHERE c.table_schema='public' AND t.table_type='BASE TABLE' ORDER BY c.table_name,c.ordinal_position`)).rows;
  if(JSON.stringify(columns)!==JSON.stringify(review.columns))throw Error('Source schema changed since approval.');
  const original=await snapshots.schemaSnapshot(reader);
  const tableNames=original.tables.map(x=>x.key);
  const hashes=await dataHashes(reader,tableNames);
  const snapshot=(await reader.query('SELECT pg_export_snapshot() AS snapshot')).rows[0].snapshot;
  scratch=fs.mkdtempSync(path.join(os.tmpdir(),'travelease-restore-'));
  const identity=execFileSync('whoami',[],{encoding:'utf8'}).trim();
  execFileSync('icacls',[scratch,'/inheritance:r','/grant:r',`${identity}:(OI)(CI)F`,'SYSTEM:(OI)(CI)F'],{stdio:'ignore',windowsHide:true});
  // Portable Windows libpq has no bundled root.crt; use Node's trusted public
  // CA set, retaining full chain and hostname verification.
  fs.writeFileSync(path.join(scratch,'roots.pem'),rootCertificates.join('\n'));
  archive=path.join(scratch,'development.dump');
  await run(path.join(tools,'pg_dump.exe'),['--format=custom','--no-owner','--no-acl','--schema=public','--extension=pgcrypto',`--snapshot=${snapshot}`,`--file=${archive}`],libpqEnv(source));
  console.log('Consistent development snapshot archived in private temporary storage.');
  await reader.query('ROLLBACK');
  await admin.query(`CREATE DATABASE ${ident(TARGET)} TEMPLATE template0`);created=true;
  restored=new pg.Client({connectionString:target.toString(),connectionTimeoutMillis:10000});await restored.connect();
  // A new database already contains an empty public schema. The archive owns
  // schema creation; no CASCADE so any unexpected contents abort the drill.
  await restored.query('DROP SCHEMA public');
  await run(path.join(tools,'pg_restore.exe'),['--exit-on-error','--single-transaction','--no-owner','--no-acl','--dbname='+TARGET,archive],libpqEnv(target));
  console.log('Archive loaded into approved temporary database; verifying definitions and data.');
  await restored.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const recovered=await snapshots.schemaSnapshot(restored);
  const drift=snapshots.compareSnapshots(original,recovered,{includeGrants:false,restoreCasts:true});
  if(drift.length) {
    console.error(drift.join('\n')); // Object names only, no SQL bodies or data.
    throw Error('Restored schema does not match source definitions.');
  }
  if(JSON.stringify(hashes)!==JSON.stringify(await dataHashes(restored,tableNames)))throw Error('Restored data fingerprints differ.');
  await restored.query('ROLLBACK');
  console.log(`Restore verified: ${tableNames.length} tables, ${original.migrations.length} migrations; schema definitions and all table row counts/fingerprints match.`);
  // Prove drift detection against actual PostgreSQL metadata without touching
  // source objects or creating any additional tables/columns.
  await restored.query('BEGIN');
  try {
    await restored.query('ALTER TABLE public.bookings DISABLE TRIGGER trg_bookings_updated_at');
    const changed=await snapshots.schemaSnapshot(restored);
    if(!snapshots.compareSnapshots(recovered,changed,{includeGrants:false}).some(x=>x.startsWith('triggers: changed')))
      throw Error('Live trigger drift was not detected.');
  }finally{await restored.query('ROLLBACK');}
  console.log('Actual trigger-definition drift detected; probe rolled back.');
  // Real application transaction tests; in-memory email, fixture cleanup.
  await run(process.execPath,['--experimental-strip-types','--import','./db/tests/_register.mjs','db/tests/concurrency.test.ts','--dev'],
    {...process.env,DATABASE_URL:target.toString(),DATABASE_URL_APP:''});
  console.log('Restored booking/coupon application smoke passed.');
  const report={verifiedAt:new Date().toISOString(),target:TARGET,source:'development',tables:tableNames.length,
    migrations:original.migrations.length,elapsedSeconds:Math.round((Date.now()-started)/1000),schemaApprovalSha256:fingerprint,
    verified:['schema definitions (excluding environment-specific ACLs; lossless varchar-array/text-array cast normalization)','all table row counts and fingerprints','live trigger drift probe (rolled back)','booking/coupon concurrency smoke'],
    limitations:['No production recovery or PITR tested','Runtime grants excluded; owner used only in isolated restore','No external emails or integrations exercised']};
  fs.writeFileSync(new URL('./restore-drill-report.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
} catch(error) {
  console.error('Restore drill failed:',error.message?.includes('password')?'details suppressed':error.message);process.exitCode=1;
} finally {
  if(restored)await restored.end();await reader.end();
  if(created) {
    // Constant target, created by this run only. Never drop an existing database.
    await admin.query(`DROP DATABASE ${ident(TARGET)} WITH (FORCE)`);
    console.log('Temporary restore database removed.');
  }
  await admin.end();
  if(archive&&fs.existsSync(archive))fs.unlinkSync(archive);
  if(scratch&&fs.existsSync(path.join(scratch,'roots.pem')))fs.unlinkSync(path.join(scratch,'roots.pem'));
  if(scratch)fs.rmdirSync(scratch);
}

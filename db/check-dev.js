// Development-only baseline check. Recording is explicit and never overwrites a baseline.
const fs=require('fs');
const path=require('path');
const {createHash}=require('crypto');
const {Client}=require('pg');
const {schemaSnapshot,compareSnapshots}=require('./schema-snapshot');
const baselinePath=path.join(__dirname,'dev-schema-baseline.json');
function migrationHashes(dir=path.join(__dirname,'pg-migrations')) {
  return Object.fromEntries(fs.readdirSync(dir).filter(f=>/^\d+.*\.sql$/.test(f)).sort().map(f=>
    [f,createHash('sha256').update(fs.readFileSync(path.join(dir,f),'utf8').replace(/\r\n/g,'\n')).digest('hex')]));
}
function compareHashes(expected,actual,applied) {
  const errors=[];
  for(const [name,hash] of Object.entries(expected)) {
    if(!actual[name]) errors.push(`migration file missing: ${name}`);
    else if(actual[name]!==hash) errors.push(`migration file changed: ${name}`);
  }
  for(const name of applied) {
    if(!actual[name]) errors.push(`applied migration has no local file: ${name}`);
    else if(!expected[name]) errors.push(`applied migration lacks reviewed checksum: ${name}`);
  }
  return errors;
}
function devUrl() {
  if(process.env.VERCEL) throw Error('Development-only command');
  const url=new URL(process.env.DATABASE_URL),prod=new URL(process.env.DATABASE_URL_PRODUCTION);
  if(url.hostname.replace('-pooler.','.')===prod.hostname.replace('-pooler.','.')) throw Error('Development isolation guard failed');
  url.searchParams.set('sslmode','verify-full');
  return url.toString();
}
async function main() {
  const client=new Client({connectionString:devUrl(),connectionTimeoutMillis:10000,statement_timeout:15000});
  try {
    await client.connect();await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const snapshot=await schemaSnapshot(client),hashes=migrationHashes();
    await client.query('ROLLBACK');
    if(process.argv.includes('--record-baseline')) {
      const missing=snapshot.migrations.filter(name=>!hashes[name]);
      if(missing.length) throw Error('Applied migrations missing locally');
      fs.writeFileSync(baselinePath,JSON.stringify({format:1,recordedAt:new Date().toISOString(),
        note:'Observed development baseline; historical applied SQL bytes cannot be proven retroactively.',
        hashes,snapshot},null,2)+'\n',{flag:'wx'});
      console.log('Recorded initial development baseline; no database writes.');return;
    }
    const baseline=JSON.parse(fs.readFileSync(baselinePath,'utf8'));
    const errors=[...compareHashes(baseline.hashes,hashes,snapshot.migrations),...compareSnapshots(baseline.snapshot,snapshot)];
    for(const error of errors)console.error(error);
    if(errors.length)process.exitCode=1;
    else console.log(`Development matches reviewed schema/checksums (${snapshot.migrations.length} migrations). Production not contacted.`);
  }finally{await client.end();}
}
if(require.main===module)main().catch(()=>{console.error('Dev drift check failed; verify baseline/configuration. Connection details suppressed.');process.exitCode=1;});
module.exports={migrationHashes,compareHashes,devUrl};

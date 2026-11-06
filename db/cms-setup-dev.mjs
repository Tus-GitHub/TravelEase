// Apply only the user-approved CMS migration; preserve and advance the reviewed
// dev baseline only if every old schema object remains unchanged. Never prod.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import pg from 'pg';
import { runtimeDatabaseConfig } from '../src/lib/server/db-config.ts';
const require = createRequire(import.meta.url);
const { schemaSnapshot, compareSnapshots } = require('./schema-snapshot.js');
const { migrationHashes, compareHashes } = require('./check-dev.js');
assert(process.argv.includes('--dev') && !process.env.VERCEL, 'Development only');
assert.equal(execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim(), 'development');
const endpoint = value => new URL(value).hostname.replace(/-pooler\./, '.');
const url = new URL(process.env.DATABASE_URL), runtime = new URL(process.env.DATABASE_URL_APP);
assert.equal(endpoint(url), endpoint(runtime));
assert.notEqual(endpoint(url), endpoint(process.env.DATABASE_URL_PRODUCTION));
url.hostname = endpoint(url); // Direct connection for transactional DDL.
const role = decodeURIComponent(runtime.username); assert.equal(role, 'travel_app_dev');
const migration = '028_create_cms_pages.sql';
const baselinePath = new URL('./dev-schema-baseline.json', import.meta.url);
const before = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
const hashes = migrationHashes();
const client = new pg.Client(runtimeDatabaseConfig(url.toString()));
let committed = false;
try {
  await client.connect();
  await client.query('BEGIN');
  const observed = await schemaSnapshot(client);
  await client.query('ROLLBACK');
  assert.deepEqual(compareSnapshots(before.snapshot, observed), [], 'Existing dev schema drift must be resolved first');
  assert.deepEqual(compareHashes(before.hashes, hashes, observed.migrations), [], 'Existing migration bytes must match');
  if (observed.migrations.includes(migration)) { console.log('CMS migration already applied and baseline verified.'); }
  else {
    assert.equal(observed.migrations.length, 27);
    const archive = new URL('./dev-schema-baseline-before-cms.json', import.meta.url);
    if (!fs.existsSync(archive)) fs.writeFileSync(archive, JSON.stringify(before, null, 2) + '\n', { flag: 'wx' });
    else assert.deepEqual(JSON.parse(fs.readFileSync(archive, 'utf8')), before);
    await client.query('BEGIN');
    await client.query(fs.readFileSync(new URL('./pg-migrations/' + migration, import.meta.url), 'utf8'));
    await client.query('INSERT INTO schema_migrations(migration_id) VALUES($1)', [migration]);
    // Narrow operational grants on these approved tables only. Revisions are
    // append-only for runtime; fixture cleanup uses the guarded owner connection.
    await client.query('GRANT SELECT,INSERT,UPDATE,DELETE ON cms_pages TO travel_app_dev');
    await client.query('GRANT SELECT,INSERT ON cms_page_revisions TO travel_app_dev');
    const after = await schemaSnapshot(client);
    assert.deepEqual(after.migrations, [...before.snapshot.migrations, migration]);
    const differences = compareSnapshots({ ...before.snapshot, migrations: after.migrations }, after);
    for (const difference of differences) assert(/^(tables|columns|constraints|indexes|triggers|grants): unexpected (cms_pages\b|cms_pages_|cms_page_revisions\b|cms_page_revisions_|idx_cms_pages_public)/.test(difference), 'Unexpected schema change: ' + difference);
    assert.equal(after.columns.filter(c => c.key.startsWith('cms_pages.')).length, 14);
    assert.equal(after.columns.filter(c => c.key.startsWith('cms_page_revisions.')).length, 6);
    await client.query('COMMIT'); committed = true;
    fs.writeFileSync(baselinePath, JSON.stringify({ ...before, recordedAt: new Date().toISOString(),
      note: before.note + ' Approved migration028 added on development; prior baseline archived; old definitions/checksums unchanged.', hashes, snapshot: after }, null, 2) + '\n');
    console.log('Development migration028 applied: two approved CMS tables, homepage/About snapshots and narrow runtime grants. Prior baseline archived; only reviewed additions recorded. Production not contacted.');
  }
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  console.error(committed ? 'Migration committed; baseline recording failed. Inspect before retrying.' : 'CMS setup aborted or rolled back.');
  console.error(error instanceof assert.AssertionError ? error.message : 'Connection/DDL details suppressed.');
  process.exitCode = 1;
} finally { await client.end(); }

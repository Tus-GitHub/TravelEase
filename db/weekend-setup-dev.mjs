// Only the four tables and six columns explicitly approved in WEEKEND_TRIPS_PLAN.md.
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
assert.equal(decodeURIComponent(runtime.username), 'travel_app_dev');
url.hostname = endpoint(url);
const migration = '029_weekend_trip_departures.sql';
const baselinePath = new URL('./dev-schema-baseline.json', import.meta.url);
const before = JSON.parse(fs.readFileSync(baselinePath, 'utf8')), hashes = migrationHashes();
const tables = { tour_guides: 13, trip_departures: 33, trip_stays: 26, trip_room_assignments: 11 };
const newColumns = ['packages.booking_mode', 'bookings.departure_id', 'bookings.seat_hold_expires_at', 'bookings.client_request_id', 'bookings.trip_snapshot', 'vehicle_availability.departure_id'];
const allowed = difference => {
  if (!difference.includes(': unexpected ')) return false;
  const [kind, key] = difference.split(': unexpected ');
  if (Object.keys(tables).some(table => key === table || key.startsWith(table + '.') || key.startsWith(table + '_') || key.startsWith('idx_' + table) || (kind === 'grants' && [table + ':neondb_owner', table + ':travel_app_dev'].includes(key)))) return true;
  if (kind === 'columns') return newColumns.includes(key);
  return (kind === 'constraints' && (/^(packages|bookings|vehicle_availability)\.weekend_/.test(key) || key === 'packages.packages_booking_mode_not_null')) || (kind === 'indexes' && key.startsWith('idx_weekend_'));
};
const client = new pg.Client(runtimeDatabaseConfig(url.toString()));
let committed = false;
try {
  await client.connect();
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const observed = await schemaSnapshot(client);
  await client.query('ROLLBACK');
  assert.deepEqual(compareSnapshots(before.snapshot, observed), [], 'Resolve pre-existing dev drift first');
  assert.deepEqual(compareHashes(before.hashes, hashes, observed.migrations), [], 'Previously applied SQL must not change');
  if (observed.migrations.includes(migration)) console.log('Weekend migration already applied; reviewed baseline verified.');
  else {
    assert.equal(observed.migrations.length, 28);
    const archive = new URL('./dev-schema-baseline-before-weekend.json', import.meta.url);
    if (!fs.existsSync(archive)) fs.writeFileSync(archive, JSON.stringify(before, null, 2) + '\n', { flag: 'wx' });
    else assert.deepEqual(JSON.parse(fs.readFileSync(archive, 'utf8')), before);
    await client.query('BEGIN');
    await client.query(fs.readFileSync(new URL('./pg-migrations/' + migration, import.meta.url), 'utf8'));
    await client.query('INSERT INTO schema_migrations(migration_id) VALUES($1)', [migration]);
    await client.query('GRANT SELECT,INSERT,UPDATE,DELETE ON tour_guides,trip_departures,trip_stays,trip_room_assignments TO travel_app_dev');
    await client.query('GRANT USAGE,SELECT ON SEQUENCE tour_guides_guide_id_seq TO travel_app_dev');
    const after = await schemaSnapshot(client);
    assert.deepEqual(after.migrations, [...before.snapshot.migrations, migration]);
    for (const difference of compareSnapshots({ ...before.snapshot, migrations: after.migrations }, after)) assert(allowed(difference), 'Unapproved change: ' + difference);
    for (const [table, count] of Object.entries(tables)) assert.equal(after.columns.filter(column => column.key.startsWith(table + '.')).length, count, table);
    assert.deepEqual(after.columns.filter(column => !before.snapshot.columns.some(old => old.key === column.key) && !Object.keys(tables).some(table => column.key.startsWith(table + '.'))).map(column => column.key).sort(), newColumns.sort());
    await client.query('COMMIT'); committed = true;
    fs.writeFileSync(baselinePath, JSON.stringify({ ...before, recordedAt: new Date().toISOString(), note: before.note + ' Approved development migration029; prior28 baseline archived. Four tables/six columns verified.', hashes, snapshot: after }, null, 2) + '\n');
    console.log('Development migration029 applied: four approved tables, six approved columns; prior28 baseline archived. No production connection.');
  }
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  console.error(committed ? 'Migration committed but baseline recording failed; inspect before retry.' : 'Weekend setup aborted/rolled back.');
  console.error(error instanceof assert.AssertionError ? error.message : `Connection/DDL failed (${error.code || 'details suppressed'}).`);
  process.exitCode = 1;
} finally { await client.end(); }

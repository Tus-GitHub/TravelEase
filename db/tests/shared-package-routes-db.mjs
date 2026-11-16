// Real development SQL + catalogue/checkout resolution. Every fixture is rolled back.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import pg from 'pg';
import { runtimeDatabaseConfig } from '../../src/lib/server/db-config.ts';
import { blankPackageContent, validateRouteTree, routeRange } from '../../src/lib/package-content.ts';
import { getPublicPackage, listPublicPackages, toCardPackage } from '../../src/lib/server/catalogue.ts';
import { resolvePrivatePackage } from '../../src/lib/server/package-plan.ts';

assert(process.argv.includes('--dev') && !process.env.VERCEL, 'Run explicitly against local development only.');
const host = value => new URL(value).hostname.replace('-pooler.', '.');
assert.notEqual(host(process.env.DATABASE_URL), host(process.env.DATABASE_URL_PRODUCTION));
const fixture = JSON.parse(readFileSync(new URL('./fixtures/delhi-route.json', import.meta.url), 'utf8'));
const client = new pg.Client(runtimeDatabaseConfig(process.env.DATABASE_URL));
const tag = randomUUID(), cityName = `Owned Delhi routes ${tag}`, slug = `owned-delhi-${tag}`;
let began = false, result;
const originalPool = globalThis.__pgPool;
await client.connect();
try {
  await client.query('BEGIN'); began = true;
  const parent = (await client.query('SELECT s.state_id,s.region_id FROM states s JOIN regions r USING(region_id) WHERE s.is_active AND NOT s.is_deleted AND r.is_active AND NOT r.is_deleted ORDER BY s.state_id LIMIT 1')).rows[0];
  const type = (await client.query('SELECT vehicle_type_id FROM vehicle_types WHERE is_active AND NOT is_deleted ORDER BY vehicle_type_id LIMIT 1')).rows[0];
  assert(parent && type, 'Development needs an active State and vehicle type.');
  const city = (await client.query('INSERT INTO cities(state_id,name,is_pickup_point) VALUES($1,$2,false) RETURNING city_id', [parent.state_id, cityName])).rows[0];
  const inserted = (await client.query('INSERT INTO tourist_spots(city_id,name) SELECT $1,unnest($2::text[]) RETURNING tourist_spot_id,name', [city.city_id, fixture.places.map(place => place.name)])).rows;
  const byName = new Map(inserted.map(spot => [spot.name, spot.tourist_spot_id]));
  const ids = new Map(fixture.places.map(place => [place.id, byName.get(place.name)]));
  const path = values => values.map(id => ids.get(id));
  const tree = validateRouteTree({ roots: path(fixture.tree.roots), nodes: fixture.tree.nodes.map(node => ({ ...node, spotId: ids.get(node.spotId), next: path(node.next) })) });
  const content = { ...blankPackageContent(), summary: 'Owned transactional Delhi test only', guideIncluded: true, inclusions: ['Specified fixture meals'], exclusions: ['Fictional rates; not a live offer'], routeTree: tree };
  const range = routeRange(tree, fixture.basePrice);
  const row = (await client.query(`INSERT INTO packages(region_id,vehicle_type_id,name,slug,duration_days,max_persons,price_per_person,booking_mode,trip_content)
    VALUES($1,$2,$3,$4,$5,6,$6,'private',$7::jsonb) RETURNING package_id`, [parent.region_id, type.vehicle_type_id, 'Owned Delhi shared-route test', slug, range.minDays, fixture.basePrice, JSON.stringify(content)])).rows[0];
  // Public catalogue functions use their normal SQL against this same real transaction.
  // No query result is mocked and no connection outside development is opened.
  globalThis.__pgPool = { query: (...args) => client.query(...args) };
  const publicPlan = await getPublicPackage(slug), listed = (await listPublicPackages()).find(pkg => pkg.id === row.package_id);
  assert(publicPlan?.isGuided && publicPlan.isBookable && listed?.guidedPlan);
  assert.equal(publicPlan.guidedPlan.content.routeTree.nodes.length, 32);
  assert.equal(publicPlan.guidedPlan.content.routeTree.nodes.filter(node => node.next.includes(ids.get(10))).length, 3);
  assert.equal(toCardPackage(listed).guidedPlan.basePricePerPerson, 2000);
  const viaChandigarh = await resolvePrivatePackage({ packageId: row.package_id, guidedPath: path([1, 2, 10]) }, client);
  const viaShimla = await resolvePrivatePackage({ packageId: row.package_id, guidedPath: path([1, 3, 10]) }, client);
  assert.equal(viaChandigarh.pricePerPerson, 2500); assert.equal(viaShimla.pricePerPerson, 2600);
  assert.equal(viaChandigarh.nights, 1); assert.equal(viaChandigarh.snapshot.selectedRoute.meals.breakfast, 1);
  assert.deepEqual(viaChandigarh.snapshot.selectedRoute.stops.map(stop => stop.name), ['Delhi', 'Chandigarh', 'Manali']);
  assert.notEqual(viaChandigarh.fingerprint, viaShimla.fingerprint);
  await assert.rejects(() => resolvePrivatePackage({ packageId: row.package_id, guidedPath: path([1, 10]) }, client));
  result = { package: toCardPackage(listed), detail: publicPlan, places: fixture.places.map(place => ({ id: ids.get(place.id), name: place.name })), fixtureIdToActualId: Object.fromEntries(ids), resolved: { viaChandigarh: { pricePerPerson: viaChandigarh.pricePerPerson, nights: viaChandigarh.nights }, viaShimla: { pricePerPerson: viaShimla.pricePerPerson, nights: viaShimla.nights } } };
  await client.query('UPDATE tourist_spots SET is_active=false WHERE tourist_spot_id=$1', [ids.get(2)]);
  const withoutChandigarh = await getPublicPackage(slug);
  assert(!withoutChandigarh.guidedPlan.destinations.some(spot => spot.id === ids.get(2)));
  assert(withoutChandigarh.guidedPlan.destinations.some(spot => spot.id === ids.get(10)));
  await assert.rejects(() => resolvePrivatePackage({ packageId: row.package_id, guidedPath: path([1, 2, 10]) }, client));
  assert.equal((await resolvePrivatePackage({ packageId: row.package_id, guidedPath: path([1, 3, 10]) }, client)).pricePerPerson, 2600);
  await client.query('UPDATE tourist_spots SET is_active=false WHERE tourist_spot_id=$1', [ids.get(10)]);
  const withoutManali = await getPublicPackage(slug);
  assert(!withoutManali.guidedPlan.destinations.some(spot => path([10, 22, 23, 32]).includes(spot.id)));
  await client.query('UPDATE tourist_spots SET is_active=true WHERE tourist_spot_id=ANY($1::int[])', [path([2, 10])]);
  await client.query('UPDATE packages SET price_per_person=3000 WHERE package_id=$1', [row.package_id]);
  const repriced = await resolvePrivatePackage({ packageId: row.package_id, guidedPath: path([1, 3, 10]) }, client);
  assert.equal(repriced.pricePerPerson, 3600); assert.notEqual(repriced.fingerprint, viaShimla.fingerprint);
  assert.equal(viaShimla.snapshot.selectedRoute.pricePerPerson, 2600);
  console.log('PASS real SQL public32-stop/shared-join catalogue, both trusted route quotes, path/active guards, distinct fingerprints and immutable prior plan.');
} finally {
  if (originalPool === undefined) delete globalThis.__pgPool; else globalThis.__pgPool = originalPool;
  if (began) await client.query('ROLLBACK');
  const leftovers = await client.query('SELECT (SELECT count(*) FROM packages WHERE slug=$1)+(SELECT count(*) FROM cities WHERE name=$2) AS count', [slug, cityName]);
  assert.equal(Number(leftovers.rows[0].count), 0);
  await client.end(); console.log('PASS all transactional fixtures rolled back; no live offer, booking, account or email created.');
}
if (process.env.SHARED_ROUTE_TEST_OUTPUT && result) writeFileSync(process.env.SHARED_ROUTE_TEST_OUTPUT, JSON.stringify(result, null, 2) + '\n');

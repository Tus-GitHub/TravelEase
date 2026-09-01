/*
 * Chunk 1.3 — seed the catalogue / geography / packages / pricing tables from
 * the static `src/data/*.ts` files (plan.md §36). Idempotent: every step is
 * check-then-insert or ON CONFLICT, so re-running only fills gaps and never
 * duplicates or overwrites admin edits.
 *
 *   npm run seed            -> Neon development branch (DATABASE_URL)
 *   npm run seed:prod       -> Neon production branch (DATABASE_URL_PRODUCTION)
 *
 * NOT wired into deploy — the catalogue is admin-editable, so re-seeding on
 * every deploy would resurrect deleted rows. Run it by hand once per branch.
 * `users` is never touched.
 *
 * Interpretation notes (src/data is frontend mock data, not a clean relational
 * set — these are deliberate mappings, see MEMORY.md):
 *   - vehicle types  <- src/data/categories.ts (slug is the key)
 *   - vehicles/images <- src/data/vehicles.ts; `type` string -> type slug
 *   - regions        <- src/data/regions.ts (5 regions)
 *   - cities         <- one hub city per region (the schema needs a city between
 *                       region and spot; src/data has no city layer). lat/lng
 *                       from src/data/destinations.ts where available.
 *   - tourist_spots  <- src/data/regions.ts `spots`, hung off the region hub city
 *   - packages       <- src/data/packages.ts; `region` string -> a real region
 *                       ("North India" -> Rajasthan; "South India" has no match
 *                        -> skipped and logged)
 *   - package_stops  <- package.destinations names matched to tourist_spots by name
 *   - pricing_rules  <- one baseline rule per booking_type (values from plan.md §5)
 */
import { Client } from "pg";
import { categories } from "../src/data/categories.ts";
import { vehicles } from "../src/data/vehicles.ts";
import { regions } from "../src/data/regions.ts";
import { travelPackages } from "../src/data/packages.ts";
import { mapNodes } from "../src/data/destinations.ts";

// vehicles.ts `type` / packages.ts `vehicleType` -> vehicle_types.slug
const TYPE_SLUG = {
  "Tempo Traveller": "tempo-traveller",
  "Luxury Car": "luxury-cars",
  "Family Car": "family-cars",
  "Group Travel": "group-travel",
  "Airport Transfer": "airport-transfer",
};

// one hub city per region id — real anchor city + coords (from destinations.ts where present)
const HUB_CITY = {
  rajasthan: { name: "Jaipur", lat: 26.9124, lng: 75.7873, airport: true },
  kerala: { name: "Kochi", lat: 9.9312, lng: 76.2673, airport: true },
  goa: { name: "Panaji", lat: 15.4909, lng: 73.8278, airport: true },
  himachal: { name: "Manali", lat: 32.2432, lng: 77.1892, airport: false },
  maharashtra: { name: "Mumbai", lat: 19.076, lng: 72.8777, airport: true },
};

// packages.ts `region` string -> regions.ts region name (null => skip the package)
const PACKAGE_REGION = {
  "North India": "Rajasthan", // Golden Triangle — Jaipur anchor
  Rajasthan: "Rajasthan",
  Kerala: "Kerala",
  Goa: "Goa",
  "Himachal Pradesh": "Himachal",
  "South India": null, // Mysore/Coorg/Ooty — no matching region
};

// baseline pricing rules, one per booking_type — plan.md §5 worked-example numbers.
// vehicle_type_id NULL = applies to every vehicle type (admin can add narrower rules).
const PRICING_BASELINES = {
  point_to_point: { name: "Baseline point-to-point", per_km_rate: 14 },
  hourly: {
    name: "Baseline hourly",
    base_amount: 500,
    per_hour_rate: 250,
    included_km: 80,
    extra_km_rate: 18,
    min_hours: 4,
  },
  outstation: {
    name: "Baseline outstation",
    per_km_rate: 13,
    driver_allowance_per_day: 500,
    night_charge: 300,
    min_km: 250,
  },
  package: {
    name: "Baseline multi-day package",
    per_day_rate: 4500,
    driver_allowance_per_day: 500,
    night_charge: 300,
  },
  airport_transfer: { name: "Baseline airport transfer", flat_rate: 1200 },
};
const GST_PERCENT = 5;

async function main() {
  const useProd = process.argv.includes("--production");
  const envVar = useProd ? "DATABASE_URL_PRODUCTION" : "DATABASE_URL";
  const connectionString = process.env[envVar];
  if (!connectionString) throw new Error(`${envVar} is not set (expected in .env.local)`);

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const dbName = (await client.query("SELECT current_database()")).rows[0].current_database;
  console.log(`Seeding catalogue -> ${useProd ? "PRODUCTION" : "development"} branch (${dbName})`);

  // ---- vehicle_types (src/data/categories.ts) --------------------------------
  const typeId = {}; // slug -> id
  for (const c of categories) {
    const r = await client.query(
      `INSERT INTO vehicle_types (slug, title, description, icon_name, image_url, is_active)
       VALUES ($1, $2, $3, $4, $5, true)
       ON CONFLICT (slug) DO UPDATE SET slug = EXCLUDED.slug
       RETURNING vehicle_type_id`,
      [c.slug, c.title, c.description, c.icon, c.imageUrl],
    );
    typeId[c.slug] = r.rows[0].vehicle_type_id;
  }

  // ---- vehicles + vehicle_images (src/data/vehicles.ts) ---------------------
  for (const v of vehicles) {
    const slug = TYPE_SLUG[v.type];
    if (!slug || !typeId[slug]) {
      console.warn(`  ! skipping vehicle "${v.name}" — unknown type "${v.type}"`);
      continue;
    }
    let row = await client.query("SELECT vehicle_id FROM vehicles WHERE name = $1", [v.name]);
    if (!row.rowCount) {
      row = await client.query(
        `INSERT INTO vehicles
           (vehicle_type_id, name, seating_capacity, features, base_price_per_day, rating, is_available)
         VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
         RETURNING vehicle_id`,
        [
          typeId[slug],
          v.name,
          v.seatingCapacity,
          JSON.stringify(v.features ?? []),
          v.pricePerDay,
          v.rating ?? null,
          v.isAvailable ?? true,
        ],
      );
    }
    const vehicleId = row.rows[0].vehicle_id;
    if (v.imageUrl) {
      const has = await client.query(
        "SELECT 1 FROM vehicle_images WHERE vehicle_id = $1 AND image_url = $2",
        [vehicleId, v.imageUrl],
      );
      if (!has.rowCount) {
        await client.query(
          "INSERT INTO vehicle_images (vehicle_id, image_url, is_primary) VALUES ($1, $2, true)",
          [vehicleId, v.imageUrl],
        );
      }
    }
  }

  // ---- regions + hub cities + tourist_spots (src/data/regions.ts) ----------
  const regionId = {}; // region name -> id
  const spotIdByName = {}; // spot name -> tourist_spot_id (for package_stops)
  for (const rg of regions) {
    let row = await client.query(
      "SELECT region_id FROM regions WHERE name = $1 AND state = $2",
      [rg.name, rg.state],
    );
    if (!row.rowCount) {
      row = await client.query(
        "INSERT INTO regions (name, state, image_url, is_active) VALUES ($1, $2, $3, true) RETURNING region_id",
        [rg.name, rg.state, rg.imageUrl ?? null],
      );
    }
    const rId = row.rows[0].region_id;
    regionId[rg.name] = rId;

    const hub = HUB_CITY[rg.id] ?? { name: rg.name, lat: null, lng: null, airport: false };
    let cityRow = await client.query(
      "SELECT city_id FROM cities WHERE region_id = $1 AND name = $2",
      [rId, hub.name],
    );
    if (!cityRow.rowCount) {
      cityRow = await client.query(
        `INSERT INTO cities (region_id, name, latitude, longitude, is_pickup_point, is_airport)
         VALUES ($1, $2, $3, $4, true, $5) RETURNING city_id`,
        [rId, hub.name, hub.lat, hub.lng, hub.airport],
      );
    }
    const cityId = cityRow.rows[0].city_id;

    for (const s of rg.spots ?? []) {
      let spotRow = await client.query(
        "SELECT tourist_spot_id FROM tourist_spots WHERE city_id = $1 AND name = $2",
        [cityId, s.name],
      );
      if (!spotRow.rowCount) {
        spotRow = await client.query(
          `INSERT INTO tourist_spots (city_id, name, tag, description, image_url)
           VALUES ($1, $2, $3, $4, $5) RETURNING tourist_spot_id`,
          [cityId, s.name, s.tag ?? null, s.description ?? null, s.imageUrl ?? null],
        );
      }
      spotIdByName[s.name] = spotRow.rows[0].tourist_spot_id;
    }
  }

  // ---- packages + package_stops (src/data/packages.ts) --------------------
  let seededPackages = 0;
  for (const p of travelPackages) {
    const regionName = PACKAGE_REGION[p.region];
    if (!regionName || !regionId[regionName]) {
      console.warn(`  ! skipping package "${p.name}" — region "${p.region}" has no match`);
      continue;
    }
    const slug = TYPE_SLUG[p.vehicleType];
    if (!slug || !typeId[slug]) {
      console.warn(`  ! skipping package "${p.name}" — unknown vehicle type "${p.vehicleType}"`);
      continue;
    }

    let row = await client.query("SELECT package_id FROM packages WHERE slug = $1", [p.id]);
    if (!row.rowCount) {
      row = await client.query(
        `INSERT INTO packages
           (region_id, vehicle_type_id, name, slug, duration_days, image_url, highlights,
            max_persons, price_per_person, tag, rating, review_count)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12)
         RETURNING package_id`,
        [
          regionId[regionName],
          typeId[slug],
          p.name,
          p.id,
          p.duration,
          p.imageUrl ?? null,
          JSON.stringify(p.highlights ?? []),
          p.maxPersons,
          p.pricePerPerson,
          p.tag ?? null,
          p.rating ?? null,
          p.reviewCount ?? 0,
        ],
      );
    }
    const packageId = row.rows[0].package_id;
    seededPackages++;

    const matched = (p.destinations ?? [])
      .map((name) => ({ name, id: spotIdByName[name] }))
      .filter((d) => d.id);
    const nights = matched.length
      ? Math.max(1, Math.floor((p.duration - 1) / matched.length))
      : 0;
    let order = 1;
    for (const d of matched) {
      const has = await client.query(
        "SELECT 1 FROM package_stops WHERE package_id = $1 AND tourist_spot_id = $2",
        [packageId, d.id],
      );
      if (!has.rowCount) {
        await client.query(
          "INSERT INTO package_stops (package_id, tourist_spot_id, stop_order, nights_here) VALUES ($1, $2, $3, $4)",
          [packageId, d.id, order, nights],
        );
      }
      order++;
    }
  }

  // ---- pricing_rules (baseline per booking_type, plan.md §5) --------------
  const bt = await client.query("SELECT booking_type_id, code FROM booking_types");
  const bookingTypeId = Object.fromEntries(bt.rows.map((r) => [r.code, r.booking_type_id]));
  for (const [code, rule] of Object.entries(PRICING_BASELINES)) {
    const btId = bookingTypeId[code];
    if (!btId) {
      console.warn(`  ! no booking_type "${code}" — skipping its pricing rule`);
      continue;
    }
    const has = await client.query(
      "SELECT 1 FROM pricing_rules WHERE booking_type_id = $1 AND vehicle_type_id IS NULL AND name = $2",
      [btId, rule.name],
    );
    if (!has.rowCount) {
      await client.query(
        `INSERT INTO pricing_rules
           (booking_type_id, vehicle_type_id, name, base_amount, per_km_rate, per_hour_rate,
            included_km, extra_km_rate, per_day_rate, driver_allowance_per_day, night_charge,
            flat_rate, tax_percent, min_hours, min_km, priority, currency)
         VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 0, 'INR')`,
        [
          btId,
          rule.name,
          rule.base_amount ?? 0,
          rule.per_km_rate ?? 0,
          rule.per_hour_rate ?? 0,
          rule.included_km ?? 0,
          rule.extra_km_rate ?? 0,
          rule.per_day_rate ?? 0,
          rule.driver_allowance_per_day ?? 0,
          rule.night_charge ?? 0,
          rule.flat_rate ?? 0,
          GST_PERCENT,
          rule.min_hours ?? null,
          rule.min_km ?? null,
        ],
      );
    }
  }

  const counts = await client.query(`
    SELECT
      (SELECT count(*) FROM vehicle_types)  AS vehicle_types,
      (SELECT count(*) FROM vehicles)       AS vehicles,
      (SELECT count(*) FROM vehicle_images) AS vehicle_images,
      (SELECT count(*) FROM regions)        AS regions,
      (SELECT count(*) FROM cities)         AS cities,
      (SELECT count(*) FROM tourist_spots)  AS tourist_spots,
      (SELECT count(*) FROM packages)       AS packages,
      (SELECT count(*) FROM package_stops)  AS package_stops,
      (SELECT count(*) FROM booking_types)  AS booking_types,
      (SELECT count(*) FROM pricing_rules)  AS pricing_rules
  `);
  console.log(`Packages seeded/kept: ${seededPackages}/${travelPackages.length}`);
  console.log("Row counts:", counts.rows[0]);
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

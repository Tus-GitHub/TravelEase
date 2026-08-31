/*
 * Dev-only demo seed for the catalogue / geography / package tables so the admin
 * panel isn't empty. Idempotent — safe to re-run; inserts only what's missing.
 *
 *   node --env-file=.env.local db/seed-catalog.js
 *
 * NOT wired into deploy. Do not run against production. The `users` table is
 * left untouched (real signups only).
 */
const { Client } = require("pg");

const VEHICLE_TYPES = [
  { key: "tempo-traveller", slug: "tempo-traveller", title: "Tempo Traveller", description: "Spacious 12-26 seaters for group trips", active: true },
  { key: "sedan", slug: "sedan", title: "Sedan", description: "Comfortable 4-seaters for city rides", active: true },
  { key: "suv", slug: "suv", title: "SUV", description: "7-seater SUVs for family trips", active: true },
  { key: "luxury-car", slug: "luxury-car", title: "Luxury Car", description: "Premium chauffeur-driven cars", active: true },
  { key: "group-travel", slug: "group-travel", title: "Group Travel", description: "Large coaches for 26+ passengers", active: false },
];

const VEHICLES = [
  { typeKey: "tempo-traveller", name: "Tempo Traveller 17-Seater", reg: "KA01AB1234", seats: 17, features: ["AC", "Pushback Seats", "Music System"], price: 6800, available: true },
  { typeKey: "sedan", name: "Honda City", reg: "MH12CD5678", seats: 4, features: ["AC", "Bluetooth"], price: 3200, available: true },
  { typeKey: "suv", name: "Mahindra Scorpio", reg: "DL05EF9012", seats: 7, features: ["AC", "Spacious Boot"], price: 4600, available: false },
  { typeKey: "luxury-car", name: "BMW 5 Series", reg: "KA03GH3456", seats: 4, features: ["Chauffeur", "Leather Seats", "Wi-Fi"], price: 11500, available: true },
  { typeKey: "tempo-traveller", name: "Force Traveller 12-Seater", reg: "TN09IJ7890", seats: 12, features: ["AC", "LED TV"], price: 5400, available: true },
];

const REGIONS = [
  { key: "coorg", name: "Coorg", state: "Karnataka", active: true },
  { key: "ladakh", name: "Ladakh", state: "Ladakh", active: true },
  { key: "udaipur", name: "Udaipur", state: "Rajasthan", active: true },
  { key: "andaman", name: "Andaman", state: "Andaman & Nicobar", active: true },
  { key: "rishikesh", name: "Rishikesh", state: "Uttarakhand", active: false },
];

const CITIES = [
  { key: "madikeri", regionKey: "coorg", name: "Madikeri", lat: 12.4244, lng: 75.7382, pickup: true, airport: false },
  { key: "leh", regionKey: "ladakh", name: "Leh", lat: 34.1526, lng: 77.5771, pickup: true, airport: true },
  { key: "udaipur-city", regionKey: "udaipur", name: "Udaipur City", lat: 24.5854, lng: 73.7125, pickup: true, airport: true },
  { key: "port-blair", regionKey: "andaman", name: "Port Blair", lat: 11.6234, lng: 92.7265, pickup: true, airport: true },
  { key: "rishikesh-town", regionKey: "rishikesh", name: "Rishikesh Town", lat: 30.0869, lng: 78.2676, pickup: false, airport: false },
];

const SPOTS = [
  { key: "abbey-falls", cityKey: "madikeri", name: "Abbey Falls", tag: "Waterfall" },
  { key: "rajas-seat", cityKey: "madikeri", name: "Raja's Seat", tag: "Viewpoint" },
  { key: "pangong", cityKey: "leh", name: "Pangong Lake", tag: "Lake" },
  { key: "city-palace", cityKey: "udaipur-city", name: "City Palace", tag: "Heritage" },
  { key: "lake-pichola", cityKey: "udaipur-city", name: "Lake Pichola", tag: "Lake" },
  { key: "radhanagar", cityKey: "port-blair", name: "Radhanagar Beach", tag: "Beach" },
];

const PACKAGES = [
  { slug: "coorg-coffee-trail", regionKey: "coorg", typeKey: "suv", name: "Coorg Coffee Trail", days: 4, maxP: 6, price: 8200, tag: "Best Value", rating: 4.7,
    stops: [{ spotKey: "abbey-falls", order: 1, nights: 1 }, { spotKey: "rajas-seat", order: 2, nights: 2 }] },
  { slug: "ladakh-bike-expedition", regionKey: "ladakh", typeKey: "tempo-traveller", name: "Ladakh Bike Expedition", days: 9, maxP: 10, price: 24500, tag: "Adventure", rating: 4.8,
    stops: [{ spotKey: "pangong", order: 1, nights: 3 }] },
  { slug: "udaipur-royal-retreat", regionKey: "udaipur", typeKey: "luxury-car", name: "Udaipur Royal Retreat", days: 5, maxP: 4, price: 18999, tag: "Premium", rating: 4.9,
    stops: [{ spotKey: "city-palace", order: 1, nights: 2 }, { spotKey: "lake-pichola", order: 2, nights: 2 }] },
  { slug: "andaman-island-hopper", regionKey: "andaman", typeKey: "suv", name: "Andaman Island Hopper", days: 6, maxP: 8, price: 21000, tag: "Popular", rating: 4.6,
    stops: [{ spotKey: "radhanagar", order: 1, nights: 3 }] },
  { slug: "rishikesh-weekend-escape", regionKey: "rishikesh", typeKey: "sedan", name: "Rishikesh Weekend Escape", days: 3, maxP: 4, price: 5499, tag: "Popular", rating: 4.5, stops: [] },
];

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const label = (await client.query("SELECT current_database()")).rows[0].current_database;
  console.log("Seeding catalogue into:", label);

  const vt = {};
  for (const t of VEHICLE_TYPES) {
    const r = await client.query(
      `INSERT INTO vehicle_types (slug, title, description, is_active)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (slug) DO UPDATE SET slug = EXCLUDED.slug
       RETURNING vehicle_type_id`,
      [t.slug, t.title, t.description, t.active],
    );
    vt[t.key] = r.rows[0].vehicle_type_id;
  }

  for (const v of VEHICLES) {
    const exists = await client.query("SELECT 1 FROM vehicles WHERE name = $1", [v.name]);
    if (exists.rowCount) continue;
    await client.query(
      `INSERT INTO vehicles (vehicle_type_id, name, registration_number, seating_capacity, features, base_price_per_day, is_available)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)`,
      [vt[v.typeKey], v.name, v.reg, v.seats, JSON.stringify(v.features), v.price, v.available],
    );
  }

  const reg = {};
  for (const rg of REGIONS) {
    let row = await client.query(
      "SELECT region_id FROM regions WHERE name = $1 AND state = $2",
      [rg.name, rg.state],
    );
    if (!row.rowCount) {
      row = await client.query(
        "INSERT INTO regions (name, state, is_active) VALUES ($1, $2, $3) RETURNING region_id",
        [rg.name, rg.state, rg.active],
      );
    }
    reg[rg.key] = row.rows[0].region_id;
  }

  const city = {};
  for (const c of CITIES) {
    let row = await client.query(
      "SELECT city_id FROM cities WHERE region_id = $1 AND name = $2",
      [reg[c.regionKey], c.name],
    );
    if (!row.rowCount) {
      row = await client.query(
        `INSERT INTO cities (region_id, name, latitude, longitude, is_pickup_point, is_airport)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING city_id`,
        [reg[c.regionKey], c.name, c.lat, c.lng, c.pickup, c.airport],
      );
    }
    city[c.key] = row.rows[0].city_id;
  }

  const spot = {};
  for (const s of SPOTS) {
    let row = await client.query(
      "SELECT tourist_spot_id FROM tourist_spots WHERE city_id = $1 AND name = $2",
      [city[s.cityKey], s.name],
    );
    if (!row.rowCount) {
      row = await client.query(
        "INSERT INTO tourist_spots (city_id, name, tag) VALUES ($1, $2, $3) RETURNING tourist_spot_id",
        [city[s.cityKey], s.name, s.tag],
      );
    }
    spot[s.key] = row.rows[0].tourist_spot_id;
  }

  for (const p of PACKAGES) {
    let row = await client.query("SELECT package_id FROM packages WHERE slug = $1", [p.slug]);
    if (!row.rowCount) {
      row = await client.query(
        `INSERT INTO packages
           (region_id, vehicle_type_id, name, slug, duration_days, max_persons, price_per_person, tag, rating, highlights)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, '[]'::jsonb)
         RETURNING package_id`,
        [reg[p.regionKey], vt[p.typeKey], p.name, p.slug, p.days, p.maxP, p.price, p.tag, p.rating],
      );
    }
    const packageId = row.rows[0].package_id;
    for (const st of p.stops) {
      const has = await client.query(
        "SELECT 1 FROM package_stops WHERE package_id = $1 AND tourist_spot_id = $2",
        [packageId, spot[st.spotKey]],
      );
      if (!has.rowCount) {
        await client.query(
          "INSERT INTO package_stops (package_id, tourist_spot_id, stop_order, nights_here) VALUES ($1, $2, $3, $4)",
          [packageId, spot[st.spotKey], st.order, st.nights],
        );
      }
    }
  }

  const counts = await client.query(`
    SELECT
      (SELECT count(*) FROM vehicle_types)  AS vehicle_types,
      (SELECT count(*) FROM vehicles)       AS vehicles,
      (SELECT count(*) FROM regions)        AS regions,
      (SELECT count(*) FROM cities)         AS cities,
      (SELECT count(*) FROM tourist_spots)  AS tourist_spots,
      (SELECT count(*) FROM packages)       AS packages,
      (SELECT count(*) FROM package_stops)  AS package_stops
  `);
  console.log("Row counts:", counts.rows[0]);
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

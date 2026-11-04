/*
 * DB CRUD integrity harness — insertion / update / deletion, against the Neon
 * `development` branch (whatever `.env.local` DATABASE_URL points at).
 *
 * Run:  npm run test:db      (see package.json)
 * or:   node --experimental-strip-types --import ./db/tests/_register.mjs \
 *            --env-file=.env.local db/tests/db-crud.test.ts
 *
 * SAFETY: the whole run happens inside ONE transaction that is ROLLBACK'd at the
 * end, and every individual test is wrapped in a SAVEPOINT that is rolled back
 * afterwards. Nothing is ever committed — the database is left byte-for-byte
 * unchanged. It still needs a live connection because it exercises real
 * constraints, triggers and cascades.
 *
 * Output: prints a summary and writes db/tests/DB_TEST_REPORT.md.
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import pg from "pg";

// ── fake pool: route every server-module query through our single txn client ──
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set (pass --env-file=.env.local)");
  process.exit(2);
}
const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
await client.connect();
await client.query("BEGIN");
const rawQuery = (...a: unknown[]) => (client.query as (...x: unknown[]) => unknown)(...a);
(globalThis as unknown as { __pgPool?: unknown }).__pgPool = {
  query: rawQuery,
  // Server code that opens its own transaction (createTicket, createBooking, …)
  // gets a client sharing this single txn connection; its BEGIN/COMMIT/ROLLBACK
  // are swallowed so the outer per-test SAVEPOINT keeps control of rollback.
  connect: async () => ({
    query: (...a: unknown[]) => {
      const sql = typeof a[0] === "string" ? a[0].trim().toUpperCase() : "";
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
        return Promise.resolve({ rows: [], rowCount: 0 });
      }
      return rawQuery(...a);
    },
    release: () => {},
  }),
  end: async () => {},
};

// ── now import the app modules (they pick up the fake pool via getPool()) ──
const fleet = await import("../../src/lib/server/admin/fleet.ts");
const geo = await import("../../src/lib/server/admin/geography.ts");
const cat = await import("../../src/lib/server/admin/catalog.ts");
const adminUsers = await import("../../src/lib/server/admin/users.ts");
const perms = await import("../../src/lib/server/admin/permissions.ts");
const users = await import("../../src/lib/server/users.ts");
const profile = await import("../../src/lib/server/customer-profile.ts");
const dbErrors = await import("../../src/lib/server/db-errors.ts");
const saved = await import("../../src/lib/server/saved-itineraries.ts");
const support = await import("../../src/lib/server/support-tickets.ts");
const activity = await import("../../src/lib/server/activity-log.ts");
const refunds = await import("../../src/lib/server/refunds.ts");
const analytics = await import("../../src/lib/server/admin/analytics.ts");
const vendors = await import("../../src/lib/server/admin/vendors.ts");
const siteSettings = await import("../../src/lib/server/site-settings.ts");

const ACTOR: string = (await client.query("SELECT user_id FROM users ORDER BY created_at LIMIT 1")).rows[0]?.user_id;
if (!ACTOR) {
  console.error("no users in the target DB — need at least one row for created_by/updated_by FKs");
  process.exit(2);
}

// ── tiny test framework ──
type Status = "PASS" | "FAIL";
interface Case {
  id: string;
  group: string;
  name: string;
  intent: string;
  fn: () => Promise<void>;
  status?: Status;
  detail?: string;
}
const cases: Case[] = [];
const t = (id: string, group: string, name: string, intent: string, fn: () => Promise<void>) =>
  cases.push({ id, group, name, intent, fn });

function ok(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}
function eq(actual: unknown, expected: unknown, msg: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${msg} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}
async function rejects(fn: () => Promise<unknown>, pred: (e: any) => boolean, label: string): Promise<any> {
  try {
    await fn();
  } catch (e) {
    if (pred(e)) return e;
    throw new Error(`${label}: threw the wrong error → code=${(e as any)?.code} name=${(e as any)?.name} msg=${(e as any)?.message}`);
  }
  throw new Error(`${label}: expected it to throw, but it resolved`);
}
const uniq = () => randomUUID().slice(0, 8);

// ── fixtures ──
const mkVehicleType = (over: Partial<{ slug: string; title: string; description: string }> = {}) =>
  fleet.createVehicleType({ slug: `vt-${uniq()}`, title: `Type ${uniq()}`, description: "d", ...over }, ACTOR);
const mkVehicle = (vehicleTypeId: number, over: Partial<any> = {}) =>
  fleet.createVehicle(
    { vehicleTypeId, name: `Car ${uniq()}`, registrationNumber: "", seatingCapacity: 4, features: ["AC"], basePricePerDay: 1000, ...over },
    ACTOR,
  );
const mkRegion = () => geo.createRegion({ name: `Region ${uniq()}`, state: "State" }, ACTOR);
const mkCity = (regionId: number) =>
  geo.createCity({ regionId, name: `City ${uniq()}`, latitude: null, longitude: null, isPickupPoint: true, isAirport: false }, ACTOR);
const mkSpot = (cityId: number) =>
  geo.createTouristSpot({ cityId, name: `Spot ${uniq()}`, tag: "Heritage", description: "" }, ACTOR);
const mkPackage = (regionId: number, vehicleTypeId: number) =>
  cat.createPackage({ regionId, vehicleTypeId, name: `Pkg ${uniq()}`, durationDays: 3, maxPersons: 6, pricePerPerson: 5000, tag: "", rating: null }, ACTOR);
const mkUser = (over: Partial<{ email: string }> = {}) =>
  users.createUser(`User ${uniq()}`, over.email ?? `t-${uniq()}@example.test`, "9999999999", "password123");

// ═══════════════════════ INSERTION ═══════════════════════
t("I1", "Insertion", "createVehicleType inserts and auto-numbers display_order", "A fresh row comes back with a positive display_order set by the BEFORE INSERT trigger.", async () => {
  const vt = await mkVehicleType();
  ok(vt.id > 0, "no id returned");
  ok(vt.displayOrder >= 1, `display_order not auto-assigned (${vt.displayOrder})`);
});

t("I2", "Insertion", "createVehicle round-trips JSONB features as an array", "features written via $5::jsonb should come back as string[], not a string.", async () => {
  const vt = await mkVehicleType();
  const v = await mkVehicle(vt.id, { features: ["AC", "GPS", "Music"] });
  ok(Array.isArray(v.features), "features is not an array");
  eq(v.features, ["AC", "GPS", "Music"], "features content");
});

t("I3", "Insertion", "createVehicle with a non-existent vehicleTypeId is rejected", "The FK to vehicle_types must fire (Postgres 23503), so the route can map it to 400.", async () => {
  await rejects(() => mkVehicle(2_000_000_000), dbErrors.isForeignKeyViolation, "createVehicle bad FK");
});

t("I4", "Insertion", "duplicate vehicle-type slug is rejected", "The UNIQUE(slug) constraint must fire (23505) so the route can map it to 409.", async () => {
  const slug = `vt-dup-${uniq()}`;
  await mkVehicleType({ slug });
  await rejects(() => mkVehicleType({ slug }), dbErrors.isUniqueViolation, "duplicate slug");
});

t("I5", "Insertion", "region → city → tourist-spot chain inserts and resolves names", "The geography hierarchy inserts cleanly and each level resolves its parent name.", async () => {
  const r = await mkRegion();
  const c = await mkCity(r.id);
  const s = await mkSpot(c.id);
  eq(c.regionName, r.name, "city.regionName");
  eq(s.cityName, c.name, "spot.cityName");
});

t("I6", "Insertion", "createCity with a bad regionId is rejected", "cities.region_id FK must fire (23503).", async () => {
  await rejects(() => mkCity(2_000_000_000), dbErrors.isForeignKeyViolation, "createCity bad FK");
});

t("I7", "Insertion", "signup: second account with the same email is rejected", "users.email UNIQUE must fire (23505) even if the app-level pre-check is bypassed by a race.", async () => {
  const email = `race-${uniq()}@example.test`;
  await mkUser({ email });
  const pre = await users.findUserByEmail(email);
  ok(pre, "pre-check findUserByEmail should see the first account");
  await rejects(() => mkUser({ email }), dbErrors.isUniqueViolation, "duplicate email");
});

t("I8", "Insertion", "addPackageStop with a bad touristSpotId is rejected", "package_stops.tourist_spot_id FK must fire (23503).", async () => {
  const r = await mkRegion();
  const vt = await mkVehicleType();
  const p = await mkPackage(r.id, vt.id);
  await rejects(
    () => cat.addPackageStop(p.id, { touristSpotId: 2_000_000_000, stopOrder: 1, nightsHere: 1 }, ACTOR),
    dbErrors.isForeignKeyViolation,
    "addPackageStop bad FK",
  );
});

// ═══════════════════════ UPDATE ═══════════════════════
t("U1", "Update", "partial update touches only the given column and stamps the audit trail", "updateVehicleType({title}) leaves slug/description alone, sets updated_by, and the updated_at trigger is installed and fires.", async () => {
  const vt = await mkVehicleType({ slug: `keep-${uniq()}`, description: "keep me" });
  // Prove the row was created by someone else first, so 'updated_by = ACTOR' is meaningful.
  await client.query("UPDATE vehicle_types SET updated_by = NULL WHERE vehicle_type_id = $1", [vt.id]);
  const updated = await fleet.updateVehicleType(vt.id, { title: "New Title" }, ACTOR);
  ok(updated, "update returned null");
  eq(updated!.slug, vt.slug, "slug should be unchanged");
  eq(updated!.description, "keep me", "description should be unchanged");
  eq(updated!.title, "New Title", "title should be updated");
  const row = (await client.query(
    "SELECT updated_by, updated_at, created_at FROM vehicle_types WHERE vehicle_type_id=$1",
    [vt.id],
  )).rows[0];
  eq(row.updated_by, ACTOR, "updated_by not stamped with the acting admin");
  ok(new Date(row.updated_at) >= new Date(row.created_at), "updated_at is before created_at");
  const trg = (await client.query(
    "SELECT 1 FROM pg_trigger WHERE tgname = 'trg_vehicle_types_updated_at' AND NOT tgisinternal",
  )).rowCount;
  ok(trg === 1, "the updated_at trigger is not installed on vehicle_types");
});

t("U2", "Update", "updating a slug to one already taken is rejected", "updateVehicleType must surface the UNIQUE(slug) violation (23505), not a generic failure.", async () => {
  const a = await mkVehicleType({ slug: `a-${uniq()}` });
  const b = await mkVehicleType({ slug: `b-${uniq()}` });
  await rejects(() => fleet.updateVehicleType(b.id, { slug: a.slug }, ACTOR), dbErrors.isUniqueViolation, "slug collision on update");
});

t("U3", "Update", "re-pointing a city at a non-existent region is rejected", "updateCity({regionId}) must surface the FK violation (23503) so the [id] route returns 400 not 500.", async () => {
  const r = await mkRegion();
  const c = await mkCity(r.id);
  await rejects(() => geo.updateCity(c.id, { regionId: 2_000_000_000 }, ACTOR), dbErrors.isForeignKeyViolation, "updateCity bad FK");
});

t("U4", "Update", "updateVehicle rewrites JSONB features correctly", "features passed to the generic partial-update path must land as a JSONB array, not a quoted string.", async () => {
  const vt = await mkVehicleType();
  const v = await mkVehicle(vt.id, { features: ["AC"] });
  const updated = await fleet.updateVehicle(v.id, { features: ["AC", "Sunroof"] }, ACTOR);
  ok(updated, "update returned null");
  ok(Array.isArray(updated!.features), "features came back as a non-array");
  eq(updated!.features, ["AC", "Sunroof"], "features content after update");
  const raw = (await client.query("SELECT jsonb_typeof(features) AS ty FROM vehicles WHERE vehicle_id=$1", [v.id])).rows[0].ty;
  eq(raw, "array", "stored features jsonb_typeof");
});

t("U5", "Update", "updating a non-existent row returns null (no throw)", "updateRegion on a missing id resolves to null so the route can answer 404.", async () => {
  const res = await geo.updateRegion(2_000_000_000, { name: "x" }, ACTOR);
  eq(res, null, "expected null for missing row");
});

t("U6", "Update", "empty patch on an existing row is a no-op, not an error", "updateVehicleType(id, {}) returns the unchanged row.", async () => {
  const vt = await mkVehicleType();
  const res = await fleet.updateVehicleType(vt.id, {}, ACTOR);
  ok(res, "empty patch returned null");
  eq(res!.id, vt.id, "same row back");
});

t("U7", "Update", "setUserRole with a malformed (non-UUID) id returns null", "It must not blow up on the uuid cast (22P02 → 500); an unknown id is simply 'not found'.", async () => {
  const res = await adminUsers.setUserRole("not-a-uuid", "agent");
  eq(res, null, "expected null for a non-uuid id");
});

t("U8", "Update", "setUserRole on a real user actually changes the role", "Happy path still works after the guard is added.", async () => {
  const u = await mkUser();
  const res = await adminUsers.setUserRole(u.id, "agent");
  ok(res, "setUserRole returned null for a real user");
  eq(res!.role, "agent", "role not changed");
});

// ═══════════════════════ DELETION ═══════════════════════
t("D1", "Deletion", "deleting a leaf vehicle-type soft-deletes it and shifts siblings", "It vanishes from listVehicleTypes and the following sibling's display_order drops by 1.", async () => {
  const a = await mkVehicleType();
  const b = await mkVehicleType();
  ok(b.displayOrder === a.displayOrder + 1, `siblings not consecutive (${a.displayOrder}, ${b.displayOrder})`);
  const done = await fleet.deleteVehicleType(a.id, ACTOR);
  eq(done, true, "delete returned false");
  const list = await fleet.listVehicleTypes();
  ok(!list.some((x) => x.id === a.id), "soft-deleted type still listed");
  const bAfter = list.find((x) => x.id === b.id)!;
  eq(bAfter.displayOrder, a.displayOrder, "sibling display_order did not shift down");
});

t("D2", "Deletion", "a vehicle-type with an active vehicle cannot be deleted", "Refuses with a DependentRowsError instead of silently orphaning the vehicle under a deleted type.", async () => {
  const vt = await mkVehicleType();
  await mkVehicle(vt.id);
  await rejects(() => fleet.deleteVehicleType(vt.id, ACTOR), (e) => e instanceof dbErrors.DependentRowsError, "delete type with child");
  const still = await fleet.listVehicleTypes();
  ok(still.some((x) => x.id === vt.id), "type should still be present after a refused delete");
});

t("D3", "Deletion", "a region with an active city cannot be deleted", "Same guard for the geography tree.", async () => {
  const r = await mkRegion();
  await mkCity(r.id);
  await rejects(() => geo.deleteRegion(r.id, ACTOR), (e) => e instanceof dbErrors.DependentRowsError, "delete region with child");
});

t("D4", "Deletion", "a city with an active tourist-spot cannot be deleted", "Same guard, next level down.", async () => {
  const r = await mkRegion();
  const c = await mkCity(r.id);
  await mkSpot(c.id);
  await rejects(() => geo.deleteCity(c.id, ACTOR), (e) => e instanceof dbErrors.DependentRowsError, "delete city with child");
});

t("D5", "Deletion", "deleting a region/city is allowed once its children are gone", "The guard is not a permanent lock — removing the child frees the parent.", async () => {
  const r = await mkRegion();
  const c = await mkCity(r.id);
  eq(await geo.deleteCity(c.id, ACTOR), true, "child delete failed");
  eq(await geo.deleteRegion(r.id, ACTOR), true, "parent delete should now succeed");
});

t("D6", "Deletion", "deleting a package also soft-deletes its stops", "Stops are part of the package (composition) — they must not be left behind pointing at a deleted package.", async () => {
  const r = await mkRegion();
  const vt = await mkVehicleType();
  const c = await mkCity(r.id);
  const s = await mkSpot(c.id);
  const p = await mkPackage(r.id, vt.id);
  await cat.addPackageStop(p.id, { touristSpotId: s.id, stopOrder: 1, nightsHere: 1 }, ACTOR);
  eq(await cat.deletePackage(p.id, ACTOR), true, "package delete failed");
  const live = (await client.query("SELECT count(*)::int n FROM package_stops WHERE package_id=$1 AND is_deleted=false", [p.id])).rows[0].n;
  eq(live, 0, "package still has live stops after delete");
});

t("D7", "Deletion", "deletePackageStop soft-deletes one stop and reports its package", "And the remaining stop's stop_order shifts down.", async () => {
  const r = await mkRegion();
  const vt = await mkVehicleType();
  const c = await mkCity(r.id);
  const s1 = await mkSpot(c.id);
  const s2 = await mkSpot(c.id);
  const p = await mkPackage(r.id, vt.id);
  await cat.addPackageStop(p.id, { touristSpotId: s1.id, stopOrder: 1, nightsHere: 1 }, ACTOR);
  await cat.addPackageStop(p.id, { touristSpotId: s2.id, stopOrder: 2, nightsHere: 1 }, ACTOR);
  const pkgOf = async () => (await cat.listPackages()).find((x) => x.id === p.id)!;
  const stops = (await pkgOf()).stops;
  const res = await cat.deletePackageStop(stops[0].id, ACTOR);
  ok(res, "deletePackageStop returned null");
  eq(res!.packageId, p.id, "wrong packageId reported");
  const after = (await pkgOf()).stops;
  eq(after.length, 1, "expected one stop left");
  eq(after[0].stopOrder, 1, "remaining stop_order did not shift to 1");
});

t("D8", "Deletion", "double soft-delete is a safe no-op the second time", "deleteVehicle twice → true then false, never an error.", async () => {
  const vt = await mkVehicleType();
  const v = await mkVehicle(vt.id);
  eq(await fleet.deleteVehicle(v.id, ACTOR), true, "first delete");
  eq(await fleet.deleteVehicle(v.id, ACTOR), false, "second delete should report false");
});

t("D9", "Deletion", "hard delete of a vehicle cascades to vehicle_images", "Schema-level ON DELETE CASCADE sanity (raw SQL — no app path does this yet).", async () => {
  const vt = await mkVehicleType();
  const v = await mkVehicle(vt.id);
  await client.query("INSERT INTO vehicle_images (vehicle_id, image_url) VALUES ($1,'http://x/y.jpg')", [v.id]);
  await client.query("DELETE FROM vehicles WHERE vehicle_id=$1", [v.id]);
  const imgs = (await client.query("SELECT count(*)::int n FROM vehicle_images WHERE vehicle_id=$1", [v.id])).rows[0].n;
  eq(imgs, 0, "child vehicle_images not cascaded");
});

t("D10", "Deletion", "addPackageStop against a soft-deleted package inserts nothing", "It returns null (→ route 404) WITHOUT leaving an orphan stop row behind.", async () => {
  const r = await mkRegion();
  const vt = await mkVehicleType();
  const c = await mkCity(r.id);
  const s = await mkSpot(c.id);
  const p = await mkPackage(r.id, vt.id);
  await cat.deletePackage(p.id, ACTOR);
  const res = await cat.addPackageStop(p.id, { touristSpotId: s.id, stopOrder: 1, nightsHere: 1 }, ACTOR);
  eq(res, null, "expected null for a soft-deleted package");
  const rows = (await client.query("SELECT count(*)::int n FROM package_stops WHERE package_id=$1", [p.id])).rows[0].n;
  eq(rows, 0, "an orphan package_stops row was inserted");
});

// ═══════════════════════ ACCOUNT DELETION ═══════════════════════
// Self-service DELETE /api/profile → users.deleteAccount(userId).
const mkUserWith = async () => {
  const email = `del-${uniq()}@example.test`;
  const u = await users.createUser(`User ${uniq()}`, email, "9999999999", "password123");
  return { u, email, password: "password123" };
};

t("DA1", "AccountDeletion", "deleteAccount soft-deletes the row and scrubs the PII", "is_deleted/is_active flip, name/phone are wiped, password_hash becomes unusable, and the email is freed to a deleted+<id>@deleted.invalid placeholder.", async () => {
  const { u } = await mkUserWith();
  eq(await users.deleteAccount(u.id), true, "deleteAccount returned false for a live account");
  const row = (await client.query(
    "SELECT is_deleted, is_active, name, phone, email, password_hash FROM users WHERE user_id = $1",
    [u.id],
  )).rows[0];
  eq(row.is_deleted, true, "is_deleted not set");
  eq(row.is_active, false, "is_active not cleared");
  eq(row.name, "Deleted account", "name not scrubbed");
  eq(row.phone, "", "phone not scrubbed");
  eq(row.email, `deleted+${u.id}@deleted.invalid`, "email not mangled to the freed placeholder");
  ok(!row.password_hash.includes(":"), "password_hash still looks usable");
});

t("DA2", "AccountDeletion", "deleteAccount removes the customer_profiles row entirely", "Address, map location and preferred tags are gone, not just hidden.", async () => {
  const { u } = await mkUserWith();
  await profile.upsertCustomerProfile(u.id, {
    addressLine1: "1 St", addressLine2: "", city: "Jaipur", state: "RJ", pincode: "302017",
    latitude: 26.9, longitude: 75.8, preferredTags: ["Heritage", "Desert"],
  });
  await users.deleteAccount(u.id);
  const n = (await client.query("SELECT count(*)::int n FROM customer_profiles WHERE user_id = $1", [u.id])).rows[0].n;
  eq(n, 0, "customer_profiles row survived the delete");
});

t("DA3", "AccountDeletion", "deleteAccount kills every session for the user", "Signed out everywhere, immediately.", async () => {
  const { u } = await mkUserWith();
  const tok = () => randomUUID();
  await client.query("INSERT INTO sessions (token, user_id, expires_at) VALUES ($1,$2, now() + interval '1 day')", [tok(), u.id]);
  await client.query("INSERT INTO sessions (token, user_id, expires_at) VALUES ($1,$2, now() + interval '1 day')", [tok(), u.id]);
  await users.deleteAccount(u.id);
  const n = (await client.query("SELECT count(*)::int n FROM sessions WHERE user_id = $1", [u.id])).rows[0].n;
  eq(n, 0, "sessions survived the delete");
});

t("DA4", "AccountDeletion", "a deleted account is invisible to the lookup helpers", "findUserById / findUserByEmail (original address) both return nothing.", async () => {
  const { u, email } = await mkUserWith();
  await users.deleteAccount(u.id);
  eq(await users.findUserById(u.id), undefined, "findUserById still returns the deleted row");
  eq(await users.findUserByEmail(email), undefined, "findUserByEmail still resolves the original address");
});

t("DA5", "AccountDeletion", "a deleted account cannot log in", "verifyCredentials with the original email + password → null.", async () => {
  const { u, email, password } = await mkUserWith();
  ok(await users.verifyCredentials(email, password), "sanity: the account logs in before deletion");
  await users.deleteAccount(u.id);
  eq(await users.verifyCredentials(email, password), null, "deleted account still authenticates");
});

t("DA6", "AccountDeletion", "the freed email can be registered again as a fresh account", "Re-signup with the same address succeeds and yields a brand-new id.", async () => {
  const { u, email } = await mkUserWith();
  await users.deleteAccount(u.id);
  const again = await users.createUser("New Person", email, "8888888888", "different-pw");
  ok(again.id && again.id !== u.id, "re-signup did not create a new distinct account");
  eq(again.email, email, "re-signup didn't take the original email");
});

t("DA7", "AccountDeletion", "deleteAccount is idempotent-safe", "Second call on an already-deleted account returns false, no error.", async () => {
  const { u } = await mkUserWith();
  eq(await users.deleteAccount(u.id), true, "first delete");
  eq(await users.deleteAccount(u.id), false, "second delete should report false");
});

t("DA8", "AccountDeletion", "deleteAccount on an unknown id returns false", "No row matched → nothing happens.", async () => {
  eq(await users.deleteAccount(randomUUID()), false, "expected false for a non-existent user");
});

t("DA9", "AccountDeletion", "deleteAccount purges outstanding auth tokens", "email_verification_tokens + password_reset_tokens rows for the user are removed.", async () => {
  const { u } = await mkUserWith();
  const h = "0".repeat(64);
  await client.query("INSERT INTO email_verification_tokens (user_id, token_hash, expires_at) VALUES ($1,$2, now() + interval '1 day')", [u.id, h]);
  await client.query("INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1,$2, now() + interval '1 hour')", [u.id, h]);
  await users.deleteAccount(u.id);
  const v = (await client.query("SELECT count(*)::int n FROM email_verification_tokens WHERE user_id=$1", [u.id])).rows[0].n;
  const p = (await client.query("SELECT count(*)::int n FROM password_reset_tokens WHERE user_id=$1", [u.id])).rows[0].n;
  eq([v, p], [0, 0], "auth tokens survived the delete");
});

// ═══════════════════════ CONSTRAINTS / TRIGGERS ═══════════════════════
t("C1", "Triggers", "display_order is dense and gap-free across insert+delete", "Three inserts → 1..3 within the vehicle_type scope; delete the middle → the third collapses to 2. (Vehicle.display_order isn't on the DTO, so read it from the row.)", async () => {
  const vt = await mkVehicleType();
  const a = await mkVehicle(vt.id);
  const b = await mkVehicle(vt.id);
  const c = await mkVehicle(vt.id);
  const orderOf = async (id: number) =>
    (await client.query("SELECT display_order FROM vehicles WHERE vehicle_id=$1", [id])).rows[0].display_order as number;
  eq([await orderOf(a.id), await orderOf(b.id), await orderOf(c.id)], [1, 2, 3], "initial per-type ordering");
  await fleet.deleteVehicle(b.id, ACTOR);
  eq([await orderOf(a.id), await orderOf(c.id)], [1, 2], "ordering after middle delete");
});

t("C2", "Triggers", "customer_profiles preferred_tags round-trips as a JSON array", "upsertCustomerProfile writes $9::jsonb; read-back is string[].", async () => {
  const u = await mkUser();
  const saved = await profile.upsertCustomerProfile(u.id, {
    addressLine1: "1 St", addressLine2: "", city: "Jaipur", state: "RJ", pincode: "302017",
    latitude: null, longitude: null, preferredTags: ["Heritage", "Desert"],
  });
  eq(saved.preferredTags, ["Heritage", "Desert"], "tags round-trip");
});

t("C3", "Triggers", "upsertCustomerProfile updates in place on the second call (no dup row)", "UNIQUE(user_id) + ON CONFLICT → one row, newest values.", async () => {
  const u = await mkUser();
  await profile.upsertCustomerProfile(u.id, { addressLine1: "A", addressLine2: "", city: "", state: "", pincode: "", latitude: null, longitude: null, preferredTags: [] });
  await profile.upsertCustomerProfile(u.id, { addressLine1: "B", addressLine2: "", city: "", state: "", pincode: "", latitude: null, longitude: null, preferredTags: [] });
  const rows = (await client.query("SELECT address_line1 FROM customer_profiles WHERE user_id=$1", [u.id])).rows;
  eq(rows.length, 1, "expected exactly one profile row");
  eq(rows[0].address_line1, "B", "profile not updated to newest value");
});

t("C4", "Triggers", "role_permissions UNIQUE(role_id, section) upserts", "setPermission twice for the same cell → one row, latest value.", async () => {
  await perms.setPermission("agent", "users", true, ACTOR);
  const m = await perms.setPermission("agent", "users", false, ACTOR);
  eq(m.agent.users, false, "permission not updated");
  const n = (await client.query(
    "SELECT count(*)::int n FROM role_permissions WHERE role_id=(SELECT role_id FROM roles WHERE name='agent') AND section='users'",
  )).rows[0].n;
  eq(n, 1, "expected a single role_permissions row for that cell");
});

t("C5", "Constraints", "NOT NULL is enforced on required columns", "Inserting a vehicle with a null seating_capacity fails (23502).", async () => {
  const vt = await mkVehicleType();
  await rejects(
    () => client.query("INSERT INTO vehicles (vehicle_type_id, name, seating_capacity, base_price_per_day) VALUES ($1,'x',NULL,1)", [vt.id]),
    dbErrors.isNotNullViolation,
    "null seating_capacity",
  );
});

// ═══════════════════════ ERROR CLASSIFIER ═══════════════════════
// Grab a real pg error for `sql`, isolated in its own nested savepoint so the
// aborted-transaction state is recovered before the next probe.
async function pgErrorFor(sql: string, params: unknown[] = []): Promise<unknown> {
  await client.query("SAVEPOINT e");
  try {
    await client.query(sql, params);
    return undefined;
  } catch (e) {
    return e;
  } finally {
    await client.query("ROLLBACK TO SAVEPOINT e");
    await client.query("RELEASE SAVEPOINT e");
  }
}

t("E1", "Classifier", "db-errors helpers identify real pg error codes", "isUniqueViolation / isForeignKeyViolation / isInvalidTextRepresentation each match the right Postgres SQLSTATE and reject a plain Error.", async () => {
  const uni = await pgErrorFor("INSERT INTO roles (name) VALUES ('customer')");
  ok(dbErrors.isUniqueViolation(uni), "isUniqueViolation should be true for 23505");
  ok(!dbErrors.isUniqueViolation(new Error("nope")), "isUniqueViolation should be false for a plain Error");

  const fk = await pgErrorFor("INSERT INTO cities (region_id, name) VALUES (2000000000, 'x')");
  ok(dbErrors.isForeignKeyViolation(fk), "isForeignKeyViolation should be true for 23503");
  ok(!dbErrors.isForeignKeyViolation(uni), "isForeignKeyViolation should be false for a unique violation");

  const bad = await pgErrorFor("SELECT * FROM users WHERE user_id = $1", ["not-a-uuid"]);
  ok(dbErrors.isInvalidTextRepresentation(bad), "isInvalidTextRepresentation should be true for 22P02");
});

// ═══════════════════════ SAVED ITINERARIES ═══════════════════════
// Phase 3 chunk 3.1 — src/lib/server/saved-itineraries.ts.
const mkRoute = async (n: number) => {
  const region = await mkRegion();
  const city = await mkCity(region.id);
  const spots: { id: number }[] = [];
  for (let i = 0; i < n; i++) spots.push(await mkSpot(city.id));
  return { region, spots };
};
const mkCuratedPackage = async () => {
  const region = await mkRegion();
  const vt = await mkVehicleType();
  return mkPackage(region.id, vt.id);
};

t("SI1", "SavedItineraries", "save a curated package defaults its title and is available", "createSavedItinerary(kind:'curated') stores the package, titles it after the package name, and marks it available.", async () => {
  const u = await mkUser();
  const p = await mkCuratedPackage();
  const res = await saved.createSavedItinerary(u.id, { kind: "curated", packageId: p.id });
  ok(res.ok, `create failed: ${JSON.stringify(res)}`);
  eq(res.ok && res.item.kind, "curated", "kind");
  eq(res.ok && res.item.title, p.name, "title should default to the package name");
  eq(res.ok && res.item.packageId, p.id, "packageId stored");
  eq(res.ok && res.item.packageSlug, p.slug, "packageSlug resolved for the rebook link");
  eq(res.ok && res.item.available, true, "a live curated pick is available");
});

t("SI2", "SavedItineraries", "save a custom route resolves and orders its stops", "createSavedItinerary(kind:'custom') keeps spot order, resolves the region label, and is available with >= 2 valid stops.", async () => {
  const u = await mkUser();
  const { region, spots } = await mkRoute(3);
  const ids = spots.map((s) => s.id);
  const res = await saved.createSavedItinerary(u.id, { kind: "custom", regionId: region.id, spotIds: ids });
  ok(res.ok, `create failed: ${JSON.stringify(res)}`);
  eq(res.ok && res.item.stops.map((s) => s.id), ids, "stops preserved in order");
  eq(res.ok && res.item.regionName, region.name, "regionName resolved");
  eq(res.ok && res.item.available, true, "3 valid stops -> available");
});

t("SI3", "SavedItineraries", "a custom route with fewer than 2 stops is rejected", "MIN_CUSTOM_STOPS is enforced server-side -> status 400, no row.", async () => {
  const u = await mkUser();
  const { spots } = await mkRoute(1);
  const res = await saved.createSavedItinerary(u.id, { kind: "custom", spotIds: spots.map((s) => s.id) });
  ok(!res.ok && res.status === 400, `expected 400, got ${JSON.stringify(res)}`);
});

t("SI4", "SavedItineraries", "saving an unknown package is rejected", "A non-existent packageId -> status 404, no row.", async () => {
  const u = await mkUser();
  const res = await saved.createSavedItinerary(u.id, { kind: "curated", packageId: 2_000_000_000 });
  ok(!res.ok && res.status === 404, `expected 404, got ${JSON.stringify(res)}`);
});

t("SI5", "SavedItineraries", "list is scoped to the owner (IDOR)", "User B never sees user A's saved trips.", async () => {
  const a = await mkUser();
  const b = await mkUser();
  const p = await mkCuratedPackage();
  await saved.createSavedItinerary(a.id, { kind: "curated", packageId: p.id });
  eq((await saved.listSavedItineraries(a.id)).length, 1, "owner sees their saved trip");
  eq((await saved.listSavedItineraries(b.id)).length, 0, "another user sees nothing");
});

t("SI6", "SavedItineraries", "rename only works for the owner", "renameSavedItinerary succeeds for the owner and returns false for anyone else.", async () => {
  const a = await mkUser();
  const b = await mkUser();
  const p = await mkCuratedPackage();
  const c = await saved.createSavedItinerary(a.id, { kind: "curated", packageId: p.id });
  ok(c.ok, "setup create");
  const id = c.ok ? c.item.id : "";
  eq(await saved.renameSavedItinerary(id, b.id, "hijack"), false, "non-owner rename must be a no-op");
  eq(await saved.renameSavedItinerary(id, a.id, "My Rajasthan plan"), true, "owner can rename");
  eq((await saved.listSavedItineraries(a.id))[0].title, "My Rajasthan plan", "title updated");
});

t("SI7", "SavedItineraries", "delete is a soft-delete and is idempotent", "deleteSavedItinerary flips is_deleted, drops it from the list, and a second call returns false.", async () => {
  const a = await mkUser();
  const p = await mkCuratedPackage();
  const c = await saved.createSavedItinerary(a.id, { kind: "curated", packageId: p.id });
  ok(c.ok, "setup create");
  const id = c.ok ? c.item.id : "";
  eq(await saved.deleteSavedItinerary(id, a.id), true, "first delete");
  eq((await saved.listSavedItineraries(a.id)).length, 0, "gone from the list");
  eq(await saved.deleteSavedItinerary(id, a.id), false, "second delete -> false");
  const row = (await client.query("SELECT is_deleted FROM saved_itineraries WHERE saved_itinerary_id = $1", [id])).rows[0];
  eq(row.is_deleted, true, "row is still present, just flagged");
});

t("SI8", "SavedItineraries", "deleteAccount purges the user's saved itineraries", "Account deletion removes the rows entirely (they hold trip-planning data).", async () => {
  const u = await mkUser();
  const p = await mkCuratedPackage();
  await saved.createSavedItinerary(u.id, { kind: "curated", packageId: p.id });
  await users.deleteAccount(u.id);
  const n = (await client.query("SELECT count(*)::int n FROM saved_itineraries WHERE user_id = $1", [u.id])).rows[0].n;
  eq(n, 0, "saved_itineraries survived the account deletion");
});

t("SI9", "SavedItineraries", "the per-user cap is enforced", "At SAVED_ITINERARY_LIMIT rows, the next create returns 409.", async () => {
  const u = await mkUser();
  const p = await mkCuratedPackage();
  await client.query(
    `INSERT INTO saved_itineraries (user_id, kind, title, package_id, spot_ids, created_by, updated_by)
     SELECT $1, 'curated', 'seed ' || g, $2, '[]'::jsonb, $1, $1 FROM generate_series(1, $3::int) g`,
    [u.id, p.id, saved.SAVED_ITINERARY_LIMIT],
  );
  const res = await saved.createSavedItinerary(u.id, { kind: "curated", packageId: p.id });
  ok(!res.ok && res.status === 409, `expected 409 at the cap, got ${JSON.stringify(res)}`);
});

t("SI10", "SavedItineraries", "a stop deleted after saving is dropped and can flip availability", "Resolved stops exclude soft-deleted tourist_spots; a custom route worn down to < 2 becomes unavailable.", async () => {
  const u = await mkUser();
  const { region, spots } = await mkRoute(2);
  const c = await saved.createSavedItinerary(u.id, { kind: "custom", regionId: region.id, spotIds: spots.map((s) => s.id) });
  ok(c.ok, "setup create");
  await client.query("UPDATE tourist_spots SET is_deleted = true WHERE tourist_spot_id = $1", [spots[0].id]);
  const list = await saved.listSavedItineraries(u.id);
  eq(list[0].stops.length, 1, "the deleted spot is dropped from the resolved stops");
  eq(list[0].available, false, "a custom route with < 2 valid stops is unavailable");
});

t("SI11", "SavedItineraries", "vehicleTypeSlug resolves to an id on save", "A slug in the create input is looked up server-side and stored as vehicle_type_id.", async () => {
  const u = await mkUser();
  const vt = await mkVehicleType();
  const { region, spots } = await mkRoute(2);
  const res = await saved.createSavedItinerary(u.id, {
    kind: "custom", regionId: region.id, spotIds: spots.map((s) => s.id), vehicleTypeSlug: vt.slug,
  });
  ok(res.ok, `create failed: ${JSON.stringify(res)}`);
  eq(res.ok && res.item.vehicleTypeId, vt.id, "slug resolved to the vehicle_type_id");
  eq(res.ok && res.item.vehicleTypeSlug, vt.slug, "slug echoed back for the rebook link");
});

// ═══════════════════════ SUPPORT TICKETS ═══════════════════════
// Phase 3 chunk 3.2 — src/lib/server/support-tickets.ts.
const ADMIN_USER = {
  id: ACTOR, name: "Admin", email: "admin@test.local", phone: "",
  role: "admin", emailVerified: true, createdAt: new Date().toISOString(),
};
const mkBookingRow = async (
  userId: string,
  opts: {
    status?: string;
    packageId?: number | null;
    total?: number;
    vehicleTypeId?: number;
    vehicleId?: number | null;
    startDatetime?: string;
  } = {},
) => {
  // A minimal bookings row (ticket<->booking link, analytics + payout tests).
  const bt = (await client.query("SELECT booking_type_id FROM booking_types LIMIT 1")).rows[0].booking_type_id;
  const vtId = opts.vehicleTypeId ?? (await mkVehicleType()).id;
  const status = opts.status ?? "PendingPayment";
  const total = opts.total ?? 1050;
  const start = opts.startDatetime ?? null;
  const r = await client.query(
    `INSERT INTO bookings (booking_reference, user_id, booking_type_id, vehicle_type_id, vehicle_id, package_id,
       start_datetime, passenger_count, status, subtotal, discount_amount, tax_amount, total_amount, currency, created_by, updated_by)
     VALUES ('ST-' || substr(md5(random()::text),1,8), $1, $2, $3, $4, $5,
       coalesce($6::timestamptz, now() + interval '10 days'), 2,
       $7, $8, 0, 50, $9, 'INR', $1, $1)
     RETURNING booking_id, booking_reference`,
    [userId, bt, vtId, opts.vehicleId ?? null, opts.packageId ?? null, start, status, total - 50, total],
  );
  return r.rows[0] as { booking_id: string; booking_reference: string };
};

t("ST1", "SupportTickets", "opening a ticket creates it open with the first message", "createTicket -> HELP- reference, status 'open', one 'customer' message, messageCount 1.", async () => {
  const u = await mkUser();
  const res = await support.createTicket(u, { subject: "Where is my driver?", message: "Trip is tomorrow, no driver yet." });
  ok(res.ok, `create failed: ${JSON.stringify(res)}`);
  if (!res.ok) return;
  ok(res.ticket.reference.startsWith("HELP-"), `bad reference ${res.ticket.reference}`);
  eq(res.ticket.status, "open", "status");
  eq(res.ticket.messages.length, 1, "one message");
  eq(res.ticket.messages[0].authorRole, "customer", "first message authored by the customer");
  eq(res.ticket.messageCount, 1, "messageCount");
});

t("ST2", "SupportTickets", "linking a booking that isn't yours is rejected", "createTicket with another user's bookingId -> status 400.", async () => {
  const a = await mkUser();
  const b = await mkUser();
  const bk = await mkBookingRow(b.id);
  const res = await support.createTicket(a, { subject: "Question", message: "About a booking", bookingId: bk.booking_id });
  ok(!res.ok && res.status === 400, `expected 400, got ${JSON.stringify(res)}`);
});

t("ST3", "SupportTickets", "linking your own booking resolves its reference", "createTicket with the caller's own bookingId -> ticket.bookingReference is set.", async () => {
  const u = await mkUser();
  const bk = await mkBookingRow(u.id);
  const res = await support.createTicket(u, { subject: "Reschedule?", message: "Can I move this trip?", bookingId: bk.booking_id });
  ok(res.ok, `create failed: ${JSON.stringify(res)}`);
  if (!res.ok) return;
  eq(res.ticket.bookingReference, bk.booking_reference, "bookingReference resolved");
});

t("ST4", "SupportTickets", "a too-short subject is rejected", "subject under 3 chars -> status 400.", async () => {
  const u = await mkUser();
  const res = await support.createTicket(u, { subject: "hi", message: "a real message here" });
  ok(!res.ok && res.status === 400, `expected 400, got ${JSON.stringify(res)}`);
});

t("ST5", "SupportTickets", "the ticket list is scoped to the owner (IDOR)", "listTicketsForUser only returns the caller's tickets.", async () => {
  const a = await mkUser();
  const b = await mkUser();
  await support.createTicket(a, { subject: "A's ticket", message: "hello from A" });
  eq((await support.listTicketsForUser(a.id)).length, 1, "owner sees their ticket");
  eq((await support.listTicketsForUser(b.id)).length, 0, "another user sees nothing");
});

t("ST6", "SupportTickets", "getTicketForUser hides other users' tickets, admin sees all", "Non-owner -> null; owner and admin -> the detail.", async () => {
  const a = await mkUser();
  const b = await mkUser();
  const c = await support.createTicket(a, { subject: "Private", message: "for A only" });
  ok(c.ok, "setup create");
  const id = c.ok ? c.ticket.id : "";
  eq(await support.getTicketForUser(id, b), null, "non-owner must not see it");
  ok(await support.getTicketForUser(id, a), "owner sees it");
  ok(await support.getTicketAdmin(id, ADMIN_USER as never), "admin sees it");
});

t("ST7", "SupportTickets", "a customer reply keeps the ticket in the queue", "addTicketMessage by the owner -> status 'open', message appended as 'customer'.", async () => {
  const u = await mkUser();
  const c = await support.createTicket(u, { subject: "Follow-up", message: "first" });
  ok(c.ok, "setup create");
  const id = c.ok ? c.ticket.id : "";
  const r = await support.addTicketMessage(id, u, "any update?");
  ok(r.ok, `reply failed: ${JSON.stringify(r)}`);
  if (!r.ok) return;
  eq(r.ticket.status, "open", "still open after a customer reply");
  eq(r.ticket.messages.length, 2, "two messages");
  eq(r.ticket.messages[1].authorRole, "customer", "reply authored by the customer");
});

t("ST8", "SupportTickets", "a staff reply moves it to pending and logs a notification", "addTicketMessage by an admin -> status 'pending' + a notifications row kind 'support.reply' (SMTP unset here, so it records 'failed' gracefully).", async () => {
  const u = await mkUser();
  const c = await support.createTicket(u, { subject: "Need help", message: "please advise" });
  ok(c.ok, "setup create");
  const id = c.ok ? c.ticket.id : "";
  const smtp = process.env.SMTP_HOST;
  delete process.env.SMTP_HOST; // force the transporter to fail so no real email is sent
  try {
    const r = await support.addTicketMessage(id, ADMIN_USER as never, "Here's what to do…");
    ok(r.ok, `reply failed: ${JSON.stringify(r)}`);
    if (!r.ok) return;
    eq(r.ticket.status, "pending", "staff reply -> pending");
    eq(r.ticket.messages[1].authorRole, "admin", "reply authored by admin");
  } finally {
    if (smtp) process.env.SMTP_HOST = smtp;
  }
  const n = (await client.query(
    "SELECT kind, status FROM notifications WHERE user_id = $1 AND kind = 'support.reply'",
    [u.id],
  )).rows[0];
  ok(n, "a support.reply notification row was written");
  eq(n.status, "failed", "SMTP was unset, so the send is recorded as failed (non-blocking)");
});

t("ST9", "SupportTickets", "admin can set status, reopen, and an invalid value is refused", "setTicketStatus: resolved -> closed reopen -> open; a bogus status returns false.", async () => {
  const u = await mkUser();
  const c = await support.createTicket(u, { subject: "Status test", message: "hello" });
  ok(c.ok, "setup create");
  const id = c.ok ? c.ticket.id : "";
  eq(await support.setTicketStatus(id, "resolved", ACTOR), true, "-> resolved");
  eq(await support.setTicketStatus(id, "open", ACTOR), true, "reopen -> open");
  eq(await support.setTicketStatus(id, "banana", ACTOR), false, "bogus status refused");
  const list = await support.listTicketsForUser(u.id);
  eq(list[0].status, "open", "final status persisted");
});

t("ST10", "SupportTickets", "replying to a closed ticket is refused", "addTicketMessage on a 'closed' ticket -> status 409.", async () => {
  const u = await mkUser();
  const c = await support.createTicket(u, { subject: "Closing", message: "hello" });
  ok(c.ok, "setup create");
  const id = c.ok ? c.ticket.id : "";
  await support.setTicketStatus(id, "closed", ACTOR);
  const r = await support.addTicketMessage(id, u, "wait!");
  ok(!r.ok && r.status === 409, `expected 409, got ${JSON.stringify(r)}`);
});

t("ST11", "SupportTickets", "the open-ticket cap is enforced", "At OPEN_TICKET_LIMIT open/pending tickets, the next createTicket returns 409.", async () => {
  const u = await mkUser();
  await client.query(
    `INSERT INTO support_tickets (reference, user_id, subject, status, created_by, updated_by)
     SELECT 'HELP-CAP' || lpad(g::text, 4, '0'), $1, 'seed ' || g, 'open', $1, $1
       FROM generate_series(1, $2::int) g`,
    [u.id, support.OPEN_TICKET_LIMIT],
  );
  const res = await support.createTicket(u, { subject: "One too many", message: "over the cap" });
  ok(!res.ok && res.status === 409, `expected 409 at the cap, got ${JSON.stringify(res)}`);
});

t("ST12", "SupportTickets", "deleting a ticket cascades its messages", "ON DELETE CASCADE on support_ticket_messages.support_ticket_id.", async () => {
  const u = await mkUser();
  const c = await support.createTicket(u, { subject: "Cascade", message: "hello" });
  ok(c.ok, "setup create");
  const id = c.ok ? c.ticket.id : "";
  await client.query("DELETE FROM support_tickets WHERE support_ticket_id = $1", [id]);
  const n = (await client.query("SELECT count(*)::int n FROM support_ticket_messages WHERE support_ticket_id = $1", [id])).rows[0].n;
  eq(n, 0, "messages should be gone with the ticket");
});

// ═══════════════════════ ACTIVITY LOG ═══════════════════════
// Phase 3 chunk 3.3 — src/lib/server/activity-log.ts + wire-ins.
const logCount = async (action: string, entityId?: string) => {
  const r = await client.query(
    `SELECT count(*)::int n FROM activity_logs WHERE action = $1 ${entityId ? "AND entity_id = $2" : ""}`,
    entityId ? [action, entityId] : [action],
  );
  return r.rows[0].n as number;
};

t("AL1", "ActivityLog", "logActivity inserts a row and round-trips details as JSON", "A logged entry comes back with user_id, action, entity, and details as an object.", async () => {
  const u = await mkUser();
  await activity.logActivity({ userId: u.id, action: "test.event", entityType: "thing", entityId: "42", details: { a: 1, b: "x" }, ipAddress: "1.2.3.4" });
  const row = (await client.query("SELECT * FROM activity_logs WHERE action = 'test.event' AND user_id = $1", [u.id])).rows[0];
  ok(row, "row not written");
  eq(row.entity_type, "thing", "entity_type");
  eq(row.entity_id, "42", "entity_id");
  eq(row.details, { a: 1, b: "x" }, "details round-trip as an object");
  eq(row.ip_address, "1.2.3.4", "ip_address");
});

t("AL2", "ActivityLog", "a system event (no user) logs fine", "userId omitted -> user_id NULL, no FK error.", async () => {
  await activity.logActivity({ action: "system.tick", details: { ok: true } });
  const row = (await client.query("SELECT user_id FROM activity_logs WHERE action = 'system.tick'")).rows[0];
  ok(row, "row not written");
  eq(row.user_id, null, "user_id should be NULL for a system event");
});

t("AL3", "ActivityLog", "an overlong action is truncated, not rejected", "action is capped at 100 chars before insert.", async () => {
  await activity.logActivity({ action: "x".repeat(250) });
  const row = (await client.query("SELECT action FROM activity_logs WHERE action LIKE 'xxxx%' ORDER BY log_id DESC LIMIT 1")).rows[0];
  ok(row, "row not written");
  eq(row.action.length, 100, "action truncated to 100");
});

t("AL4", "ActivityLog", "setUserRole logs user.role_change with from/to, and a no-op change logs nothing", "Changing the role writes one log with {from,to}; setting the same role again writes none.", async () => {
  const u = await mkUser();
  await adminUsers.setUserRole(u.id, "agent", ACTOR);
  eq(await logCount("user.role_change", u.id), 1, "one role_change log after the change");
  const row = (await client.query("SELECT details, user_id FROM activity_logs WHERE action = 'user.role_change' AND entity_id = $1", [u.id])).rows[0];
  eq(row.details.from, "customer", "details.from");
  eq(row.details.to, "agent", "details.to");
  eq(row.user_id, ACTOR, "actor recorded");
  await adminUsers.setUserRole(u.id, "agent", ACTOR); // same role -> no-op
  eq(await logCount("user.role_change", u.id), 1, "a no-op role set must not log again");
});

t("AL5", "ActivityLog", "setPermission logs permission.change", "Toggling a matrix cell writes a permission.change log with role/section/isAllowed.", async () => {
  await perms.setPermission("agent", "reviews", true, ACTOR);
  const row = (await client.query("SELECT details FROM activity_logs WHERE action = 'permission.change' ORDER BY log_id DESC LIMIT 1")).rows[0];
  ok(row, "no permission.change log written");
  eq(row.details, { role: "agent", section: "reviews", isAllowed: true }, "details");
});

t("AL6", "ActivityLog", "settleRefund logs refund.settle", "Settling a pending refund writes a refund.settle log with status/amount.", async () => {
  const u = await mkUser();
  const bk = await mkBookingRow(u.id);
  await client.query(
    `INSERT INTO refunds (booking_id, amount, charge_amount, tier, reason, status, created_by, updated_by)
     VALUES ($1, 500, 0, 'free', 'test', 'pending', $2, $2)`,
    [bk.booking_id, ACTOR],
  );
  const res = await refunds.settleRefund(bk.booking_id, { status: "paid", method: "upi" }, ACTOR);
  ok(res.ok, `settle failed: ${JSON.stringify(res)}`);
  const row = (await client.query("SELECT details, entity_id FROM activity_logs WHERE action = 'refund.settle' AND entity_id = $1", [bk.booking_id])).rows[0];
  ok(row, "no refund.settle log");
  eq(row.details.status, "paid", "details.status");
  eq(Number(row.details.amount), 500, "details.amount");
  eq(row.details.method, "upi", "details.method");
});

t("AL7", "ActivityLog", "admin CRUD through _util logs admin.update / admin.delete", "applyPartialUpdate -> admin.update with the changed fields; softDelete -> admin.delete.", async () => {
  const vt = await mkVehicleType();
  await fleet.updateVehicleType(vt.id, { title: "Renamed" }, ACTOR);
  const up = (await client.query("SELECT details, entity_type, entity_id FROM activity_logs WHERE action = 'admin.update' AND entity_id = $1", [String(vt.id)])).rows[0];
  ok(up, "no admin.update log");
  eq(up.entity_type, "vehicle_types", "entity_type is the table name");
  eq(up.details, { fields: ["title"] }, "changed fields recorded");
  await fleet.deleteVehicleType(vt.id, ACTOR);
  eq(await logCount("admin.delete", String(vt.id)), 1, "one admin.delete log");
});

t("AL8", "ActivityLog", "listActivity filters by action", "Only rows with the requested action come back.", async () => {
  await activity.logActivity({ action: "filter.hit", entityType: "x", entityId: "1" });
  await activity.logActivity({ action: "filter.miss", entityType: "x", entityId: "2" });
  const rows = await activity.listActivity({ action: "filter.hit", limit: 50 });
  ok(rows.length >= 1, "expected at least one match");
  ok(rows.every((r) => r.action === "filter.hit"), "every row matches the filter");
});

t("AL9", "ActivityLog", "listActivity resolves the actor and honours the `before` cursor", "actorName joins from users; `before` returns only rows strictly older. (Explicit timestamps — the harness's single txn freezes now().)", async () => {
  const u = await mkUser();
  await client.query(
    `INSERT INTO activity_logs (user_id, action, created_at) VALUES
       ($1, 'page.old', now() - interval '2 hours'),
       ($1, 'page.new', now() - interval '1 hour')`,
    [u.id],
  );
  const all = await activity.listActivity({ userId: u.id, limit: 50 });
  eq(all.length, 2, "both rows for this user");
  eq(all[0].action, "page.new", "newest first");
  const name = (await client.query("SELECT name FROM users WHERE user_id=$1", [u.id])).rows[0].name;
  eq(all[0].actorName, name, "actor name resolved via the users join");
  const older = await activity.listActivity({ userId: u.id, before: all[0].createdAt, limit: 50 });
  eq(older.length, 1, "before the newest -> only the strictly-older row");
  eq(older[0].action, "page.old", "the older row");
});

// ═══════════════════════ ANALYTICS ═══════════════════════
// Phase 3 chunk 3.4 — src/lib/server/admin/analytics.ts. Delta-based: snapshot,
// mutate, snapshot again — robust to whatever else is in the dev branch.
t("AN1", "Analytics", "getAnalytics returns a well-formed summary", "All sections present; the timeseries covers 30 days; generatedAt is an ISO string.", async () => {
  const a = await analytics.getAnalytics();
  ok(!Number.isNaN(Date.parse(a.generatedAt)), "generatedAt not an ISO date");
  eq(a.timeseries.length, 30, "30-day window");
  ok(typeof a.bookings.total === "number", "bookings.total");
  ok(typeof a.revenue.total === "number", "revenue.total");
  ok(typeof a.refunds.refundRatePct === "number", "refunds.refundRatePct");
  ok(typeof a.coupons.redemptions === "number", "coupons.redemptions");
  ok(typeof a.reviews.avgRating === "number", "reviews.avgRating");
  ok(typeof a.support.open === "number", "support.open");
  ok(Array.isArray(a.topPackages) && Array.isArray(a.topVehicleTypes), "top lists are arrays");
});

t("AN2", "Analytics", "a PendingPayment booking counts in bookings but not revenue", "bookings.total +1, revenue.total unchanged.", async () => {
  const u = await mkUser();
  const before = await analytics.getAnalytics();
  await mkBookingRow(u.id, { status: "PendingPayment", total: 3000 });
  const after = await analytics.getAnalytics();
  eq(after.bookings.total, before.bookings.total + 1, "bookings.total +1");
  eq(after.revenue.total, before.revenue.total, "revenue.total unchanged for an unpaid booking");
});

t("AN3", "Analytics", "a Confirmed booking adds to revenue and the status breakdown", "revenue.total +total, taxCollected +tax, byStatus 'Confirmed' +1.", async () => {
  const u = await mkUser();
  const before = await analytics.getAnalytics();
  const beforeConfirmed = before.bookings.byStatus.find((s) => s.status === "Confirmed")?.count ?? 0;
  await mkBookingRow(u.id, { status: "Confirmed", total: 5000 });
  const after = await analytics.getAnalytics();
  eq(after.revenue.total, before.revenue.total + 5000, "revenue.total +5000");
  eq(after.revenue.taxCollected, before.revenue.taxCollected + 50, "taxCollected +50");
  const afterConfirmed = after.bookings.byStatus.find((s) => s.status === "Confirmed")?.count ?? 0;
  eq(afterConfirmed, beforeConfirmed + 1, "byStatus Confirmed +1");
});

t("AN4", "Analytics", "a new review bumps the review counters", "reviews.count +1, reviews.published +1 (default is_published), avgRating stays in [1,5].", async () => {
  const u = await mkUser();
  const bk = await mkBookingRow(u.id, { status: "Completed", total: 1000 });
  const before = await analytics.getAnalytics();
  await client.query(
    `INSERT INTO reviews (booking_id, user_id, rating, title, created_by, updated_by)
     VALUES ($1, $2, 5, 'great', $2, $2)`,
    [bk.booking_id, u.id],
  );
  const after = await analytics.getAnalytics();
  eq(after.reviews.count, before.reviews.count + 1, "reviews.count +1");
  eq(after.reviews.published, before.reviews.published + 1, "reviews.published +1");
  ok(after.reviews.avgRating >= 1 && after.reviews.avgRating <= 5, `avgRating out of range: ${after.reviews.avgRating}`);
});

t("AN5", "Analytics", "a new support ticket bumps the support counters", "support.total +1 and support.open +1 for a fresh (open) ticket.", async () => {
  const u = await mkUser();
  const before = await analytics.getAnalytics();
  await support.createTicket(u, { subject: "analytics check", message: "counting this ticket" });
  const after = await analytics.getAnalytics();
  eq(after.support.total, before.support.total + 1, "support.total +1");
  eq(after.support.open, before.support.open + 1, "support.open +1");
});

t("AN6", "Analytics", "a coupon redemption feeds the coupon counters; top lists are well-formed", "coupons.redemptions +1, coupons.discountGiven +amount; topPackages entries are {name,bookings,revenue}.", async () => {
  const u = await mkUser();
  const bk = await mkBookingRow(u.id, { status: "Confirmed", total: 2000 });
  const cid = (await client.query(
    `INSERT INTO coupons (code, discount_type, discount_value, created_by, updated_by)
     VALUES ('AN6-' || substr(md5(random()::text),1,6), 'flat', 150, $1, $1) RETURNING coupon_id`,
    [ACTOR],
  )).rows[0].coupon_id;
  const before = await analytics.getAnalytics();
  await client.query(
    `INSERT INTO coupon_redemptions (coupon_id, booking_id, user_id, amount) VALUES ($1,$2,$3,150)`,
    [cid, bk.booking_id, u.id],
  );
  const after = await analytics.getAnalytics();
  eq(after.coupons.redemptions, before.coupons.redemptions + 1, "coupons.redemptions +1");
  eq(after.coupons.discountGiven, before.coupons.discountGiven + 150, "coupons.discountGiven +150");
  for (const p of after.topPackages) {
    ok(typeof p.name === "string" && typeof p.bookings === "number" && typeof p.revenue === "number", "topPackages entry shape");
  }
});

// ═══════════════════════ VENDOR MARKETPLACE ═══════════════════════
// Phase 3 chunk 3.5 — src/lib/server/admin/vendors.ts.
const setCommission = async (pct: string) => {
  await client.query(
    `INSERT INTO site_settings (setting_key, setting_value, updated_by)
     VALUES ('vendor_commission_pct', $1, $2)
     ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value`,
    [pct, ACTOR],
  );
  siteSettings.invalidateSiteSettings();
};

t("VM1", "VendorMarketplace", "createVendor requires a business name and starts 'pending'", "A valid vendor comes back pending with 0 vehicles; a 1-char name is rejected.", async () => {
  const bad = await vendors.createVendor({ businessName: "x" }, ACTOR);
  ok(!bad.ok, "1-char name should be rejected");
  const res = await vendors.createVendor({ businessName: "Blue Hills Cabs", contactPhone: "9990001111" }, ACTOR);
  ok(res.ok, `create failed: ${JSON.stringify(res)}`);
  if (!res.ok) return;
  eq(res.vendor.status, "pending", "starts pending");
  eq(res.vendor.vehicleCount, 0, "no vehicles yet");
});

t("VM2", "VendorMarketplace", "updateVendor moves status and logs vendor.status_change; a bad status is refused", "status -> approved returns the row + writes an activity log; an invalid status returns null.", async () => {
  const c = await vendors.createVendor({ businessName: "VM2 Travels" }, ACTOR);
  ok(c.ok, "setup");
  const id = c.ok ? c.vendor.id : 0;
  eq(await vendors.updateVendor(id, { status: "banana" }, ACTOR), null, "invalid status -> null");
  const up = await vendors.updateVendor(id, { status: "approved" }, ACTOR);
  eq(up?.status, "approved", "status persisted");
  const log = (await client.query(
    "SELECT details FROM activity_logs WHERE action = 'vendor.status_change' AND entity_id = $1",
    [String(id)],
  )).rows[0];
  ok(log, "no vendor.status_change activity row");
  eq(log.details.status, "approved", "activity details");
});

t("VM3", "VendorMarketplace", "deleteVendor is a soft-delete and idempotent", "The vendor drops out of listVendors; a second delete returns false.", async () => {
  const c = await vendors.createVendor({ businessName: "VM3 Fleet" }, ACTOR);
  ok(c.ok, "setup");
  const id = c.ok ? c.vendor.id : 0;
  eq(await vendors.deleteVendor(id, ACTOR), true, "first delete");
  eq((await vendors.listVendors()).some((v) => v.id === id), false, "gone from the list");
  eq(await vendors.deleteVendor(id, ACTOR), false, "second delete -> false");
});

t("VM4", "VendorMarketplace", "a vehicle can be assigned to a vendor and it shows on both sides", "fleet.updateVehicle({vendorProfileId}) sets the owner; listVehicles carries vendorBusinessName; the vendor's vehicleCount reflects it.", async () => {
  const c = await vendors.createVendor({ businessName: "VM4 Cars" }, ACTOR);
  ok(c.ok, "setup");
  const vid = c.ok ? c.vendor.id : 0;
  const vt = await mkVehicleType();
  const veh = await mkVehicle(vt.id);
  await fleet.updateVehicle(veh.id, { vendorProfileId: vid }, ACTOR);
  const listed = (await fleet.listVehicles()).find((x) => x.id === veh.id);
  eq(listed?.vendorProfileId, vid, "vehicle.vendorProfileId set");
  eq(listed?.vendorBusinessName, "VM4 Cars", "vendor name joined onto the vehicle");
  eq((await vendors.listVendors()).find((v) => v.id === vid)?.vehicleCount, 1, "vendor vehicleCount = 1");
});

t("VM5", "VendorMarketplace", "generatePayouts tallies only Completed trips on the vendor's vehicles and applies the global %", "2 Completed + 1 PendingPayment on a vendor vehicle, 20% commission -> gross 5000, commission 1000, net 4000, 2 trips.", async () => {
  await setCommission("20");
  const owner = await mkUser();
  const c = await vendors.createVendor({ businessName: "VM5 Coaches" }, ACTOR);
  ok(c.ok, "setup");
  const vid = c.ok ? c.vendor.id : 0;
  await vendors.updateVendor(vid, { status: "approved" }, ACTOR);
  const vt = await mkVehicleType();
  const veh = await mkVehicle(vt.id);
  await fleet.updateVehicle(veh.id, { vendorProfileId: vid }, ACTOR);
  await mkBookingRow(owner.id, { status: "Completed", total: 3000, vehicleId: veh.id, startDatetime: "2099-07-05T09:00:00Z" });
  await mkBookingRow(owner.id, { status: "Completed", total: 2000, vehicleId: veh.id, startDatetime: "2099-07-20T09:00:00Z" });
  await mkBookingRow(owner.id, { status: "PendingPayment", total: 9999, vehicleId: veh.id, startDatetime: "2099-07-10T09:00:00Z" });
  const res = await vendors.generatePayouts("2099-07", ACTOR);
  ok(res.ok, `generate failed: ${JSON.stringify(res)}`);
  if (!res.ok) return;
  const p = res.payouts.find((x) => x.vendorProfileId === vid);
  ok(p, "no payout row for the vendor");
  eq(p!.bookingCount, 2, "only Completed trips");
  eq(p!.grossAmount, 5000, "gross 3000 + 2000");
  eq(p!.commissionPct, 20, "commission % snapshot");
  eq(p!.commissionAmount, 1000, "20% of 5000");
  eq(p!.netAmount, 4000, "net = gross - commission");
  eq(p!.status, "pending", "starts pending");
});

t("VM6", "VendorMarketplace", "regenerating refreshes pending rows but leaves settled ones alone", "After settling a payout as paid, a later regen (with a new trip) does not change its gross.", async () => {
  await setCommission("10");
  const owner = await mkUser();
  const c = await vendors.createVendor({ businessName: "VM6 Rentals" }, ACTOR);
  ok(c.ok, "setup");
  const vid = c.ok ? c.vendor.id : 0;
  await vendors.updateVendor(vid, { status: "approved" }, ACTOR);
  const vt = await mkVehicleType();
  const veh = await mkVehicle(vt.id);
  await fleet.updateVehicle(veh.id, { vendorProfileId: vid }, ACTOR);
  await mkBookingRow(owner.id, { status: "Completed", total: 1000, vehicleId: veh.id, startDatetime: "2099-08-05T09:00:00Z" });
  const g1 = await vendors.generatePayouts("2099-08", ACTOR);
  const p1 = g1.ok ? g1.payouts.find((x) => x.vendorProfileId === vid)! : null;
  eq(p1!.grossAmount, 1000, "first gross");
  await vendors.settlePayout(p1!.id, { status: "paid", method: "bank" }, ACTOR);
  await mkBookingRow(owner.id, { status: "Completed", total: 7777, vehicleId: veh.id, startDatetime: "2099-08-15T09:00:00Z" });
  await vendors.generatePayouts("2099-08", ACTOR);
  const after = (await vendors.listPayouts()).find((x) => x.id === p1!.id);
  eq(after?.grossAmount, 1000, "a paid payout's gross is frozen on regen");
  eq(after?.status, "paid", "still paid");
});

t("VM7", "VendorMarketplace", "settlePayout transitions once and logs payout.settle", "pending -> paid works and writes an activity row; a second settle -> 409; a bad status -> 400.", async () => {
  await setCommission("0");
  const owner = await mkUser();
  const c = await vendors.createVendor({ businessName: "VM7 Cabs" }, ACTOR);
  const vid = c.ok ? c.vendor.id : 0;
  await vendors.updateVendor(vid, { status: "approved" }, ACTOR);
  const vt = await mkVehicleType();
  const veh = await mkVehicle(vt.id);
  await fleet.updateVehicle(veh.id, { vendorProfileId: vid }, ACTOR);
  await mkBookingRow(owner.id, { status: "Completed", total: 500, vehicleId: veh.id, startDatetime: "2099-09-05T09:00:00Z" });
  const g = await vendors.generatePayouts("2099-09", ACTOR);
  const pid = g.ok ? g.payouts.find((x) => x.vendorProfileId === vid)!.id : "";
  const bad = await vendors.settlePayout(pid, { status: "nope" as never }, ACTOR);
  ok(!bad.ok && bad.status === 400, "bad status -> 400");
  const ok1 = await vendors.settlePayout(pid, { status: "void" }, ACTOR);
  ok(ok1.ok && ok1.payout.status === "void", "pending -> void");
  const again = await vendors.settlePayout(pid, { status: "paid" }, ACTOR);
  ok(!again.ok && again.status === 409, "already settled -> 409");
  eq((await client.query("SELECT count(*)::int n FROM activity_logs WHERE action='payout.settle' AND entity_id=$1", [pid])).rows[0].n, 1, "one payout.settle log");
});

t("VM8", "VendorMarketplace", "listPayouts filters by status", "Only rows with the requested status come back.", async () => {
  const rows = await vendors.listPayouts("void");
  ok(rows.every((r) => r.status === "void"), "every row is void");
});

// Driver auth/tracking tests use the same rolled-back database fixtures.
const driverApp = await import('../../src/lib/server/driver.ts');
const roster = await import('../../src/lib/server/admin/drivers.ts');
async function driverFixture() {
  const d=await roster.createDriver({name:'Test driver',phone:'9999999999'},ACTOR);
  ok(d.ok,'driver created');
  const email=`driver-${uniq()}@example.test`;
  await driverApp.createDriverLogin(d.driver.id,email,'test-password-123',ACTOR);
  const u=await users.verifyCredentials(email,'test-password-123');ok(u,'login works');
  const owner=await mkUser();const b=await mkBookingRow(owner.id,{status:'Ongoing'});
  await client.query('UPDATE bookings SET driver_id=$1 WHERE booking_id=$2',[d.driver.id,b.booking_id]);
  return {d:d.driver,u,owner,id:b.booking_id};
}
t('DR1','DriverApp','Login uses existing password authentication and links roster','Driver role and roster login.',async()=>{
  const f=await driverFixture();eq(f.u.role,'driver','role');eq(f.u.emailVerified,true,'verified');
  ok((await roster.listDrivers()).find(d=>d.id===f.d.id)?.loginEmail===f.u.email,'linked email');
  await rejects(()=>driverApp.createDriverLogin(f.d.id,'another@example.test','test-password-123',ACTOR),e=>e.status===409,'duplicate login');
});
t('DR2','DriverApp','Trip and location ownership isolation','Other users cannot list or send/read GPS.',async()=>{
  const f=await driverFixture();const other=await mkUser();
  eq((await driverApp.listDriverTrips(f.u.id)).length,1,'assigned trip');
  eq((await driverApp.listDriverTrips(other.id)).length,0,'unassigned');
  await rejects(()=>driverApp.recordLocation(f.id,other.id,{lat:20,lng:75}),e=>e.status===404,'GPS IDOR');
  await rejects(()=>driverApp.latestLocation(f.id,other.id),e=>e.status===404,'read IDOR');
});
t('DR3','DriverApp','Coordinates validated and writes throttled','Valid point, invalid coordinates and too-fast ping.',async()=>{
  const f=await driverFixture();
  await rejects(()=>driverApp.recordLocation(f.id,f.u.id,{lat:91,lng:75}),e=>e.status===400,'bad latitude');
  await rejects(()=>driverApp.recordLocation(f.id,f.u.id,{lat:20,lng:75,accuracy:-1}),e=>e.status===400,'bad accuracy');
  await driverApp.recordLocation(f.id,f.u.id,{lat:20,lng:75,accuracy:12});
  eq((await driverApp.latestLocation(f.id,f.owner.id))?.lat,20,'position');
  await rejects(()=>driverApp.recordLocation(f.id,f.u.id,{lat:20,lng:75}),e=>e.status===429,'throttle');
});
t('DR4','DriverApp','Only ongoing trips expose and accept positions','Confirmed/completed/cancelled denied.',async()=>{
  const f=await driverFixture();await driverApp.recordLocation(f.id,f.u.id,{lat:20,lng:75});
  for(const status of ['Confirmed','Completed','Cancelled']) {
    await client.query('UPDATE bookings SET status=$1 WHERE booking_id=$2',[status,f.id]);
    eq(await driverApp.latestLocation(f.id,f.owner.id),null,'hidden after status change');
    await rejects(()=>driverApp.recordLocation(f.id,f.u.id,{lat:20,lng:75}),e=>e.status===404,'status gated');
  }
});
t('DR5','DriverApp','Stale and reassigned locations hidden','Ten minute freshness and current assignment.',async()=>{
  const f=await driverFixture();await driverApp.recordLocation(f.id,f.u.id,{lat:20,lng:75});
  await client.query("UPDATE driver_locations SET recorded_at=now()-interval '11 minutes' WHERE booking_id=$1",[f.id]);
  eq(await driverApp.latestLocation(f.id,f.owner.id),null,'stale');
  await client.query('UPDATE driver_locations SET recorded_at=now() WHERE booking_id=$1',[f.id]);
  await client.query('UPDATE bookings SET driver_id=NULL WHERE booking_id=$1',[f.id]);
  eq(await driverApp.latestLocation(f.id,f.owner.id),null,'reassigned');
});
t('DR6','DriverApp','Inactive and revoked drivers lose access','Revoke sessions and password login; inactive roster cannot track.',async()=>{
  const f=await driverFixture();
  await client.query('UPDATE drivers SET is_active=false WHERE driver_id=$1',[f.d.id]);
  eq((await driverApp.listDriverTrips(f.u.id)).length,0,'inactive');
  eq(await users.verifyCredentials(f.u.email,'test-password-123'),null,'inactive login');
  eq(await users.findUserById(f.u.id),undefined,'inactive session lookup');
  await rejects(()=>driverApp.recordLocation(f.id,f.u.id,{lat:20,lng:75}),e=>e.status===404,'inactive ping');
  await client.query("INSERT INTO sessions(token,user_id,expires_at) VALUES ($1,$2,now()+interval '1 day')",[randomUUID(),f.u.id]);
  await driverApp.removeDriverLogin(f.d.id,ACTOR);
  eq(await users.verifyCredentials(f.u.email,'test-password-123'),null,'revoked login');
  eq((await client.query('SELECT * FROM sessions WHERE user_id=$1',[f.u.id])).rowCount,0,'revoked sessions');
});

// ── run ──
let passed = 0;
for (const c of cases) {
  await client.query("SAVEPOINT s");
  try {
    await c.fn();
    c.status = "PASS";
    passed++;
  } catch (e) {
    c.status = "FAIL";
    c.detail = (e as Error)?.message ?? String(e);
  } finally {
    try { await client.query("ROLLBACK TO SAVEPOINT s"); } catch { /* txn already aborted past recovery */ }
    try { await client.query("RELEASE SAVEPOINT s"); } catch { /* ignore */ }
  }
}

await client.query("ROLLBACK");
await client.end();

// ── report ──
const failed = cases.length - passed;
const stamp = new Date().toISOString();
const rows = cases
  .map((c) => `| ${c.id} | ${c.group} | ${c.name} | ${c.status === "PASS" ? "✅ PASS" : "❌ FAIL"} | ${c.status === "PASS" ? "" : "`" + (c.detail ?? "").replace(/\|/g, "\\|") + "`"} |`)
  .join("\n");
const byGroup = [...new Set(cases.map((c) => c.group))]
  .map((g) => {
    const gc = cases.filter((c) => c.group === g);
    return `- **${g}** — ${gc.filter((c) => c.status === "PASS").length}/${gc.length}`;
  })
  .join("\n");

const md = `# DB CRUD test report

_Generated by \`db/tests/db-crud.test.ts\` — ${stamp}_

**${passed}/${cases.length} passing** (${failed} failing) against the \`development\` Neon branch.
The run is fully transactional and rolled back — no rows are added, changed or deleted.

${byGroup}

## Cases

| # | Group | Case | Result | Detail |
|---|-------|------|--------|--------|
${rows}

## What each case pins down

${cases.map((c) => `**${c.id} — ${c.name}**  \n${c.intent}`).join("\n\n")}
`;

const outPath = fileURLToPath(new URL("./DB_TEST_REPORT.md", import.meta.url));
writeFileSync(outPath, md);

console.log(`\n${passed}/${cases.length} passing, ${failed} failing`);
for (const c of cases.filter((c) => c.status === "FAIL")) console.log(`  ❌ ${c.id} ${c.name}\n     ${c.detail}`);
console.log(`\nreport → ${outPath}`);
process.exit(failed === 0 ? 0 : 1);

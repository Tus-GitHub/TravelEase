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
(globalThis as unknown as { __pgPool?: unknown }).__pgPool = {
  query: (...args: unknown[]) => (client.query as (...a: unknown[]) => unknown)(...args),
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

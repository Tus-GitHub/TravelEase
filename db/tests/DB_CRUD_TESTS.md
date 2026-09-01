# DB CRUD tests — insertion / update / deletion

Integration harness for the database write paths (admin CRUD, signup, customer
profile, **account deletion**). It exercises the **real** `src/lib/server/**`
functions against the live Neon `development` branch so that constraints,
triggers and cascades are actually tested, not mocked.

- **Runner:** [`db-crud.test.ts`](./db-crud.test.ts)
- **Latest results (auto-generated each run):** [`DB_TEST_REPORT.md`](./DB_TEST_REPORT.md)
- **Run it:** `npm run test:db`

```
npm run test:db
# → 41/41 passing, 0 failing
```

### How it stays safe

The whole run happens inside **one transaction that is `ROLLBACK`'d at the end**,
and every individual test is wrapped in a `SAVEPOINT` that is rolled back after
it finishes. Nothing is ever committed — the target database is left
byte-for-byte unchanged. A fake `pool` is installed on `globalThis.__pgPool`
before the app modules load, so every `getPool().query(...)` they make is routed
through the harness's single transactional client.

It still needs a live DB connection (`DATABASE_URL` from `.env.local`, same as
`npm run migrate`) and at least one row in `users` (used as `created_by` /
`updated_by`).

### Why a bespoke harness and not Vitest

There is no test framework in this project (noted repeatedly in `MEMORY.md`).
Node 22's `--experimental-strip-types` runs the `.ts` modules directly; a tiny
resolution hook ([`_ts-loader.mjs`](./_ts-loader.mjs), registered by
[`_register.mjs`](./_register.mjs)) lets their extensionless `../db` imports
resolve. `db/tests` is excluded from `tsconfig.json` so `next build` doesn't try
to type-check the harness.

---

## Issues found and fixed

All of the below were found by the first run of this harness (23/31 passing) and
fixed; the suite is now green. Fixes are app-code only — **no migration**, so
`npm run db:check` is unaffected.

### 1. `PATCH /api/admin/*/[id]` returned **500** on a bad foreign key

`updateCity({regionId})`, `updateTouristSpot({cityId})`,
`updateVehicle({vehicleTypeId})`, `updatePackage({regionId|vehicleTypeId})` let
the raw Postgres FK-violation (`23503`) bubble out of the route as an unhandled
500. The matching **POST** routes already caught it and returned 400.
→ **Fix:** the `[id]` PATCH routes now `try/catch` and map it to `400` (tests
`U3`, and the classifier `E1`).

### 2. `PATCH /api/admin/vehicle-types/[id]` returned **500** on a duplicate slug

Same shape — the POST route mapped `23505` → 409, the PATCH route didn't.
→ **Fix:** PATCH now returns `409` (test `U2` + `E1`).

### 3. Fragile error detection by message text

Routes classified DB errors with `/foreign key/i` / `/unique|duplicate/i` on
`err.message` — locale-dependent and liable to change between PG versions.
→ **Fix:** new [`src/lib/server/db-errors.ts`](../../src/lib/server/db-errors.ts)
classifies on the stable SQLSTATE `err.code` (`23505`, `23503`, `23502`,
`22P02`, …); new [`src/lib/server/api-errors.ts`](../../src/lib/server/api-errors.ts)
`dbErrorResponse()` does the HTTP mapping in one place. Every admin write route
was switched over.

### 4. Signup: duplicate-email race returned **500**

`signup/route.ts` pre-checks with `findUserByEmail`, but two concurrent signups
can both pass that and race to `INSERT`; the loser hit the `users.email` UNIQUE
index and 500'd.
→ **Fix:** the `INSERT` is now wrapped — a `23505` there returns the same
`409 "An account with this email already exists."` (test `I7`).

### 5. `PATCH /api/admin/users/[id]` returned **500** for a non-UUID id

`setUserRole("not-a-uuid", …)` ran `WHERE user_id = $1` and Postgres rejected
the uuid cast (`22P02`) → 500, instead of a clean "not found".
→ **Fix:** `setUserRole` validates the UUID shape and returns `null` (→ route
`404`) for anything that can't be an id (tests `U7`, `U8`).

### 6. Soft-deleting a parent silently orphaned its children

`deleteVehicleType` / `deleteRegion` / `deleteCity` set `is_deleted = true` on
the parent while active child rows kept pointing at it (and the list JOINs don't
filter the parent's `is_deleted`), so the UI showed a city under a "deleted"
region, a vehicle under a "deleted" type, etc.
→ **Fix:** new `countActiveChildren()` helper in
[`_util.ts`](../../src/lib/server/admin/_util.ts); the delete functions now throw
`DependentRowsError` when active children exist, and the routes map that to
`409` with a message naming the blocker ("This region still has 2 cities…").
The guard is not a permanent lock — clear the children and the parent deletes
(tests `D2`–`D5`).

### 7. Deleting a package left its stops behind

`package_stops` only cascades on a **hard** `DELETE`; `deletePackage` does a soft
delete, so stop rows survived pointing at a deleted package.
→ **Fix:** `deletePackage` now soft-deletes the package's stops in the same call
(stops are composition, wholly owned by the package) — test `D6`.

### 8. `addPackageStop` against a soft-deleted package left an orphan row

The `INSERT` ran (the FK row still physically exists), then `getPackage`
returned `null` and the route answered 404 — but the stray stop row stayed.
→ **Fix:** `addPackageStop` checks the package is live *before* inserting and
returns `null` if not (test `D10`).

### 9. Account deletion (new feature, 2026-09-01)

There was no way for a user to delete their account. Added a self-service flow:

- **`users.deleteAccount(userId)`** — one atomic `WITH … UPDATE` statement:
  `DELETE`s the `customer_profiles` row (address, map pin, preferred tags — gone),
  every `sessions` row, and any `email_verification_tokens` /
  `password_reset_tokens`; then soft-deletes the `users` row
  (`is_deleted = true`, `is_active = false`), scrubs `name` / `phone`, sets
  `password_hash` to an unusable value, and rewrites `email` to
  `deleted+<id>@deleted.invalid` so the original address is **freed for reuse**.
- **`DELETE /api/profile`** — session-gated; body must carry
  `{ "confirm": "DELETE" }`; runs `deleteAccount` then clears the session cookie.
- **`findUserByEmail` / `findUserById` now filter `is_deleted = false`** (plan.md
  §19a note) — a deleted account can't log in, be looked up, or block a fresh
  signup on the same email.
- UI: a red "Delete account" card on `/profile` (type `DELETE` to confirm) →
  `AuthContext.deleteAccount()` → redirect home. New `Button` `danger` variant +
  `trash` icon.
- Composes with the in-flight email-verification work (chunk 1.15 / migration
  `012`), which was applied to the dev branch during this change.

Covered by tests `DA1`–`DA9`.

### Looked at, deliberately not changed

- **`Vehicle` DTO has no `displayOrder`** (unlike `VehicleType` / `Region` /
  `City` / `TouristSpot`). Consistent with "nothing app-facing reads
  `display_order` yet" (`MEMORY.md` 2026-08-30) — left as-is; test `C1` reads
  the column directly.
- **`updateVehicle({features})` via the generic partial-update path** sends the
  JSON as a text param with no `::jsonb` cast. Verified it round-trips correctly
  (Postgres coerces the unknown-type param) — test `U4`. No change.
- **Booking tables (`009`/`010`)** have no app write path yet — out of scope.
- **`updated_at` "advances" on update** can't be asserted inside the harness's
  single transaction (`now()` is fixed per-transaction). `U1` instead checks the
  trigger is installed and `updated_by` is stamped.

---

## Test catalogue

| # | Group | What it pins down |
|---|-------|-------------------|
| I1 | Insertion | `createVehicleType` returns the row with a positive `display_order` (BEFORE INSERT trigger). |
| I2 | Insertion | `createVehicle` round-trips JSONB `features` as `string[]`, not a string. |
| I3 | Insertion | `createVehicle` with a missing `vehicleTypeId` → FK violation (`23503`). |
| I4 | Insertion | Duplicate `vehicle_types.slug` → UNIQUE violation (`23505`). |
| I5 | Insertion | region → city → tourist-spot chain inserts and resolves parent names. |
| I6 | Insertion | `createCity` with a bad `regionId` → FK violation. |
| I7 | Insertion | Second signup with the same email → UNIQUE violation even past the app pre-check. |
| I8 | Insertion | `addPackageStop` with a bad `touristSpotId` → FK violation. |
| U1 | Update | Partial update writes only the given column, stamps `updated_by`, trigger installed. |
| U2 | Update | Updating a slug to one already taken → UNIQUE violation (route → 409). |
| U3 | Update | Re-pointing a city at a missing region → FK violation (route → 400, was 500). |
| U4 | Update | `updateVehicle({features})` rewrites the JSONB array correctly. |
| U5 | Update | Updating a non-existent row resolves to `null` (route → 404), no throw. |
| U6 | Update | Empty patch on an existing row is a no-op, not an error. |
| U7 | Update | `setUserRole` with a non-UUID id returns `null` (was a `22P02` 500). |
| U8 | Update | `setUserRole` on a real user still changes the role. |
| D1 | Deletion | Leaf `deleteVehicleType` soft-deletes and shifts sibling `display_order` down. |
| D2 | Deletion | A vehicle-type with an active vehicle **cannot** be deleted (`DependentRowsError`). |
| D3 | Deletion | A region with an active city cannot be deleted. |
| D4 | Deletion | A city with an active tourist-spot cannot be deleted. |
| D5 | Deletion | Once the children are gone, the parent deletes — the guard isn't a permanent lock. |
| D6 | Deletion | Deleting a package also soft-deletes its stops. |
| D7 | Deletion | `deletePackageStop` soft-deletes one stop, reports its package, shifts `stop_order`. |
| D8 | Deletion | Double soft-delete → `true` then `false`, never an error. |
| D9 | Deletion | Hard `DELETE` of a vehicle cascades to `vehicle_images` (schema `ON DELETE CASCADE`). |
| D10 | Deletion | `addPackageStop` against a soft-deleted package inserts nothing and returns `null`. |
| C1 | Triggers | `display_order` stays dense and gap-free across insert + middle-delete, scoped per parent. |
| C2 | Triggers | `customer_profiles.preferred_tags` round-trips as a JSON array. |
| C3 | Triggers | `upsertCustomerProfile` updates in place on the 2nd call — one row, newest values. |
| C4 | Triggers | `role_permissions` `UNIQUE(role_id, section)` + `ON CONFLICT` upserts (one row per cell). |
| C5 | Constraints | `NOT NULL` is enforced (null `seating_capacity` → `23502`). |
| E1 | Classifier | `db-errors` helpers match the right SQLSTATE and reject a plain `Error`. |
| DA1 | AccountDeletion | `deleteAccount` flips `is_deleted`/`is_active`, scrubs name/phone, makes `password_hash` unusable, mangles `email` to the freed placeholder. |
| DA2 | AccountDeletion | The `customer_profiles` row (address, map pin, preferred tags) is removed entirely. |
| DA3 | AccountDeletion | Every `sessions` row for the user is deleted. |
| DA4 | AccountDeletion | `findUserById` / `findUserByEmail`(original address) return nothing afterwards. |
| DA5 | AccountDeletion | `verifyCredentials` with the original email + password → `null` (can't log in). |
| DA6 | AccountDeletion | The freed email registers again as a **fresh account with a new id**. |
| DA7 | AccountDeletion | Second `deleteAccount` on an already-deleted account → `false`, no error. |
| DA8 | AccountDeletion | `deleteAccount` on an unknown id → `false`. |
| DA9 | AccountDeletion | Outstanding `email_verification_tokens` + `password_reset_tokens` are purged. |

_Per-run pass/fail and failure detail: [`DB_TEST_REPORT.md`](./DB_TEST_REPORT.md)._

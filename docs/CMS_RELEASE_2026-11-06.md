# CMS production release — 2026-11-06

User authorized publishing the CMS/homepage editor and the additional schema
items below. The isolated migration rehearsal and CMS acceptance are complete.
The production rollout uses the existing publish script and Vercel predeploy;
the final deployment and database parity are checked after the push.

## Exact release scope

Include the CMS editor, page APIs/renderer, homepage/About integration, optional
section settings, navigation, upload/preview/revision controls, migration028 and
their shared origin/JSON helpers. Retain the existing production booking/auth/
catalogue behavior. Exclude the earlier dev-only routing/AI/hotels/contact and
booking/auth changes from application publication. Keep those local changes safe.

The required parity check found production at26 migrations and development at28.
It found exactly the expected CMS additions plus migration027's two coordinate
columns; no older column/type change or production-ahead migration. The existing
stronger gate refuses release until isolated replay proves those differences.

## Additional approval received

- Migration027 adds tourist_spots.latitude DOUBLE PRECISION NULL and
  tourist_spots.longitude DOUBLE PRECISION NULL, with paired-null and coordinate
  range checks. These were previously approved only for development. Applying
  them preserves migration parity; route optimization itself stays out of this
  release. The user explicitly approved production application on2026-11-06.
- Replay requires a temporary DEVELOPMENT database named
  travel_cms_release_check_20261106. Copy only the production schema and migration
  filenames, replay027/028 there, compare to development, then delete that exact
  temporary database. No production/customer data is copied. All41 resulting
  table names and462 column names/types are in db/cms-release-schema-review.json.
  The user explicitly approved this temporary rehearsal and cleanup on2026-11-06.

AGENTS.md requires confirmation before creating tables/adding columns. DEPLOY.md
requires isolated replay when pending migrations and schema differences coexist.
The current CMS production authorization already covers its two agreed tables;
these approvals cover the older coordinate migration and the temporary copies.

## Rehearsal result

Passed: production schema copied without customer data; migrations027/028 replayed
only in the temporary development database. All41 tables/462 columns and full
schema definitions match development. Home/About publications and their revisions
were seeded correctly. Production schema was unchanged, and the temporary database
was deleted with absence verified. Evidence: db/cms-release-replay.json.

The release gate validates evidence age (48 hours), cleanup, both endpoint/schema
fingerprints and all migration SQL hashes. Any changed/stale/missing evidence fails
closed. The original independent dev-baseline checks remain.23 drift/proof tests
passed. No production migrations are run manually.

## Hosting inspection

Vercel project travelease, team tus-githubs-projects. Production Cloudinary and
DATABASE_URL variables exist; no DATABASE_URL_APP production variable is configured,
so the existing production connection behavior remains unchanged. Secrets were
not printed or modified. Publishing still uses npm run publish from development,
with production migrations applied by Vercel predeploy, followed by live checks
and a final db:check.

## Exact release validation

Earlier development-only application work is preserved in a separate local Git
stash during publication. The release contains no changes to existing auth,
booking or contact handlers. The CMS-only source passes9 model test groups,
23 drift/proof tests and47 HTTP checks plus real Chrome/API/development
PostgreSQL/Cloudinary assertions. All synthetic records and the uploaded test
image were removed and absence verified. The isolated optimized Next build,
including TypeScript and lint, passed. Its temporary files were removed without
affecting the regular localhost build cache.

Production verification checks the deployment commit, live Homepage/About,
anonymous CMS access restrictions and database parity. Development content is
not copied to production; migration028 initializes the two default public pages.

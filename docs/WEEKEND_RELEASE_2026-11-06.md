# Weekend Trips production release — preparation

Requested 2026-11-06. User authorized publishing Weekend Trips and CMS filter/link
changes, including the known migration029 schema. Production remains on28;
development is29. Production migration remains scheduled for Vercel predeploy after publishing.

The parity gate detects pending029 and requires fresh schema-only replay evidence.
Executed db/weekend-release-replay.mjs and the exact45-table,
551-column inventory db/weekend-release-schema-review.json. Temporary DEVELOPMENT
name: travel_weekend_release_check_20261106. It copies schema only, replays029,
compares the result to development, then deletes the temporary database and verifies
absence. Production migration runs only automatically through Vercel deployment.
User approved the exact temporary schema and cleanup. Rehearsal passed against
production28 plus029:45 tables/551 columns match development, no customer data
was copied, and the temporary database was deleted with absence verified. The
fresh bound replay evidence makes db:check pass for the pending migration.

Release includes the shared departure/guide/hotel/room schema and operational UI,
public/customer shared checkout, existing booking/pricing/refund/inventory integration,
CMS catalogue models/renderer/editor/link resolver, package booking_mode and relevant
navigation. Preserve unrelated local work when preparing the clean development
release commit. Required booking concurrency and origin helpers are dependencies.
Exclude hotel search/enquiry, AI itineraries, route optimization, dynamic contact,
auth changes and unrelated database recovery tools from the application release.
Mixed files requiring a targeted release version include email.ts (shared deadline
wording only), navigation.ts (Weekend Trips links only), package pages (region filter
and booking mode, no hotel/AI/route UI) and CMS destination options (no unpublished
hotel destination). Dependency review/build of the exact release remains required.

Before publication: approve/run rehearsal, pass db:check, verify exact release
checkout with typecheck/lint/tests/build, preserve other local changes, commit only
release scope on development and run npm run publish. After Vercel READY, confirm
production routes/access and rerun db:check for IN SYNC29/29. Restore and verify
preserved local work. Record final commit/deployment and evidence here.

## Exact release validation

The curated release passed optimized isolated Next build, typecheck/lint,109 model
cases (8 weekend,12 CMS,42 pricing,25 booking lifecycle,22 refund), shared-seat
contention/expiry/rollback tests and10 private/coupon contention regressions.
Full Chrome acceptance passed30 Weekend +13 CMS HTTP checks and browser/DB
assertions: two customers, payment/guarantee/rooms, individual/group cancellation,
refund settlement, frozen route snapshots, CMS all-source preview/publish/filters,
old revision restore, mobile and live seat refresh. Synthetic fixtures/upload
cleaned; email stayed local. Production CMS has no conflicting weekend-trips slug.
Previous production:8457c8c / dpl_5CHh5XZ4sjyiz4LWnjmgkHN1wtds.

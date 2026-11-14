# Weekend Trips and CMS production release — 2026-11-06

Published and verified. Commit736f8e2ed57361ae84361389b904953abc2e8d9e,
Vercel deployment dpl_8BM36m2yTjD1QWZm7SkGErnjy2wd is READY and serves
https://travelease-rouge.vercel.app. Git main and origin/main match that commit;
working branch is development.

## Released scope

Friday group departures with inclusive per-person prices, driver/guide/vehicle
assignments, manual hotel arrangements, room allocation, public/customer shared
seat checkout and existing offline payment/cancellation/refund controls. CMS adds
Live catalogue sources, selection rules, visitor filters, layouts/count/order,
empty behavior and the published-page/record/filtered-listing/section/HTTPS picker.
Earlier hotel API, AI itinerary, routing, contact/auth and unrelated hardening UI
work remains local and unpublished. Necessary booking concurrency/origin helpers
are included. No new credentials or providers were required. Supplier reservations,
room upsells, shared-trip GPS and Razorpay remain deferred.

## Schema and publication

User authorized production publication and explicitly approved temporary DEVELOPMENT
travel_weekend_release_check_20261106 with the45-table/551-column schema inventory.
The schema-only rehearsal copied no customer data, replayed029, matched development
and deleted the temporary database with absence verified. Bound replay evidence
passed the release gate. npm run publish merged development into main and pushed
both branches; one initial DNS lookup failure stopped before any push and cleared
on retry. Vercel predeploy automatically applied029; no manual production migration.
Final db:check is IN SYNC29/29 with no definition differences.

## Verification and preservation

Exact release: optimized isolated build, typecheck/lint,109 model cases, shared-seat
contention/payment-expiry/bulk-rollback and10 private/coupon concurrency cases.
Full Chrome/API/dev PostgreSQL acceptance:30 Weekend and13 CMS HTTP checks plus
actual two-customer checkout/payment/guarantee/room/cancellation/refund flows,
frozen route snapshots, catalogue all-source rendering, filters, preview/publish,
old-revision restore, live seat refresh and mobile. Fixtures/upload cleaned and
email confined to memory/loopback.

Production read-only acceptance: listing/API200, invalid filter400, missing trip404,
admin trips/guides/CMS options401; mobile has no horizontal overflow, admin/CMS
routes redirect guests to login, zero browser runtime errors. Existing production
CMS has no conflicting weekend-trips slug. No live bookings/pages/accounts created.
Production starts with no development departures/pages copied; admin creates their
real trips and publishes their own CMS content.

Preserved all earlier local work using a hash backup and one temporary stash.
Restored and byte-verified157 original files, retaining this updated release record,
then deleted only that owned stash. Artifact backups remain available. Localhost
returns200 for auth state and Weekend Trips after restoration. No secrets staged.

Admin routes: /admin/weekend-trips, /admin/tour-guides and /admin/pages.
Homepage section setup: Add section -> Live catalogue -> content source/rules ->
visitor filters. Button link -> Choose destination. Operating guide:
docs/WEEKEND_TRIPS_PLAN.md. Production CMS content is independent from development.

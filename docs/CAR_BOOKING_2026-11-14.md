# Car booking, per-car rates and free maps — 2026-11-14

## Implemented on development

- Fleet → Add/Edit vehicle has a required **Price / km (₹)** control. Creating a
  vehicle and its distance pricing is one transaction. A changed rate updates
  point-to-point, airport and outstation rules; unchanged rates preserve advanced
  trip-specific pricing. New rules introduce no invented base fare/minimum/tax.
- **Car pricing** is admin-only and edits per-car, vehicle-type and all-vehicle
  rules through the existing unified pricing engine. Specific car wins, then
  vehicle type, then global fallback. Existing bookings retain their snapshots.
- Booking uses a custom calendar and hour/minute/AM-PM controls. Pickup clocks,
  effective-rate dates and seasonal dates use IST independently of device
  timezone. Invalid calendar dates/past pickups are rejected. Confirmation and
  customer/admin booking screens display the scheduled time in IST.
- Customers explicitly search public places or choose pickup/destination pins
  on an optional map. Selecting both automatically calculates road distance;
  outstation routing includes the actual return leg. Distance is read-only.
- Quotes and booking creation require a trusted, unexpired server cache route
  matching both selected points and the trip direction. Customer kilometres
  and totals do not determine the price. This also protects unassigned/generic
  distance trips, preventing a missing-vehicle-ID bypass. A changed expected
  fare returns409 for review. Route facts are saved in existing booking JSON.
- Profile geocoding shares the same gate and now uses an explicit search button,
  covering the whole app rather than leaving an autocomplete path outside limits.

## Free-service policy and limits

No paid account, API key, card, billing, automatic top-up or provider migration
was enabled. Default geocoding is Nominatim and routing is FOSSGIS OSRM. The
provider origins can be switched by server configuration without a code release:
`BOOKING_GEOCODE_ORIGIN`, `BOOKING_ROUTING_ORIGIN`. Only HTTPS origins are
accepted. The map tile URL can be configured with `NEXT_PUBLIC_BOOKING_TILE_URL`.
`BOOKING_MAPS_DISABLED=true` stops new upstream map requests.

Shared PostgreSQL reservations cap each provider at **one request per1.1seconds
and200 per UTC day**, across server instances. Cache hits do not consume quota;
results expire after24hours. The allowance commits before contacting a provider;
uncertain commit acknowledgement fails closed. Provider failures and failed cache
writes cannot refund the allowance. Busy/limit/down/no-route cases return clear
errors without guessing a distance or silently switching to paid services.

Search is explicit, not autocomplete. Public place search text and route points
are sent to providers; names, phones and private booking instructions are not
part of those requests. Attribution is visible. Tiles load only when the optional
map opens; there is no bulk prefetch, offline tile download or automated real-tile
crawl. Availability remains best effort, not guaranteed production capacity.

Policies: [Nominatim](https://operations.osmfoundation.org/policies/nominatim/),
[FOSSGIS routing](https://routing.openstreetmap.de/about.html),
[OSM tiles](https://operations.osmfoundation.org/policies/tiles/).

## Schema and review

User explicitly approved the names/types in chat. Append-only
`030_car_pricing_and_map_services.sql` adds nullable `pricing_rules.vehicle_id`
and the `map_service_cache` / `map_service_usage` tables. No new booking columns.
030 was applied to development only; do not edit it or manually migrate production.

Strict development review verifies only the two tables, ten columns (including
vehicle_id), four indexes, their constraints and new-table grants were added.
All29 historical migration hashes and original schema/grant definitions remain
unchanged. The29 baseline is archived as
`db/dev-schema-baseline-before-car-booking.json`; reviewed30 baseline and exact
differences are in `db/dev-schema-baseline.json` and
`db/car-booking-schema-review.json`. Development drift check passes30 migrations.
The coordinating combined-release chat owns final replay proof, parity and deploy.

## Verification

- Project TypeScript, lint and isolated optimized production build passed.
-15 map/date safety checks pass: IST/invalid dates, coordinate validation,
  cache hits, durable reservation/cache-write failure, uncertain commit,
  provider failure, daily/rate/concurrent gate, rollover, kill switch,
  return-leg routing and altered/missing route proof.
- Five existing Chrome quote-race groups pass with the actual BookingFlow.
  Existing10 private-booking concurrency groups pass using synthetic trusted
  routes;42 pricing,25 booking-state and22 refund assertions pass.
- Final isolated production-build Chrome journey passes16 HTTP checks plus
  UI/database assertions: admin adds a vehicle with₹18/km; optional pricing
  charges; customer chooses a custom date/time, searches places, opens a map,
  receives automatic12.34km and₹338.23 quote, books, sees the saved confirmation,
  then admin confirms offline payment and overlap is rejected. The customer
  browser uses America/New_York;10:30IST persists as05:00UTC. Includes capacity,
  vehicle-type/route/distance tampering, past dates and stale-fare rejection.
  Two emails captured on loopback; three synthetic provider replies. Cache keys
  use test-only HTTPS origins, isolated from real provider cache entries. Test
  users/cars/rates/bookings were removed and absence verified. Automated tiles
  were replaced with a local test image; no real tile crawling.
- Separate real-provider smoke used only public India Gate/Akshardham landmarks:
  Nominatim and FOSSGIS succeeded,8.99km/approximately13minutes,23 geometry points.
  At most two real searches and one route; no private address or paid service.
- Independent source backup contains467 files, including25 pre-existing local
  changes at75caf4f. Normal localhost and its build cache were not replaced.

## Handoff and limits

The user assigned another chat to combine and deploy all local work. This chat
leaves changes on development without commit, stash, checkout, backup restoration
or publication. The coordinator owns merging older catalogue/notification/runtime
work, the combined regressions, replay evidence, `npm run publish` and live checks.

Production was read-only inspected: Innova Crysta and Force Traveller exist but
**no pricing rules were configured**. User instructed that the admin enters rates
in Fleet Add/Edit; no live business rates were invented or seeded. Admin must
set prices on those existing vehicles before distance bookings can quote there.
Hourly/day rates are managed separately through Car pricing. Real paid bookings,
payments, customer mail/SMS, Authgear activation and production mutations were
not tested or performed here. Free provider availability/daily limits remain
operational limits.

Reproducible commands: `npm run test:booking-maps`, `npm run test:private-quotes`
with `--browser-module=…`, `npm run test:car-booking -- --built
--browser-module=… --artifacts=…`, and existing pricing/bookings/refund/concurrency
commands. Use Node24, development-only environment guards, and sequential real
database suites. The old saved booking acceptance/catalogue tests in the combined
checkout must also supply synthetic trusted routes for distance-booking inputs;
do not weaken production route verification to make legacy fixtures pass.

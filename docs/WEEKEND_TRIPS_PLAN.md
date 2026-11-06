# Weekend Trips and CMS content controls

Requested 2026-11-06. Status: all four development chunks complete and verified. Production unchanged.
The user explicitly approved all four tables and six added columns below on
2026-11-06. Development first; production requires separate publication
approval. The user selected one inclusive per-person price, covering the stated
transport, driver/guide and hotel stay. Existing admin-confirmed offline payment
continues; Razorpay remains deferred.

## Product and booking model

Customers join a scheduled group trip with other travellers. Admin decides the
destination, Friday departure/return times, itinerary, pickup, transport, guide,
stay arrangements, inclusions and price. Customers choose a date and passenger
count; they do not reserve the entire vehicle or design this group's route.

Reuse packages/package_stops as reusable itinerary templates. A departure is the
dated operating instance: e.g. the same template can run on several Fridays with
different staffing, capacity and price. Admin can create the next Friday from a
previous departure, review the dates/resources and publish explicitly. Do not
silently auto-publish recurring trips with unconfirmed arrangements. Interpret
Friday in Asia/Kolkata, storing actual timestamps as TIMESTAMPTZ.

Extend the existing bookings model with an optional departure reference. One
customer booking can contain one or several travellers using booking_passengers.
Reuse existing accounts, pricing calculation, status history, offline payment,
customer booking history, notifications and cancellation/refund services.

**Plan change:** plan.md section15 currently describes one customer reserving one
vehicle. Shared departures add a second inventory mode within the same booking
model. Individual seat bookings must not each reserve/release the whole vehicle.
Section13's existing package templates remain the itinerary source.

## Admin experience

Add Weekend Trips in the existing admin panel with the same buttons and branded
dialogs. A departure editor has Overview, Schedule & pickup, Itinerary, Transport
& team, Hotels & rooms, Price & seats, Travellers and Publication sections.

| Area | Admin controls |
| --- | --- |
| Overview | Title, destination/template, photos, description, featured flag |
| Schedule | Friday date/time, return, pickup city/address, booking window |
| Itinerary | Ordered day plan, existing tourist spots, activities, meals, inclusions/exclusions |
| Transport | Existing fleet vehicle and driver; reserve staff seats explicitly |
| Guide | Reusable guide roster, name, photo, languages, introduction, internal contact details |
| Stay | One or more hotels, dates, room type/count, sharing capacity, meal plan, confirmation status |
| Hotel operations | Supplier reference/contact/cost, internal notes, traveller-to-room allocation |
| Pricing | Final inclusive per-person amount, tax breakdown, seat limit, payment-hold duration |
| Group operation | Minimum travellers, go/no-go deadline, seat totals, pending payments, traveller manifest |
| Publication | Draft, open, guaranteed, closed, ongoing, completed or cancelled; preview and confirmation |

Hotels are arranged and recorded by admin in this version. Recording a stay does
not reserve a room with a supplier, charge a card or contact the hotel. The
previous LiteAPI search/enquiry feature is a separate integration. No live room
inventory or paid room upgrades are implied by this scope.

One departure has one vehicle, one assigned driver and one assigned guide in the
first version. Multiple hotels across nights are supported. Extra vehicles,
multiple guides, supplier payments/accounting, room upsells and automatic weekly
publication are later extensions. Guide entries are roster records, not a new
login system. Shared-trip GPS needs its own reviewed extension to the existing
booking-based tracker and is not promised in this first booking release.

## Customer experience and booking rules

1. Browse /weekend-trips: destination, departure date, pickup city, inclusive price,
   availability and whether the trip is guaranteed or awaiting its minimum group.
2. Open a dated trip: itinerary, photos, stated hotel/room sharing/meals, public
   guide introduction, inclusions/exclusions and cancellation conditions.
3. Choose traveller count and enter the existing passenger details. Every traveller
   occupies one seat at the same inclusive price in version1; no infant/child
   tariff or paid hotel upgrade is silently assumed.
4. Server creates one PendingPayment booking with an expiring seat hold. Show the
   precise payment deadline and the existing offline payment instructions.
5. Admin verifies payment through the existing booking lifecycle. Confirmation
   requires the hold still to be valid and the departure still open/eligible.
6. The customer sees their own travellers, booking, pickup, assigned contacts when
   appropriate and cancellation/refund status. Public pages show seat counts, not
   stranger names, phone numbers, room assignments or emergency details.

Inventory is derived from confirmed bookings and unexpired PendingPayment holds,
not a browser counter. Lock the departure row for every seat-affecting operation
and count seats on the same transaction client. Recheck cutoff, departure status,
quantity and price on submission. Competing requests for the final seat must have
one winner. A unique customer/request key makes retried submissions return the
same booking instead of consuming seats twice.

Set an admin-controlled payment-hold duration (proposal: default120 minutes,
range5–1440), capped by booking close time. Expired holds stop consuming inventory
immediately, even if no scheduled cleanup ran. An expired reservation cannot be
marked paid by bypassing a capacity check. Show its expiry clearly; retirement
to Cancelled uses the central lifecycle. The expiry worker/scheduling mechanism
must be chosen and verified during implementation, not assumed to exist.

Reserve the vehicle once per published departure through vehicle_availability.
Cancelling one traveller booking releases only that booking's seats/room allocation.
It must not release the shared vehicle block. Cancellation of the departure closes
sales and uses existing operator-initiated cancellation/full-refund obligations for
paid bookings. Offline refunds remain owed until the admin records actual settlement.
Whole-booking cancellation is supported first; partial cancellation of only one
traveller within a booking is a separate extension.

Capacity cannot exceed the assigned vehicle's usable passenger seats after staff
reservations, or the available confirmed accommodation beds on any stay night.
Admin cannot shrink capacity below existing commitments. Room assignments must
belong to the same departure, respect booked room/bed counts, and never reveal
another customer's private data. Guides/drivers cannot be assigned to overlapping
operating trips; validate relevant existing private bookings too.

The final displayed price must match the checkout total for the selected quantity,
with its tax/discount breakdown computed by the existing pricing engine. Extend
that engine for an inclusive package amount without adding tax or seasonal charges
twice. Never accept a client-supplied rate, total, seat count availability or status.
Store the agreed itinerary/inclusions/policy and price snapshot with the booking.
Later template edits must not rewrite an existing customer's agreed trip. Material
schedule/itinerary changes after sales require an explicit amendment workflow,
reason, customer notification and cancellation handling; do not silently overwrite.

## Approved development database schema

All names below are approved for DEVELOPMENT only. Existing migrations001–028
remain immutable. Recheck the working schema/baseline before assigning a new
migration number. Migration029 implements these approved definitions.

Common columns on all four new tables (exactly these six fields):

| Column | Type / default |
| --- | --- |
| created_by | UUID NULL FK users.user_id |
| updated_by | UUID NULL FK users.user_id |
| created_at | TIMESTAMPTZ NOT NULL DEFAULT now() |
| updated_at | TIMESTAMPTZ NOT NULL DEFAULT now(); existing update trigger |
| is_deleted | BOOLEAN NOT NULL DEFAULT false |
| is_active | BOOLEAN NOT NULL DEFAULT true |

### tour_guides

| Column | Type / rules |
| --- | --- |
| guide_id | SERIAL PRIMARY KEY |
| name | VARCHAR(150) NOT NULL |
| phone | VARCHAR(30) NOT NULL; private contact |
| image_url | VARCHAR(500) NULL |
| bio | TEXT NOT NULL DEFAULT '' |
| languages | JSONB NOT NULL DEFAULT '[]'; validated string array |
| private_notes | VARCHAR(1000) NULL |
| Common columns | All six columns above |

### trip_departures

| Column | Type / rules |
| --- | --- |
| departure_id | UUID PRIMARY KEY DEFAULT gen_random_uuid() |
| package_id | INT NOT NULL FK packages.package_id |
| slug | VARCHAR(160) NOT NULL UNIQUE |
| title | VARCHAR(200) NOT NULL |
| starts_at | TIMESTAMPTZ NOT NULL |
| ends_at | TIMESTAMPTZ NOT NULL; after starts_at |
| pickup_city_id | INT NOT NULL FK cities.city_id |
| pickup_address | VARCHAR(300) NOT NULL |
| return_address | VARCHAR(300) NOT NULL |
| vehicle_id | INT NULL FK vehicles.vehicle_id; required before sales open |
| driver_id | INT NULL FK drivers.driver_id |
| guide_id | INT NULL FK tour_guides.guide_id |
| capacity | INT NOT NULL; positive |
| staff_reserved_seats | INT NOT NULL DEFAULT 0; nonnegative |
| min_travellers | INT NOT NULL DEFAULT 1; between1 and capacity |
| price_per_person | NUMERIC(10,2) NOT NULL; positive, final inclusive INR price |
| tax_percent | NUMERIC(5,2) NOT NULL DEFAULT 0; configured breakdown,0–100 |
| booking_opens_at | TIMESTAMPTZ NOT NULL |
| booking_closes_at | TIMESTAMPTZ NOT NULL; after opening and before departure |
| decision_deadline | TIMESTAMPTZ NOT NULL; after opening, no later than booking close |
| payment_hold_minutes | INT NOT NULL DEFAULT 120;5–1440 |
| status | VARCHAR(16) NOT NULL DEFAULT 'draft'; draft/open/guaranteed/closed/ongoing/completed/cancelled |
| content | JSONB NOT NULL; validated public description/photos/day plan/inclusions/exclusions/FAQs |
| private_notes | VARCHAR(2000) NULL |
| version | INT NOT NULL DEFAULT 1; positive optimistic concurrency token |
| is_featured | BOOLEAN NOT NULL DEFAULT false |
| display_order | INT NOT NULL DEFAULT 0 |
| Common columns | All six columns above |

### trip_stays

| Column | Type / rules |
| --- | --- |
| stay_id | UUID PRIMARY KEY DEFAULT gen_random_uuid() |
| departure_id | UUID NOT NULL FK trip_departures.departure_id |
| hotel_name | VARCHAR(200) NOT NULL |
| hotel_address | VARCHAR(500) NOT NULL |
| city_id | INT NULL FK cities.city_id |
| image_url | VARCHAR(500) NULL |
| check_in | DATE NOT NULL |
| check_out | DATE NOT NULL; after check_in |
| room_type | VARCHAR(120) NOT NULL |
| rooms_reserved | INT NOT NULL DEFAULT 0; nonnegative |
| occupancy_per_room | INT NOT NULL; positive |
| staff_beds_reserved | INT NOT NULL DEFAULT 0; nonnegative |
| meal_plan | VARCHAR(200) NOT NULL DEFAULT '' |
| confirmation_status | VARCHAR(16) NOT NULL DEFAULT 'pending'; pending/confirmed/cancelled |
| supplier_reference | VARCHAR(120) NULL; private |
| contact_name | VARCHAR(150) NULL; private |
| contact_phone | VARCHAR(30) NULL; private |
| supplier_cost | NUMERIC(12,2) NULL; nonnegative, private |
| public_notes | VARCHAR(1000) NULL |
| private_notes | VARCHAR(2000) NULL |
| Common columns | All six columns above |

### trip_room_assignments

| Column | Type / rules |
| --- | --- |
| assignment_id | UUID PRIMARY KEY DEFAULT gen_random_uuid() |
| stay_id | UUID NOT NULL FK trip_stays.stay_id |
| booking_passenger_id | INT NOT NULL FK booking_passengers.booking_passenger_id |
| room_label | VARCHAR(60) NOT NULL; internal room/room-group identifier |
| private_notes | VARCHAR(500) NULL |
| Common columns | All six columns above |

One active assignment per stay/passenger; verify departure ownership and room/bed
limits under transaction locks. Physical room numbers may be assigned later using
the internal room label. Avoid cascading deletion of sold trip history.

### Columns added to existing tables

| Table.column | Type / rules |
| --- | --- |
| packages.booking_mode | VARCHAR(16) NOT NULL DEFAULT 'private'; private/shared/both |
| bookings.departure_id | UUID NULL FK trip_departures.departure_id |
| bookings.seat_hold_expires_at | TIMESTAMPTZ NULL |
| bookings.client_request_id | UUID NULL; unique(user_id,client_request_id) for non-null keys |
| bookings.trip_snapshot | JSONB NULL; immutable agreed public itinerary/inclusions/policy snapshot |
| vehicle_availability.departure_id | UUID NULL FK trip_departures.departure_id |

Keep existing private-booking behavior when departure_id is NULL. A vehicle block
must not reference both a booking and a departure; allow one active block per
departure. Existing package browsing/booking must respect booking_mode, so a
shared-only itinerary cannot accidentally be sold as an unrestricted private trip.
Typed columns/FKs own inventory and money; JSON stores bounded descriptive content.
No new customer, passenger, booking, payment or authentication tables are proposed.

## CMS content, filters and links

Development now has17 section types. The new repeatable **Live catalogue** section
uses Vehicles, Packages or Weekend Trips. Existing manual cards, text, FAQ and
homepage sections remain compatible with saved publications and revisions.

| Control | What the editor does |
| --- | --- |
| Content source | Select Vehicles, Packages or Weekend Trips |
| Layout | Grid or list, using the existing navy/amber cards and buttons |
| Selection rules | Vehicle category; destination region; pickup city/date range for trips; price/capacity; availability; featured trips |
| Visitor filters | Independently enable search, relevant category/destination/pickup/dates, budget, group size and order |
| Sort and count | Recommended (nearest date for trips), price or name;1–24 cards |
| Card click | Opens the real vehicle, package or dated trip details |
| Section button | Choose a published page, record, supported filtered listing, same-page section or external HTTPS site |
| Empty results | Hide the content or show a custom message; visitor filters retain a reset option |

Admin selection is applied before visitors narrow results, sorting and display
count. Changing source clears rules which no longer apply. Packages use private
or both-mode templates; shared-only packages appear through dated Weekend Trips.
Vehicle availability is the catalogue availability flag, not a date reservation
promise. Weekend queries select up to200 matching upcoming departures and refresh
availability every30 seconds while the page is visible; checkout always checks
capacity again under transaction locks. A refresh failure shows a clear message.

For example: Pages / CMS → edit Homepage → Add section → Live catalogue → Weekend
Trips → minimum seats1 → nearest departure first →6 cards. Enable Pickup, Dates
and Budget if visitors should narrow the selection. Under Button link, Choose
destination → Filtered listing → Weekend Trips, then choose supported filters.
Cards automatically open their own departure; the section button uses your link.

Every URL field, including nested card links, has the destination picker. It reads
real published records and resolves page/record/listing choices on the server.
Vehicle listing links support category; package links support regionId; Weekend
Trips support pickup/destination, dates, budget and seats. Same-page anchors use
the actual section IDs. External links require HTTPS. Existing safe manual paths
remain available; typing an arbitrary query parameter does not add new filtering
behavior. Text/FAQ sections have no catalogue filters.

All choices use the existing CMS JSONB documents. No extra CMS tables or columns,
SQL editor, JavaScript injection, client price override or new auth system. Saved
draft preview and public pages share the renderer; publishing code never copies
development page content into production.

## Admin operating guide

1. Under Packages, create the route template and set Booking mode to Shared or
   Both. Under Weekend Trips → Guides, create the guide profile. Vehicle and
   driver records are reused from the existing admin panel.
2. Create a Friday departure. Set pickup/return dates in India time, addresses,
   itinerary and cover photo, selected vehicle/driver/guide, customer capacity and
   staff seats, paid minimum, inclusive per-person price/tax, booking window,
   decision deadline and payment hold duration.
3. Add each included hotel night and reserved room group. Keep supplier reference,
   contact, costs and operations notes private. Mark hotel arrangements confirmed
   only after securing them yourself. Staff beds reduce customer capacity.
4. Save and preview. Manage trip → Open bookings checks capacity, active resources,
   resource overlaps and enough confirmed hotel beds, then creates one vehicle
   reservation for the whole departure. Public route-stop names freeze at opening.
5. Customers open /weekend-trips, select the dated trip and reserve seats through
   existing checkout. Pending holds consume seats until their exact DB deadline.
   Confirm payment in Manage trip only after receiving it and before expiry.
6. Guarantee the departure once the paid minimum is met. At the decision deadline,
   an unguaranteed departure pauses new bookings; admin must make the decision.
   Hotel rooms assigns confirmed travellers without exposing other customers.
7. Start/complete the group centrally. Individual cancellations keep the shared
   vehicle block. Cancel departure records full operator refunds for paid bookings;
   settle the actual refund through the existing Booking / refund controls.
8. Copy next Friday creates a fresh draft with shifted dates and hotel confirmation
   reset. Review its vehicle, staff, beds and pricing before opening it.

Expired holds immediately stop consuming inventory. Retire expired holds records
cancellation through the normal lifecycle; no scheduler/cron is assumed. Published
sold plans cannot be silently edited. Close and return to draft only with no paid
or live-held seats, otherwise cancel and arrange a replacement.

V1 deliberately excludes supplier hotel reservation APIs, room upgrades, coupons
on the inclusive shared price, automatic weekly publication, multi-vehicle groups
and shared-trip driver GPS. Existing private-trip features stay separate.

## Delivery chunks and acceptance

1. Confirm schema; add the append-only development migration and guarded dev
   baseline/runtime-role update. Build admin guide roster, departures and manual
   stays with preview and validation; test permissions, conflicts and capacity.
2. Shared-seat quote/booking through the existing lifecycle: idempotency, expiring
   holds, offline confirmation, one departure vehicle block, cancellation/refund,
   snapshots and room assignment. Prove final-seat and payment/expiry races with
   real dev PostgreSQL transactions; exercise rollback and ownership checks.
3. Public listing/detail/checkout and admin manifests/operating controls. Test a
   Friday trip with multiple unrelated customer bookings, staff/hotel limits,
   customer/whole-trip cancellation and refund settlement. Branded popups throughout.
4. CMS source/filter controls and destination picker, including Weekend Trips;
   verify old JSON/revisions, actual filter queries, valid destinations, preview
   and public rendering in desktop/mobile layouts.

Each chunk must pass typecheck, lint and relevant tests before the next begins.
Final acceptance uses development fixtures and existing accounts/storage, cleans
them up, and records evidence. No production schema, content, environment or code
publication until the user separately authorizes the finished release.

### Verification recorded so far

- Chunk1: migration029/dev baseline and restricted grants verified;8 domain groups
  (including inclusive pricing), typecheck/lint;18 HTTP checks plus real Chrome,
  Cloudinary and development database save/edit assertions. Hotel DATE values
  remain calendar dates after repeated round-trips. Synthetic data/upload removed.
- Chunk2: real PostgreSQL last-seat, duplicate-request and payment/expiry races;
  cancellation/refund/room ownership, resource limits, group operation and injected
  bulk-cancellation rollback. Existing private booking/coupon regression passes.
  Holds stop consuming seats by DB clock without a scheduler. Admin can retire
  expired holds through the `expire` operation; closing/start/cancel flows enforce
  their own checks. No cron is assumed. Weekend inclusive prices have no coupons
  in version1; private booking coupon behavior is unchanged.
- Chunk3: optimized local build, typecheck/lint and30 real HTTP checks plus
  Chrome/mobile checkout, two customer bookings, offline payment, guarantee, room
  allocation/privacy, individual/group cancellation and offline refund settlement.
  Synthetic fixtures/upload removed and email confined to a loopback sink.
- Chunk4:12 CMS model groups and13 HTTP checks plus real Chrome editor/source
  changes, destination picker, preview/publish, all three public catalogue sources,
  filters, mobile overflow, empty behavior and old-revision restore. Live trip seats
  updated from6 to8 after one customer's cancellation without reloading the CMS page.
- Final full browser run passed30 Weekend +13 CMS HTTP checks with zero page errors;
  frozen route names survived a template stop being removed before reservation.
  Optimized isolated Next build, typecheck/lint and whitespace checks pass. Repeated
  shared transaction/rollback and10 private/coupon contention regressions pass,
  plus42 pricing,25 lifecycle and22 refund cases. Dev schema/checksums match29.
- Synthetic accounts, sessions, bookings, departures, pages/history, room/stay data,
  fleet/template/guide fixtures, audit rows and test upload were cleaned. Emails
  stayed in memory or a loopback SMTP sink. No production connection, commit/push,
  deployment, provider configuration change or unapproved schema was made.

## Implementation map

- Schema: db/pg-migrations/029_weekend_trip_departures.sql, guarded
  db/weekend-setup-dev.mjs, current and archived development baselines.
- Booking rules/services: src/lib/weekend-trips.ts, weekend-public.ts;
  src/lib/server/weekend-trips.ts, weekend-bookings.ts, weekend-operations.ts,
  weekend-resources.ts, weekend-public.ts and weekend-http.ts. Existing bookings,
  pricing, availability, refunds, notifications and admin resource services reused.
- UI: src/components/weekend/*; public /weekend-trips and existing checkout/profile
  pages; /admin/weekend-trips and /admin/tour-guides; existing admin booking,
  package-mode controls, sidebar and site navigation.
- CMS: src/lib/cms-catalogue.ts, src/lib/server/cms-catalogue.ts,
  /api/admin/cms/options; CatalogueBrowser, CmsCatalogueEditor, CmsControlsContext,
  CmsLinkField and existing CmsFields/CmsEditor/CmsRenderer/model. Package listing
  supports regionId, and hero/animation sections expose their real anchor IDs.
- Tests: db/tests/weekend-trips.test.ts, weekend-bookings.test.ts,
  weekend-admin-acceptance.ts, cms-catalogue-acceptance.ts and cms.test.ts;
  _booking-server.cjs supports isolated optimized acceptance. Commands in DEPLOY.md.
- Records: MEMORY.md, plan.md, docs/CMS_PLAN.md and this operator guide.

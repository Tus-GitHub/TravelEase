# Package-first travel

Packages, weekend groups and guided custom itineraries are the primary journeys.
The hero keeps the trip focus. Vehicles appear directly after it; picking a car opens three tabs: Choose Package, Create Package and Point to Point.

- Admin → Packages (`/admin/packages`): publish fixed itineraries or guided routes, per-person prices, listed hotel details, meals, guide arrangements and exclusions.
- Admin → Weekend Trips (`/admin/weekend-trips`): create dated group departures. Reuse a fixed package as a draft, then confirm the assigned vehicle, driver and any required guide/beds before opening sales.
- Admin → Pages (`/admin/pages`): edit and publish homepage copy, section visibility/order and imagery. Published CMS snapshots remain authoritative; no runtime code rewrites later edits.

Choosing a car opens `/booking?vehicle=ID`, with packages filtered by the car’s vehicle type. Package cards, guided route choices and custom transport planning carry that vehicle into checkout; the server still checks type, capacity, availability and price. Shared departures retain their own assigned vehicle. Users can explicitly remove the selected vehicle to explore all packages.

Create Package always opens the interactive region/destination/route builder. Published guided routes remain available alongside it; no contact or email gate replaces self-service. Point-to-point checkout is the third tab and remains linked from the footer. Existing direct checkout URLs, pricing rules and booking records continue to work. Vehicle hire rates are labelled separately from package totals.

Empty catalogues show planning/contact options, not fabricated commercial inventory. The operator must publish actual packages, prices and group departures in admin.

The one-time homepage update uses the existing version-checked CMS save/publish workflow and saves a normal revision. It refuses when an unrelated draft exists. Previous content snapshots and exact release manifests are kept outside the tracked repository. No schema, map-provider, billing or OTP change is required.

Location fields show suggestions while typing, without a Search location button. Photon uses the existing shared cache and200/day1.1-second provider gate; public Nominatim is used only for deliberate map lookups. Admin geography fills names, available state/city information and coordinates, and matches existing parents; ambiguous/missing parents require selection. No region/city/spot is silently created. Map selection is optional, lazy-loaded and attributed. Package hotel/location fields and catalogue location dropdowns are searchable too.

Self-built routes choose a real available car. An explicitly configured package rate wins. If absent, the car’s existing admin-set daily hire rate supplies the transport quote; zero or unavailable rates fail closed. Curated per-person packages retain their own pricing. The booking transaction rechecks the fallback day rate and rejects changes before saving. Admin can edit the vehicle’s daily hire rate in Vehicles, or set explicit multi-day/package rates in Car pricing. Accommodation/meals/guides/extras are included only when listed; route planning does not invent those promises.

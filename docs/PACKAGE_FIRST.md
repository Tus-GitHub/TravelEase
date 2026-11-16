# Package-first travel

Packages, weekend groups and guided custom itineraries are the primary journeys.
The homepage and header lead with these choices; vehicles support the trip.

- Admin → Packages (`/admin/packages`): publish fixed itineraries or guided routes, per-person prices, listed hotel details, meals, guide arrangements and exclusions.
- Admin → Weekend Trips (`/admin/weekend-trips`): create dated group departures. Reuse a fixed package as a draft, then confirm the assigned vehicle, driver and any required guide/beds before opening sales.
- Admin → Pages (`/admin/pages`): edit and publish homepage copy, section visibility/order and imagery. Published CMS snapshots remain authoritative; no runtime code rewrites later edits.

Choosing a car opens `/booking?vehicle=ID`, with packages filtered by the car’s vehicle type. Package cards, guided route choices and custom transport planning carry that vehicle into checkout; the server still checks type, capacity, availability and price. Shared departures retain their own assigned vehicle. Users can explicitly remove the selected vehicle to explore all packages.

Point-to-point transfers remain a separate option after package planning and in the footer. Existing direct checkout URLs, pricing rules and booking records continue to work. Vehicle hire rates are labelled separately from package totals.

Empty catalogues show planning/contact options, not fabricated commercial inventory. The operator must publish actual packages, prices and group departures in admin.

The one-time homepage update uses the existing version-checked CMS save/publish workflow and saves a normal revision. It refuses when an unrelated draft exists. Previous content snapshots and exact release manifests are kept outside the tracked repository. No schema, map-provider, billing or OTP change is required.

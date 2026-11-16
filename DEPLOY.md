# Deploying TravelEase (free)

## Guided custom trips and grouped admin navigation — 17 November 2026

**Create Package** now follows the package's existing admin-configured destination
tree directly, instead of offering arbitrary spots and a route optimiser. Choose
a Region and a published guided package; a single starting point is preselected.
Only the current stop's allowed next destinations are offered. Changing an earlier
stop removes the later branch. Nights, included meals and per-person price update
from the existing plan; checkout revalidates the real package, allowed path,
vehicle, availability and final price. Existing saved itinerary endpoints remain
compatible, but freeform routing is no longer the default custom-package UI.

Set this up under **Admin → Trips & Packages → Packages & Routes**. Add/edit a
private package, enable its reusable itinerary and “approved next destinations”,
add the destinations, mark its starting point(s), connect each allowed next stop,
and choose where customers may finish. Set actual nights, prices, meals, stays,
guide/inclusion/exclusion details and activate the package. The visual tree
preview shows all admin branches; customers see one decision at a time. A Region
with no active, valid guided package shows an honest unpublished state, never
fabricated connections, hotels or prices. A selected explorer place filters to
plans that offer it. Vehicle-specific entry retains its chosen vehicle.

Region covers use an uploaded Region photo first, otherwise a real active local
destination photograph from that Region. The compressed licensed files are static
app assets; no paid provider, map call, image transform or new storage is needed.
Replace covers in **Admin → Destinations → Geography → Regions**.

Desktop and mobile admin navigation share seven ordered groups: Overview,
Trips & Packages, Bookings & Customers, Vehicles & Partners, Destinations,
Pricing & Offers, Website & Settings. The same19 existing links, role grants and
admin-only tools remain; empty groups are hidden for limited staff. Dashboard
stays first, Car pricing sits beside Vehicle, and Pages / CMS sits with settings.
No schema, migration, authentication or billing setting changes in this release.

## Empty returns and round-trip dates — 15 November 2026

In **Admin → Car pricing**, edit an individual car's **Point to point** or
**Airport transfer** rate. Enable **Charge for this car’s empty return on this
trip type** and enter its separate ₹/km rate. Leave it off when it does not apply.
The server calculates the actual reverse road distance from destination to pickup
through the existing free routing cache/quota. It never doubles outbound km or
trusts customer-supplied return km. Quotes itemise this charge before confirmation;
it participates in the same subtotal, coupon, seasonal and tax calculation.
Existing bookings keep their saved rate and route snapshot. Changing the ordinary
vehicle ₹/km rate preserves its empty-return policy. No live prices are invented.
Vehicle availability includes the outbound and paid empty-return driving time;
a caller cannot shorten that reservation by supplying a false one-way end time.

**Outstation (round trip)** asks for a return date/time in the same branded selector.
The server derives days/nights from Indian calendar dates, stores the actual return
time and checks the car's whole reservation window. The customer travels back too:
both road directions are already included, with no additional empty-return charge.
The selected return must allow at least the calculated road driving time.
The checkout keeps optional address instructions, notes and discount codes collapsed.

Migration032 adds the three user-approved columns: two pricing-rule policy fields
and packages.trip_content JSONB (reserved for the next package-template release).
Old rates remain disabled for empty returns by default. Development migration and
strict baseline/replay review precede publication; production migration is automatic.
Run test:pricing, test:empty-return and test:booking-contact-db, plus typecheck/lint,
then test admin policy changes and customer one-way/round-trip bookings live.

## Fewer-click pickup, destination and contact — 15 November 2026

Booking pickup/destination fields suggest Indian places while typing, using
Photon's public reasonable-use service. Public Nominatim remains for deliberate
manual searches/reverse lookup; its API is never used for type-ahead. Photon
uses the existing shared cache and durable per-provider200/day,1.1s request gate.
The client waits1.2s after typing, cancels stale results, caches recent queries,
supports keyboard selection and retries a short throttle once. Hard daily caps
stop requests; optional map pins remain available. No paid fallback/key/billing.
`BOOKING_AUTOCOMPLETE_ORIGIN` optionally replaces the default HTTPS Photon origin;
no environment change is required for this release. Road route/fare calculation
starts after both points are selected; no Search or Calculate button is required.

Private checkout prefills the profile contact number or requires one on the same
screen. The server validates it and saves the lead contact in booking_passengers;
booking/admin email snapshots use that number even for an OAuth account without
a profile phone. This does not change the profile or enable phone authentication.
Test with test:booking-contact, test:booking-maps, test:booking-email and the real
development car-booking acceptance harness (Photon/routes/SMTP loopback only).

## Database connection recovery and first paint — 15 November 2026

The existing shared pg pool attaches to Vercel's Fluid lifecycle using
`@vercel/functions/db-connections`. It waits for idle sockets to close before
suspension; idle timeout is5s, TCP keepalive enabled, max3 connections retained.
TLS verification and10s connection/15s statement/5s lock deadlines remain intact.
No keep-warm cron, always-on compute, database upgrade or new service is used.

Only the two published CMS SELECTs retry once, after100ms, for known transient
connection failures. SQL, authorization and statement/lock timeout errors still
fail immediately. Transactions, booking/payment/auth writes are never replayed.
Existing tagged60s CMS caching and publication invalidation remain; prices and
availability stay dynamic. A sustained provider outage can still fail requests.

The hero text, priority image and trip search remain visible through hydration.
Phones skip the hero entrance/scroll animations; desktop keeps a short lift and
ambient motion. Route entry no longer fades or clips all content. Check with
`npm run test:loading`, native CMS tests, built CMS acceptance and mobile/browser
timings; verify the live request path and runtime logs after the normal publish.

## Development changes prepared on 15 November 2026

Vehicle framing is under **Admin → Fleet → Vehicles → Edit → Photos → Crop & preview**.
After uploading, choose the full photo or an8:5 crop, adjust zoom/position or drag
the selection, review the traveller preview, then Save photo frame. Cancel sends
no update. The original Cloudinary upload stays intact; a delivery URL in the
existing image_url field stores the selected frame and can restore the full photo.
Only versioned app-managed uploads support recropping. Vehicle cards/details show
the complete selected frame; vehicles without photos use a neutral placeholder.
No schema migration, paid editor, new storage provider or repeated transformation
requests during drag. The crop endpoint checks role/origin, the photo's vehicle,
bounded crop coordinates and the expected previous URL before saving.

The next release pins functions to **sin1 (Singapore)** beside both existing Neon
branches, replacing the observed US execution region. Hobby supports one region;
no billing change is needed. Only published CMS copy/navigation has a60-second
tagged data cache; successful publish/unpublish/delete invalidates it. Drafts,
admin data, vehicle prices/availability, quotes and bookings remain live. Independent
renderer reads begin together. Production latency improvement must be measured
after a separately authorized production release; local tests cannot prove it.

The separate admin login-only label uses the existing settings key
`admin_login_alias` with JSON `{"identifier":"admin@travelease.com","userId":"ADMIN_UUID","recoveryEmail":"owner@gmail.com"}`.
The starter account itself now displays/stores `admin@travelease.com` as its
app-only email/login identifier. It resolves to that existing active, verified account and
checks the same password/session system and current role under the account lock.
Roles stay editable; other promoted admins use their own logins. The label grants
no role and is never a mail recipient or OAuth identity. Google email claims for
this identifier are rejected before account matching/linking. Password resets and
verification mail use the separately configured recoveryEmail. Booking/support
events capture that working recipient under their transaction, so delivery logs
and replies never use the app-only identifier. Business booking alerts/replies use
Business details → Support email / contact inbox independently.

Development activation was explicitly approved and completed: the legacy starter
admin account initially used the business Gmail inbox's `+travelease-admin`
alias. The user then explicitly requested replacing that account address with
`admin@travelease.com`; development now stores it and keeps the original plain
Gmail as recoveryEmail. No external mailbox was created. Its password/role/user ID were retained; old
sessions, outstanding reset/verification links and any Google link for its
unowned old email were retired. No real email was sent by that operation.
Production is unchanged. Publishing code does not activate an alias on another
DB: any production activation requires an explicit request, the alias-capable
release already live, exact account/unique-address checks and one audited
transaction. Keep the existing working business inbox. An app-only users.email
requires this separate mailbox-routing and Google-claim guard; its retained
account-verification marker does not prove ownership of the external domain.
Changing an app login does not create a mailbox.

Validation: `test:vehicle-image`, `test:login-identifier`, development
`test:content-races`, optimized `test:cms-acceptance` and `test:auth-acceptance`,
plus lint/typecheck and Chrome/WebKit crop checks. The isolated tests remove
their own fixtures; no production car photo or pricing is changed by testing.

Stack: **Vercel Hobby** (hosting, $0) + **Neon** (Postgres, $0) + the free `*.vercel.app` URL.

- **`main`** → the live site (Vercel production, Neon `production` DB).
- **`development`** → where work happens (Vercel preview URL, Neon `development` DB).
- **Publish = merge `development` → `main` and push.** Pending DB migrations apply themselves on the production deploy.

---

## One-time setup

### Authgear mobile OTP — Free plan only (2026-11-13)

Email/password and Google keep using the existing local users and sessions. The
new Mobile + OTP option uses Authgear's hosted phone verification and then issues
the same local session. Existing accounts enable it once from **My account →
Mobile OTP login** while signed in. A contact phone entered in a profile never
automatically links accounts. Unknown mobile identities must sign in with email
or Google and link first; phone-only registration is deliberately not added.

Project `jagdamba-travellers` and the confidential OIDC application `Jagdamba
Mobile OTP` were created on Free ($0), with no payment method or paid upgrade.
Authgear currently disables India (+91) on this free project. The user-approved
support request for India activation was submitted and acknowledged on 2026-11-13;
it explicitly requests Free only, no billing, and confirmation of a hard stop at
the free allowance. **India delivery and quota exhaustion behaviour remain
unverified. Do not enable mobile login until those conditions are confirmed.**
The published allowance is 100 combined SMS/WhatsApp messages/month, including
resends; it does not cover 1,000 messages. Never enable paid SMS gateways,
upgrades, automatic top-ups or billing to resolve an activation/quota failure.

Local server-only configuration is in ignored `.env.local`:

- `AUTHGEAR_ENDPOINT`: the project's `https://…authgear.cloud` origin.
- `AUTHGEAR_CLIENT_ID` and `AUTHGEAR_CLIENT_SECRET`: confidential OIDC credentials.
- `AUTHGEAR_MOBILE_ENABLED=false`: remains false pending India approval. Set true
  only after Free-plan country access and quota behaviour are confirmed.

Keep Authgear's login method **Mobile / Passwordless** for this provider. The
application's email/password and Google flows remain separate and unchanged.
No refresh tokens, management credentials, provider passwords or SMS codes are
stored in the app. The encrypted browser flow uses PKCE, state, nonce and a
10-minute expiry. ID-token signatures and claims are verified using `jose` and
Authgear JWKS, with matching verified-phone UserInfo. Account linking is bound
to the initiating local session. Replacing/removing mobile login revokes other
local sessions. Identity conflicts never transfer a linked account.

Currently authorized callbacks are localhost:3000, 127.0.0.1:3000 and
127.0.0.1:3103, each with path `/api/auth/mobile/callback`. No production callback
or Authgear credentials were added to Vercel. The user authorized publishing the
login changes with mobile disabled: Production has `AUTHGEAR_MOBILE_ENABLED=false`.
After India approval and free-quota confirmation, a separately authorized activation
must add the exact HTTPS production callback and server credentials in the correct
Vercel environment. Follow the normal isolated-release/publish runbook and keep
other dirty local features excluded. No schema migration is
needed: Authgear identities use existing `user_auth_providers` rows with provider
`authgear` and an issuer-bound subject hash.

Validation: `npm run test:authgear`, `npm run test:mobile-login` (development DB
only), and `npm run test:auth-acceptance` with the documented local Playwright
module/optional `--built`. The mock provider tests send no SMS; transaction tests
create and remove synthetic accounts. They do not prove real Indian delivery.
References: [pricing](https://www.authgear.com/pricing/),
[OIDC](https://docs.authgear.com/get-started/oidc-provider),
[UserInfo](https://docs.authgear.com/reference/apis/oauth-2.0-and-openid-connect-oidc/userinfo),
[PKCE](https://docs.authgear.com/get-started/native-mobile-app/using-authgear-without-sdk-client-side).

### Development PostgreSQL hardening (2026-11-05)

Local development now uses `DATABASE_URL_APP` for the restricted `travel_app_dev`
login. The generated credential is stored only in ignored `.env.local`.
`DATABASE_URL` remains the owner connection used by migrations, seeds and database
test fixture setup. `DATABASE_URL_PRODUCTION` remains a reference for explicit
production operations. No production credentials/settings were changed.

`npm run db:setup-dev-role` is an explicit, development-only operation, never
invoked by deployments. It verifies the git branch and distinct dev/production
endpoints, creates the SQL role if absent, applies grants, verifies restrictions,
then saves the runtime URL. Existing role passwords are not rotated on rerun.
The role gets catalogue/business DML, read-only lookup tables, insert/read audit
tables and sequence usage; no migration-ledger access, schema creation, role or
database creation, ownership, or RLS bypass. Public-schema CREATE is revoked from
PUBLIC on development. App authorization still controls which customer records
each request can access: these grants do not implement row-level security.

After adding approved tables through migrations, explicitly rerun the dev role
setup and tests to grant the appropriate runtime access. New tables are not
automatically granted to the app. Review the read-only/append-only table lists
in the script when introducing another sensitive table.

Runtime connections use explicit `sslmode=verify-full`, a 10-second connection
acquisition timeout, 15-second statement timeout, 5-second lock timeout and
15-second idle-transaction timeout. Idle pool errors log only a sanitized code.
Do not retry non-idempotent writes automatically after a connection error.
Restart localhost after credential changes so cached pools are replaced.

Checks: `npm run test:db-hardening`, `npm run test:concurrency`, typecheck and lint.
Hardening tests roll back their permission/timeout probes. Concurrency tests use
the restricted login for app calls when configured, the owner only for temporary
fixture setup/cleanup, and in-memory email. Neither test contacts production.

Production rollout is still unapproved. Publishing code alone does not create
a production runtime role. A future release needs a separately prepared role,
grants, credentials and validation. Until `DATABASE_URL_APP` is configured there,
the application retains its existing `DATABASE_URL` fallback.

### Development recovery drill and migration drift checks

Development drift checks now have a dedicated command: `npm run db:check:dev`.
It reads development only, comparing full public-schema definitions (precise
column types/defaults, constraints, indexes, triggers, overloaded functions,
views, RLS/policies, sequence configuration and extensions), table/schema grants,
the migration ledger and LF-normalized SHA-256 migration-file hashes against
`db/dev-schema-baseline.json`. New pending local migration files are allowed;
changed/deleted baseline files or applied files without a baseline hash fail.
This is an observed baseline established on 2026-11-05, not retrospective proof
that historical applied SQL bytes match today's files. Do not regenerate it to
silence drift: investigate, reconcile through approved append-only migrations,
then review an explicit baseline update. Recording with `--record-baseline`
refuses to overwrite an existing baseline. No checksum column was added.

The existing two-environment `db:check` gate now also compares full definitions.
It fails closed when pending migrations coexist with schema differences until
isolated migration replay verifies the expected changes; pending filenames alone
are no longer sufficient evidence. This deliberately tightens the earlier runbook
rule. Do not publish around that failure. Environment-specific grants are checked
by the dev baseline, not equated to production grants. The production comparison
has not been executed during this development-only task.

`db/restore-schema-review.json` lists the proposed temporary restore database
`travel_restore_drill_20261105` and every existing table/column/type. Explicit
user approval of that inventory and temporary-database cleanup is required before
running `db/restore-drill.mjs --approved-schema=<SHA256 of that file>`, with
`PG18_BIN` set to PostgreSQL 18's client directory. The script verifies the source
schema still matches the approved inventory, refuses an existing target, dumps
a consistent exported snapshot over a direct development connection, and restores
in one transaction. It compares schema definitions and all table row counts/data
fingerprints, then exercises booking/coupon concurrency with in-memory email.
The temporary database and private temporary dump are removed afterward; only
a non-sensitive verification report is retained. It never connects to production.
Application grants and ownership are intentionally excluded from the archive;
this drill does not prove production/PITR recovery or runtime-role restoration.

The development server reports PostgreSQL 18.6. System-installed client tools
are PostgreSQL 17, which cannot dump a newer-major server. PostgreSQL 18.6 portable
clients were downloaded from EDB into the local temporary tools directory for
this drill; no installer or Windows service was added. Set PG18_BIN to that
directory (or another verified PostgreSQL 18 bin directory) before rerunning.
The portable Windows client uses Node's trusted public CA bundle with verify-full,
never disabled certificate verification. The dump explicitly includes pgcrypto
along with public: selecting a schema alone does not include that extension.
An empty public schema in the newly created target is dropped without CASCADE
before restore. The source schema is never dropped or modified.

Restore-only comparisons recognize PostgreSQL's lossless distribution of an
unbounded varchar-array-to-text-array cast onto each literal in a CHECK expression.
Allowed values, bounded casts, validation state and all other definition differences
remain checked. Routine development and release drift checks use exact definitions.

For an approved recovery drill:

1. Verify the actual Neon history window in the account. Choose and record the
   acceptable recovery point (data loss) and recovery time with the project owner.
2. Use a direct, certificate-verified **development** owner connection for
   `pg_dump --format=custom`; supply credentials through a protected passfile or
   process environment, never a command-line URL or committed file.
3. Keep the dump in access-controlled, encrypted backup storage outside this
   repository. A dump contains customer and authentication data; don't publish it
   or put it in Cloudinary. Set explicit retention and test scheduled runs later.
4. Restore with `pg_restore --exit-on-error --no-owner --no-acl` into a separate
   empty recovery database/branch only after approval for the restored schema.
   Never restore over development or production as a test.
5. Verify migration ledger, constraints/indexes, catalogue counts and representative
   auth/booking flows with external email/integrations disabled. Reapply restricted
   role grants separately, record restore duration, and remove the approved test
   environment afterward. Listing archive contents alone is not a restore test.

The approved drill uses a temporary archive and database, both cleaned up afterward.
See db/restore-drill-report.json for the last successful result; an absent report
does not indicate success. No recurring backup schedule or production recovery
has been configured. A local code rollback does not undo database migrations;
keep migrations compatible with the still-serving app.

References: [Neon branch-scoped roles](https://neon.com/docs/manage/roles),
[Neon backup guidance](https://neon.com/docs/manage/backup-pg-dump),
[PostgreSQL pg_dump compatibility](https://www.postgresql.org/docs/current/app-pgdump.html).

**Prereqs (done):** repo `Tus-GitHub/TravelEase` on GitHub; Neon project with `production` and
`development` branches.

### 1. Vercel project

1. **vercel.com → Sign up / Log in with GitHub.**
2. **Add New → Project → import `Tus-GitHub/TravelEase`.**
3. Framework auto-detects as **Next.js**. Leave every build setting default — the repo's
   `vercel-build` script is picked up automatically (it migrates the prod DB, then builds).
4. **Production Branch** = `main` (Settings → Git, usually the default).

### 2. Environment variables (Settings → Environment Variables)

| Name | Value | Scope |
|---|---|---|
| `DATABASE_URL` | Neon **production** connection string, **pooled host** (contains `-pooler`), ending `?sslmode=require` | **Production** |
| `DATABASE_URL` | Neon **development** connection string, pooled host | **Preview** |

The two values are the `DATABASE_URL_PRODUCTION` and `DATABASE_URL` lines in local `.env.local`.
If a host has no `-pooler`, enable "Connection pooling" in the Neon dashboard → Connect and copy
that string. `NODE_ENV=production` and `VERCEL_ENV` are set by Vercel automatically.

### 3. Image storage (Cloudinary Free)

Admin photo controls use Cloudinary's Free plan. Create a free account at
https://cloudinary.com/users/register/free and get the cloud name, API key and
API secret from its dashboard. Add these **server-only** environment variables
to `.env.local` and the Vercel Preview and Production scopes:

```
CLOUDINARY_CLOUD_NAME=<cloud name>
CLOUDINARY_API_KEY=<API key>
CLOUDINARY_API_SECRET=<API secret>
```

Restart the local server after adding them; redeploy Preview for Vercel changes.
Do not put credentials in git, chat, or `NEXT_PUBLIC_` variables. No unsigned
upload preset is needed. The user approved production rollout on 2026-11-04;
migration `026_driver_image.sql` runs automatically during that deployment.
The running code requires that migration. Local development uses the development
database; keep the production connection scoped to Production in Vercel.

After creating a driver, vehicle, package, region or tourist spot, choose
**Edit → Photos** in its row. Upload JPEG/PNG/WebP up to 3 MB. Vehicles
support ten photos and a selectable cover; other records have one replaceable
image. Select multiple vehicle photos, review previews, then choose Upload.
Photo changes save immediately, independently of the Details form. Photos are
public, so do not upload licence/identity documents here.
Incoming images are resized to at most 2000×2000 and converted to WebP.

Uploads use signed server requests. Removing/replacing a photo detaches its
database reference; old Cloudinary assets are retained to avoid deleting shared
images or breaking historical links. Periodically remove unused assets in the
Cloudinary Media Library to stay within the free allowance. Failed database
saves trigger best-effort cleanup of the new upload only. Cloudinary's Free
plan currently includes 25 monthly credits shared between storage, processing
and bandwidth: https://cloudinary.com/pricing . No paid plan is required by this
implementation, and exceeding the allowance requires attention in Cloudinary.

### 4. First production deploy

Click **Deploy**. `vercel-build` runs `db/predeploy.js` first — on this production deploy it
applies every pending migration to the Neon `production` branch (currently it's behind by the
booking-core migrations), then builds. Result: `https://<name>.vercel.app`.

Then make yourself admin (the `production` users table starts empty): sign up on the live site,
then in the Neon SQL editor —
`UPDATE users SET role_id = 3 WHERE email = 'you@example.com';`

---

## Day-to-day: the publish workflow

Work on `development`:

```
git checkout development
# ...edit, commit...
npm run migrate          # if you added migrations — applies them to the Neon dev branch
git push origin development   # optional: Vercel builds a preview URL against the dev DB
```

Publish to the live site — **one command**:

```
npm run publish
```

`db/publish.js` does the whole sequence and stops early if anything's off: it refuses
unless you're on a clean `development`, runs `npm run db:check` (aborts if not green),
fast-forwards `main` to `development`, `git push origin main` (Vercel deploys: migrate
prod DB → build → live), then switches back to `development` and pushes it too.

When Vercel goes green, run `npm run db:check` once more — it should say `IN SYNC`.

Do the steps by hand only if `publish` aborts on something it can't fix itself
(e.g. `main` and `development` diverged):

```
npm run db:check
git checkout main && git merge development && git push origin main
git checkout development
```

### `npm run db:check`

Compares the `production` and `development` Neon branches — migration ledger, every public
column, triggers, functions.

| Output | Meaning |
|---|---|
| `IN SYNC` | Nothing to do. Safe to publish. |
| `production is behind by N migration(s), all present as local files` | Expected. The production deploy applies them. Safe to publish. |
| `production is AHEAD` / `applied migration with no local file` / `ledgers match but schemas differ` | **Stop.** A database was changed outside a migration. Reconcile it into a numbered migration in `db/pg-migrations/` before publishing. |

Migrations are **append-only** — never edit an applied `.sql` file, add a higher-numbered one.
Never run `npm run migrate:prod` by hand as part of publishing; the deploy already does it.

### Rollback

Vercel → Deployments → **Promote to Production** on the last good build. (Note: a rollback does
not un-apply migrations — additive migrations are safe to leave; a destructive one needs its own
forward migration to undo.)

---

## Limits / cost

| | Free tier | Note |
|---|---|---|
| Vercel Hobby | $0 | 100 GB bandwidth/mo. **Non-commercial use only** — a real paid-bookings launch needs Vercel Pro ($20/mo) or a move to Cloudflare Pages. |
| Neon free | $0 | 0.5 GB storage; autosuspends when idle (~0.5s cold start on the next request). |
| `*.vercel.app` domain | $0 forever | A custom domain (~$10–15/yr, bought elsewhere) attaches later in Vercel → Settings → Domains with no code change. |


## Custom route suggestions (Phase 3.7a; development only)

Tourist spots have optional latitude/longitude pins (migration 027, approved for
**development only**). In Admin -> Geography -> Tourist Spots -> Edit, pin a verified
road-accessible entrance or enter both coordinates. Unknown pins stay empty; the
app never substitutes city centres or guessed coordinates.

Create an openrouteservice key through https://account.heigit.org/signup and set
`OPENROUTESERVICE_API_KEY` in `.env.local`. Restart localhost afterward. The key
stays server-side; do not use NEXT_PUBLIC or commit it. The user chose to add this
key later. Live provider checks are pending; automated provider tests use mocks.

Signed-in travellers can choose 4-5 stops in Build Your Own -> Set Route, then
Suggest route. The server loads active spots and parent cities/regions, preserves
the endpoints, and compares middle-stop orders using the openrouteservice
`driving-car` time matrix. Preview/Keep my order/Use suggested route never saves
or books automatically. Estimates exclude live traffic, breaks and stop visits;
they are not vehicle-specific navigation and never change the pricing engine.
Guests retain manual ordering and booking. Missing pins/configuration, provider
errors and disconnected routes keep manual ordering available.

Requests are limited to five distinct spot IDs and 1 KiB; cross-origin requests
are rejected. Upstream timeout is 12 seconds. A warm-instance cache (100 entries,
one hour) and one concurrent request / 20 requests per minute limit repeated
provider calls. These are per-instance protections, not a distributed quota;
monitor the provider account quota before a production rollout.

No production migration or environment change is authorised for this chunk yet.
After a separate publish approval, add the key to Vercel Production and let the
normal deployment apply migration 027. Do not run production migration manually.
Run `npm run test:routes`, `npm run test:db`, typecheck and lint before release.
Provider reference: https://giscience.github.io/openrouteservice/api-reference/endpoints/matrix/

## AI itinerary ideas (Phase 3.7b; development only)

Build Your Own -> Choose Spots includes an optional AI idea card for signed-in
travellers. Choose up to three interests and 2-5 stops. Existing selected stops
must remain in the suggestion. Preview the catalogue-backed stops in the branded
dialog, then Keep my choices or Use these stops to enter the existing route editor.
Applying does not save, book, quote a price or call the road provider automatically.
The manual map picker remains available, including for guests/provider failures.

Local setup (not configured or live-tested during implementation):

1. Add `OPENAI_API_KEY` and `OPENAI_ITINERARY_MODEL` to ignored `.env.local`.
   Choose an account-available model supporting Responses and strict JSON-schema
   Structured Outputs. There is deliberately no silently selected model or fallback.
   These are server-only variables; never use NEXT_PUBLIC or commit their values.
2. Restart localhost. Using a development account, request a 2-5-stop itinerary,
   check the real provider result, preview/cancel/apply and confirm kept stops.
   Real API usage may incur charges; configure provider project limits/monitoring.
3. Before a separately approved production release, verify the chosen model,
   endpoint/deployment execution limits and provider account settings. No production
   environment variables, deployment or database changes are authorised here.

`POST /api/itineraries/suggest` requires the existing session and rejects foreign
origins. A 2 KiB request accepts only region ID, count, kept IDs and enumerated
interests. The server loads active/nondeleted spots and their city/region parents;
regions above 60 candidates fail explicitly rather than silently omitting places.
Only bounded public catalogue names/tags/descriptions/city names and preferences
are sent to OpenAI. No customer identity/contact data, images, credentials or
booking details are sent. Catalogue text is treated as data, with no model tools.

The Responses request uses strict structured IDs and `store: false`. This disables
response storage for retrieval; it is not a claim of zero provider retention.
The model cannot supply names, descriptions, prices, schedules or opening hours.
The app checks exact count, uniqueness, catalogue membership and kept IDs, then
reloads selected records to reject spots withdrawn during generation. It returns
canonical database metadata only. AI ordering is an idea, not optimized navigation;
road timing remains the separate 3.7a integration.

Provider calls have a 20-second timeout, 1,500 output-token cap, 64 KiB response
limit and no automatic retries. Warm-instance limits: 3 requests/user/minute,
10 total/minute, 2 concurrent, bounded user tracking. These are not distributed
quotas or hard account spend limits. Failures/refusals/incomplete results are
sanitized; manual selection remains available. No new dependencies or schema.

Checks: `npm run test:itineraries` (mock provider), `npm run test:itinerary-db`
(explicit dev guard, rollback fixtures, restricted runtime login),
`npm run test:routes`, `npx tsc --noEmit`, `npm run lint`.
Official API reference: https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses

## Hotel search and enquiry (Phase 3.7c; development sandbox only)

The user selected search + enquiry for the two-day target. `/hotels` is linked
from Packages, individual packages, the builder summary and the footer. It uses
existing active cities/regions with valid stored coordinates, the existing session
and My Support conversations. No tables, columns, migrations or dependencies were
added. This slice does not implement supplier reservations, prebooking, payments,
cancellations, hotel inventory management or automatic inclusion in trip prices.

1. Create a free LiteAPI account at https://dashboard.liteapi.travel and save your
   own sandbox key as `LITEAPI_SANDBOX_KEY` in ignored `.env.local`. Sandbox keys
   start with `sand_` or `sandbox_`. Restart localhost. Never use NEXT_PUBLIC.
2. Sign in with a development customer account. Open Packages -> Explore hotels,
   choose a city, a 1-30-night stay within the next year, 1 room and 1-4 adults.
   Children, extra rooms and other unsupported requests go through manual enquiry.
   Validate city pins against real destinations before treating proximity as useful.
3. Search, inspect photos/room/meal plan/sample full-stay total and property fees,
   cancel the branded preview, then explicitly send an enquiry. Verify it appears
   in that customer's My Support and Admin Support. Sending writes a support
   conversation only; it never reserves a hotel or charges anyone. Staff must
   independently verify availability, final price and terms. A dropped confirmation
   requires checking My Support before retrying; there is no submission idempotency.
4. Missing provider configuration still allows a general stay enquiry. Do not
   interpret sandbox inventory, prices or cancellation labels as live offers.

The provider adapter makes only `POST https://api.liteapi.travel/v3.0/hotels/rates`
requests. Existing server-side coordinates are authoritative; client input cannot
supply coordinates, credentials, prices or provider URLs. Authentication,
same-origin checks, strict 1 KiB input, fresh destination revalidation, 15-second
provider timeout, 1 MiB response limit and no retries bound requests. Only dates,
city coordinates, adults and nationality are sent; no customer identity/contact or
booking data. Images use the documented HTTPS static.cupid.travel CDN; unsupported
or failed images show a placeholder. One-room occupancy must match the request.

Only INR public selling prices are displayed; missing/mismatched retail or public
selling prices become Quote on request. Extra property fees are shown separately.
The adapter rejects non-sandbox responses, production credentials and execution
with VERCEL_ENV=production. Warm-instance limits are 5/user/minute, 20 total/minute
and 2 concurrent; they are not distributed quotas. Review provider/account limits
and deployment duration before any future rollout.

Validation on 2026-11-05: 10 mocked hotel test groups, development destination
rollback tests through the restricted runtime role, AI regression tests, desktop/
mobile/dark browser checks and the dev drift gate passed. A read-only live adapter
smoke using the provider's officially published public sample sandbox key returned
9 normalized hotels with INR public prices and allowed photos. That sample key was
transient, never saved to the app/environment or committed. Own-account search
remains pending the user's key. The initial browser tests mocked provider replies
and ticket delivery. A later real general-enquiry acceptance run is recorded below;
staff-reply email and own-provider search-result enquiries remain separate checks.

Checks: `npm run test:hotels`, `npm run test:hotel-db`,
`npm run test:itineraries`, `npx tsc --noEmit`, `npm run lint`,
`npm run db:check:dev`. No production access or publication is authorized.

Official references:
- https://docs.liteapi.travel/docs/getting-a-sandbox-key
- https://docs.liteapi.travel/reference/post_hotels-rates
- https://docs.liteapi.travel/docs/hotel-rates-api-json-data-structure
- https://docs.liteapi.travel/reference/coding-agent-skill (public sample test key)

## Public contact form and admin inbox (development implementation)

Change the receiving email in **Admin -> Site settings -> Edit -> Support email /
contact inbox**. This reuses the existing `site_settings` row with key
`contact_email`; no new column, table, migration or environment variable. The
user-selected inbox has been saved on development only. It is also the public
email shown in the footer and contact page. Phone, address and SMTP credentials
were not changed. Public display caches may take a few minutes to refresh; new
contact submissions query the saved inbox directly without that cache.

The inbox must be one plain email address. Server-side validation rejects multiple
recipients, header syntax and invalid addresses before any setting is written.
Clearing it disables contact delivery; missing/invalid settings or database errors
also fail safely. The sender continues to use the existing verified `EMAIL_FROM`
and `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` environment variables.
Visitor email is Reply-To only, never From/To/CC/BCC. No automatic email is sent to
the visitor. Messages are delivered by email, not stored as support tickets.

`POST /api/contact` accepts guests. It validates same-origin browser requests,
JSON type, a 20 KiB body, bounded name/email, known reason, 10-4,000-character
message, UUID submission ID and empty bot-trap field. Client-supplied recipients,
roles and extra fields are rejected. HTML is escaped; file/URL attachment access
is disabled. The contact transport reuses the existing email service/config with
10s connection/greeting/DNS waits and 15s socket inactivity timeout, requiring TLS
for non-implicit-TLS connections. Other email callers keep their original options.
Reference: https://nodemailer.com/smtp and https://nodemailer.com/message.

The server waits for SMTP acceptance of the intended recipient and returns a
CONTACT reference only then. A queued/accepted email can still bounce or enter
spam later; the UI says submitted by email, not guaranteed delivery. Errors never
show success or clear the message. The browser waits up to45 seconds, preserves
the same submission ID for unchanged retries and warns when delivery is uncertain.
There are no automatic retries. An uncertain send can still have reached SMTP.

Warm-instance limits: 3 attempts/email/15min, 25 total/15min, 2 concurrent and at
most200 retained submission records. Pending/accepted/uncertain retries with the
same ID and content share the first result for15 minutes; a changed payload with
the same ID is rejected. Only hashes/status/promises are retained in this cache.
These controls reset on cold start and do not coordinate between instances;
they are not durable idempotency, a provider spend limit or complete bot protection.
Review deployment/provider limits and stronger shared abuse controls before public
rollout. Any future table/column still requires explicit names/types approval.

Verification: `npm run test:contact` (12 groups, mocked SMTP and HTTP handler),
`npm run test:contact-db` (dev-only existing-setting changes, all rolled back),
`npx tsc --noEmit`, `npm run lint`, `npm run db:check:dev`.
Browser checks cover failure/network/malformed responses, retained text, retry ID,
busy states, receipts/focus/reset, mobile/dark and the existing branded admin editor.
Automated regression tests send no real email. Separately, the user authorized one
real localhost browser test on2026-11-05. SMTP accepted CONTACT-842AF92E58F3 at
18:45 IST, the real UI displayed the receipt, and the user confirmed Received in
Inbox. A preceding403 did not reach SMTP and exposed Next's normalized server
hostname: origin validation now uses actual Host plus request protocol for contact
submission and admin inbox edits, rejecting malformed hosts and foreign origins
without trusting arbitrary forwarded-host headers. Regression cases cover this.
Target-origin reference: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html#identifying-the-target-origin

Before an authorized release, verify Reply-To client behavior, provider bounces,
hosting execution limits and the deployed host/proxy origin behavior. This one
received test does not prove all future deliveries. Production settings have not
been changed; configure its inbox only as part of a separately approved action.

### Localhost origin checks for hotel, itinerary and routing APIs

Development follow-up on2026-11-05: `/api/hotels/search`,
`/api/itineraries/suggest` and `/api/routes/optimize` now use the same
`matchesRequestOrigin` helper as contact submission. It checks the actual Host
with the request protocol, retains exact port/scheme checks, rejects cross-site
requests and ignores untrusted forwarded-host headers. Existing session guards
run first.

With the development server on port3000, run `npm run test:integration-origins`.
It requires the development git branch, local execution and distinct development
and production endpoints. It connects only to the restricted development runtime
DB, creates one temporary customer/session in existing tables, then removes both
and verifies cleanup. It does not create tables or columns.

All54 HTTP checks passed on both localhost and127.0.0.1: unauthenticated401,
authenticated same-origin validation400, and rejected origins403. An optional
`--browser-module=<absolute path to an installed Playwright module>` argument
adds Chrome checks; all6 passed using browser-generated Origin headers without
API mocks. Pass this argument after `npm run test:integration-origins --`.
The400 responses are intentional invalid-input tests before provider calls;
they do not establish successful hotel/AI/routing provider responses. No external
provider requests, emails or bookings are generated. Provider setup and deployed host/proxy
acceptance remain separate from this dev-only verification.

### Real hotel enquiry handoff (development acceptance)

On2026-11-05, the real localhost browser/API/development-DB flow passed: general
hotel-help preview/cancel (no write), explicit Send (one ticket/message), customer
thread and follow-up, admin thread view, branded status popup to close, then
customer closed state. The16 API checks cover authentication, ownership/admin
restrictions, malformed JSON/booking IDs/oversized input, foreign origins and
replies after closure. Three temporary test accounts/sessions and the enquiry with
its messages were removed and verified absent. No API/auth mocks were used.

The test exposed malformed JSON500s; support write routes now require bounded
JSON objects (20 KiB) and the shared origin guard. A malformed linked booking ID
returns400 before querying the UUID column. Existing role/ownership rules remain.

Run `npm run test:support` for four isolated validation regressions. With the local
development server on port3000 and Chrome/Playwright already installed, run:

```powershell
npm.cmd run test:hotel-enquiry -- "--browser-module=<absolute path to installed Playwright module>"
```

The smoke requires the development branch and distinct development/production
endpoints, and connects only with the restricted dev runtime URL. It uses existing
tables, no DDL. It deliberately exercises admin status changes without sending a
staff reply, because staff replies trigger SMTP. No email, notification, provider
call or booking is generated. Own-provider search and staff-reply email delivery
are not established by this check. Production remains untouched.

### Booking, offline-payment and refund acceptance (development)

Verified on2026-11-05 with real Chrome, Next handlers and the development DB:
quote/coupon -> booking -> admin confirms offline payment -> customer cancels ->
admin records refund method/reference -> customer sees Refunded. DB assertions
cover quote/saved amount parity, coupon use, ordered history and vehicle holds.
The suite also exercises curated pricing authority, cancellation tiers and waiver,
unpaid cancellation, roles/ownership, duplicate actions and competing settlements.

The test exposed a settlement race; refunds now transition from pending with one
conditional UPDATE, so a competing action returns409 without overwriting the
winner or producing a second settlement audit entry. Method/reference lengths
are bounded before SQL. Curated package type/duration come from the catalogue;
selected vehicle type/activity/capacity are checked before booking. Quote/booking/
refund mutations use the shared origin helper and object JSON limits (64 KiB for
booking creation, 20 KiB for the other handlers).

```powershell
npm.cmd run test:booking-acceptance -- "--browser-module=<absolute path to installed Playwright module>"
```

Requires Chrome/Playwright already installed, a free loopback port3103, the
development git branch, DATABASE_URL_APP on the dev endpoint and distinct
DATABASE_URL_PRODUCTION for hostname exclusion only. No production connection is
opened. Owner credentials create/inspect/remove synthetic fixtures in existing
tables; application calls use the restricted runtime credential. No DDL runs.

The runner copies source/config, never .env files, into an isolated temporary Next
app and links existing dependencies. This avoids Next14's custom-server config
override limitation and the user's localhost build cache. SMTP points only to a
local receiving sink accepting this run's fake addresses. Server, sink, fixtures
and temporary app are cleaned afterward; cleanup checks paths before recursive
removal and unlinks the dependency junction first. Optional `--artifacts=<path>`
saves a customer-state screenshot.

Final result:49 API checks, real browser flow and18 locally captured notifications
passed. Pricing42, state25, refund-policy22, contention10, rollback DB102,
typecheck, lint and dev schema/checksum checks passed. No real money or external
email was sent. Actual collection/refund reconciliation and booking-email inbox
delivery are separate acceptance tasks. This does not introduce a collection
ledger, payment gateway, submission idempotency or notification outbox.

### Email/password authentication acceptance (development)

Verified on2026-11-05–06: real Chrome signup -> locally captured verification link ->
verified session -> logout popup -> login/Remember Me -> forgot-password -> reset.
Signup does not issue a session. Old passwords and existing sessions are rejected
after reset. The saved email token is hashed; links are expiring and single-use.

Auth token redemption now uses one transaction with a lock on the owning active
user. Verification/password/session changes commit together, and successful reset
retires outstanding reset and verification links. Password login takes the same
lock before checking the hash and creating a session, preventing an old-password
login from surviving a concurrent reset. Resend issuance uses that lock for the
existing one-minute per-account cooldown, including consumed tokens.

Auth mutations use the shared origin guard. JSON endpoints require object bodies
under20 KiB with typed fields and identity column limits; passwords are capped at
1,024 characters. Form failures now show retryable errors without losing input or
claiming success. Signup requires confirmation; login return paths reject external
destinations, backslashes and control characters. Forgot/resend still give neutral
responses for well-formed unknown accounts.

```powershell
npm.cmd run test:auth-acceptance -- "--browser-module=<absolute path to installed Playwright module>"
```

Uses the same isolated loopback3103 server/source-copy and local SMTP sink as the
booking runner above. Requires development git branch and distinct dev/prod
endpoints; production URL is used only to exclude its hostname. Owner credentials
inspect/clean synthetic fixtures in existing tables; application calls and direct
transaction tests use the restricted runtime connection. No DDL or external mail.
Optional `--artifacts=<path>` saves the reset-complete browser screenshot.

Final result:75 HTTP checks plus browser/DB assertions, 9 emails captured locally,
and verified cleanup of users/sessions/tokens/audit entries. Coverage includes
same-token and sibling-token reset contention, concurrent resends, concurrent
login/reset, expired/disabled accounts, neutral unknown emails, client role claims,
duplicate signup, malformed/oversized bodies, foreign origins and session expiry.
An injected transaction failure verifies credentials, verification state, sessions
and token consumption all roll back. Only UI error responses are mocked; successful
auth requests and email-link journeys run against real handlers and development DB.
Typecheck/lint,102 existing rollback DB checks and dev schema/checksums (27) pass.

This verifies email/password auth on development. Real Google OAuth, auth-email
Inbox delivery and production acceptance are separate checks. The account resend
cooldown does not replace the broader login/signup/IP abuse limits in plan.md §30.
No production connection, schema change or deployment was made.

## JSON page CMS (published, 2026-11-06)

Open `/admin/pages` through **Pages / CMS** in the admin sidebar. Homepage and
About are initialized from the existing site content. Administrators can create
custom pages, reuse Homepage/About layouts, edit text/photos/buttons/backgrounds,
add/duplicate/reorder/hide sections, preview drafts, and publish with a custom
confirmation dialog. Page settings include SEO and header/footer menu entries.
The editor uses existing admin auth, theme components and Cloudinary configuration;
no extra provider or dependency is required. Full guide/schema: docs/CMS_PLAN.md.

JSON documents are stored in the two user-approved tables `cms_pages` and
`cms_page_revisions`. Migration028 is applied on development and production; never
be edited. `db/cms-setup-dev.mjs --dev` applied it after checking the previous27
baseline/checksums, verified only reviewed additions, archived the old baseline
to `db/dev-schema-baseline-before-cms.json`, and advanced the reviewed baseline
to28. Narrow grants use the existing runtime role; future dev role setup retains
SELECT/INSERT-only access to the revisions table. The separately authorized production
release used Vercel predeploy and the existing owner connection; no new role grants.

Draft and publication are separate JSON snapshots. A version check rejects stale
updates, and publication plus its revision commits in one transaction. Restoring
history replaces only the draft. Anonymous/customer requests cannot read drafts,
preview them, upload, or publish. Public routes and navigation read only published
active snapshots; site rendering is dynamic so menu changes need no rebuild.
Homepage cannot be removed/unpublished; About may be unpublished but not removed.
Custom addresses are fixed and cannot replace existing application routes.

Images use the existing signed server upload, actual file signature validation and
3 MB JPEG/PNG/WebP limit. Uploaded URLs are saved directly into the current draft.
Removing a reference does not destroy an older Cloudinary image because history
may use it. Document validation limits pages to30 sections/256 KiB, supported
field shapes and safe image/link origins; content is rendered as escaped text and
known components, never arbitrary HTML/scripts. No WordPress plugins/themes,
raw HTML editor, blog/comments, scheduled publication or translation system.

```powershell
npm.cmd run test:cms
npm.cmd run test:cms-acceptance -- "--browser-module=<absolute path to installed Playwright module>" "--artifacts=<optional screenshot directory>"
npm.cmd run db:check:dev
```

The acceptance runner uses existing approved tables, temporary synthetic users
and pages, a separate source/build copy on loopback3103, and one live Cloudinary
development test image. It requires the existing dev Cloudinary credentials.
Successful requests use real browser/API/DB/storage calls; no external email or
booking/payment action occurs. Its fixtures, asset and temporary app are cleaned
afterward; normal localhost remains available.

Verified2026-11-06:9 model test groups and47 HTTP checks plus real browser/DB/storage
assertions pass, including a forced revision-insert failure proving publication
rollback. Desktop/mobile visual review, typecheck/lint/whitespace checks, an isolated
optimized Next build, fixture cleanup and dev schema/checksums28 also pass.

**CMS Publish on localhost publishes content to the DEVELOPMENT site only.** It
is separate from deploying code to production. The authorized release used the
existing db:check/publish runbook and automatic production migrations. Future releases
must follow those gates too. Review any future restricted production role's grants
for these tables. Development draft/content edits are not copied to production
by a code deployment; migration028 seeds the initial homepage/About snapshot there.

## CMS release rehearsal (2026-11-06)

User authorized production CMS publication, migration027 coordinate columns and
a temporary DEVELOPMENT schema-only rehearsal. Rehearsal passed and its database
was removed. See docs/CMS_RELEASE_2026-11-06.md for the exact scope and evidence.
The enhanced db:check requires current development baseline/hash parity and either
full production parity or fresh isolated-replay proof bound to both endpoints,
schemas and all SQL files. Evidence expires after48 hours; it cannot waive unrelated
drift. Production migrations still run only through Vercel predeploy.

Production release completed: commit8457c8c, Vercel deployment
dpl_5CHh5XZ4sjyiz4LWnjmgkHN1wtds READY at https://travelease-rouge.vercel.app.
Vercel applied027/028; final db:check reports IN SYNC28/28. Live public content,
SEO, mobile and anonymous CMS access checks pass. Earlier development-only changes
were restored locally and remain unpublished. Open /admin/pages on the live site
to edit production content; code deployment does not copy development drafts/pages.

## Weekend Trips and CMS catalogue — development only (2026-11-06)

User approved migration029's exact four tables/six added columns on development
only. It is applied and immutable; reviewed dev schema/grants/checksums pass29.
Production was not contacted or changed for this work. No publish/merge/push ran.

Completed admin Friday departures/guides/manual hotels, shared customer bookings,
seat holds/idempotency, existing offline payments/refunds, room allocation and
public/customer pages. CMS adds source/filter/visitor controls and link pickers in
existing JSON. No additional service key, scheduler or CMS schema is required.
Shared GPS, supplier hotel reservations, room upgrades and Razorpay remain excluded.

Acceptance: optimized isolated Next build, typecheck/lint;8 weekend,12 CMS,42
pricing,25 lifecycle and22 refund model cases; real dev shared inventory/expiry
contention, rollback and10 existing private/coupon concurrency cases;30 Weekend
HTTP checks plus13 CMS HTTP checks and full desktop/mobile Chrome journeys.
The browser verifies live catalogue seat refresh after cancellation, frozen stops,
two unrelated customer bookings, payment/guarantee/room privacy and refund payment.
Synthetic data/pages/uploads removed; test email stayed local. Operator guide:
docs/WEEKEND_TRIPS_PLAN.md. Repeatable full acceptance (installed Playwright module):

```powershell
node --experimental-strip-types --import ./db/tests/_register.mjs --env-file=.env.local db/tests/weekend-admin-acceptance.ts --dev --full --cms --built --browser-module=PATH_TO_PLAYWRIGHT
npm run test:weekend-bookings
npm run test:concurrency
npm run db:check:dev
```

The --built option calls next build directly in an isolated local directory using
the restricted DEVELOPMENT connection, then serves that build for the browser.
It does not call vercel-build/predeploy or any production migration command.
Publication requires separate user authorization for the production schema and
reviewed application scope. Earlier unrelated dev-only work remains in this checkout;
prepare/rehearse the intended release and run the normal parity gate when authorized.


## Weekend Trips/CMS production publication — 2026-11-06

Released commit736f8e2 (Vercel dpl_8BM36m2yTjD1QWZm7SkGErnjy2wd READY).
Production now includes Weekend Trips and CMS Live catalogue/filter/link controls.
Approved schema-only development rehearsal was cleaned; automatic predeploy applied029.
Final db:check IN SYNC29/29. Exact release build/tests and production read-only mobile,
routes/login protections pass. Earlier unrelated development work restored and remains
unpublished. No dev departures/CMS content copied. Full release record:
docs/WEEKEND_RELEASE_2026-11-06.md.


## Contact delivery and authentication release — 2026-11-10

Only public contact delivery, its admin inbox editor, and email/password
authentication fixes are included. No migrations or new environment variables.
Other local integrations, support changes and runtime hardening remain excluded.
Release evidence: docs/CONTACT_AUTH_RELEASE_2026-11-10.md.

### Contact inbox and delivery

Admin -> Site settings -> Edit -> Support email / contact inbox controls the
existing site_settings.contact_email key. Each submission reads the saved inbox
immediately. It is also the public support email. Missing/invalid/blank settings
disable sending; no static fallback address receives messages. Configure the
production inbox in Admin if needed; development settings are not copied.

The existing production SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and EMAIL_FROM
variables are reused. Visitor email is Reply-To only. No autoresponse or support
ticket is created. Contact SMTP requires TLS and has bounded connection waits.
The UI shows a reference after SMTP accepts the intended recipient, retains input
on failure and warns on uncertain delivery. SMTP acceptance does not prove Inbox
receipt. There are no automatic retries.

The guest endpoint validates origin, bounded JSON, names, plain mailbox, known
reason, message length, submission UUID and honeypot. Warm-instance duplicate and
rate controls are bounded; they do not coordinate across instances or provide
durable delivery. Existing My Support remains separate.

### Authentication

Verification/reset token redemption and account/session changes now share one
transaction and user lock. Successful reset retires all outstanding reset and
verification links and sessions. Password login uses the same lock. Concurrent
resend issuance enforces the one-minute per-account cooldown. JSON bodies are
bounded and typed; mutations validate origin. Forms retain input and report
retryable errors. Login return paths stay on-site. Google OAuth is unchanged.
These changes do not add general login/signup/IP rate limiting.

### Local verification

Run npm run test:contact and npm run test:contact-db. The latter updates only
existing DEVELOPMENT settings inside a transaction and rolls back every change.
Run npm run test:auth-acceptance -- --built --browser-module=PATH_TO_PLAYWRIGHT
for an isolated optimized build and real browser/API/development-database journey.
The child server uses the existing restricted development runtime connection,
has no production URL and sends mail only to its loopback sink. Synthetic users,
sessions, tokens and activity rows are removed and absence checked. No DDL.
Run typecheck/lint and the required db:check gate before and after publication.

Production outcome: commit75db0e2, Vercel READY on2026-11-10. Saved production contact inbox configured with the previously selected verified-sender mailbox; no other content copied. Final db:check IN SYNC29/29. See focused release record for live checks and limitations.

## Reusable packages and guided routes — 2026-11-16

Admin → Packages → Add / Edit package now has an optional reusable plan: day-by-day
activities, included meals, guest-facing hotel/category and sharing details, guide,
inclusions and excluded/additional charges. Duration follows the plan. Enter actual
business prices and promises; publication does not seed sample offers.

For a private custom package, enable approved next destinations. Add existing active
destinations, select roots and allowed next stops, nights, meals and extra per-person
prices, and where a trip can finish. The base per-person price plus chosen stop
extras determines the route price; configured package tax/discount is shown at
checkout. Loops, disconnected stops and invalid paths are rejected. Customers choose
successive cards without Search/Next buttons. Checkout collects date, traveller
count and a valid lead phone, displays the promised plan and final total, and rejects
changed prices or plans until the customer reviews again. Bookings retain their
agreed guest plan even after catalogue edits.

For a fixed Friday group, choose Shared or Both and use Schedule Friday departure
from the package list, or Use selected package plan in the departure editor. This
copies a draft, including dated meals/stays. Review dates/times, fare, capacity,
vehicle, driver and guide. Copied hotel rooms start at zero and pending: arrange
and confirm real beds in Hotels before opening sales. Copying a plan never reserves
a supplier or confirms accommodation. Shared inventory, seat holds, payment and
hotel/vehicle/driver checks use the existing departure system. Customer payment is
still verified manually by the operator before final confirmation.

Admin booking details and customer receipt/history show the saved plan. Notifications
use the saved lead phone. Existing mail configuration is reused; SMTP acceptance
alone does not prove inbox delivery. No paid map service, new provider, billing or
OTP activation is introduced. Signed-in mobile/PWA navigation shows a circular
initials avatar, with account/bookings shortcuts and the full navigation drawer.

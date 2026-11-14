# Combined local release — 2026-11-14

The user broadened the mobile-only publication to include all saved local work
and the concurrent car-booking changes. Integration uses a separate development
checkout, preserving the original workspace, its owned stash and independent
file backups until the tested release is restored.

## Included behavior

- Parent deletion and child creation/reparenting share a transaction and lock;
  the vehicle price editor retains these protections and saves its rate atomically.
- Support ticket capacity checks are serialized; notifications use the committed
  event snapshot instead of later mutable rows.
- Vehicle Add/Edit accepts a per-kilometre rate. The existing pricing engine
  supports individual-car overrides and optional advanced fare settings.
- Private car bookings use explicit place selection, verified road distance,
  a custom date/time selector in IST, and a refreshed fare before confirmation.
- Shared map search/routing quotas remain consumed after failed requests or cache
  writes. Cached route facts, not client distance or fare, determine booking prices.
- Saved hotel enquiries, itinerary suggestions, route ordering, catalogue map pins,
  runtime database safeguards, tests and project documentation are included.
- The previously published home-screen installation and mobile layout support
  remain included and receive regression coverage against the combined application.

## Schema and publication

Migration 030 contains only the previously approved per-car pricing reference and
two map-service tables. Earlier migrations remain unchanged. The development
baseline archives the reviewed 29-migration state and permits only the approved
030 additions. A fresh isolated replay reproduced production at 29 migrations and
development after 030; the temporary database was removed and absence verified.

Publication uses `npm run publish`, followed by Vercel readiness and another
`npm run db:check`. Production migrations run only through Vercel predeploy.

## Operational limits

- Admin must enter real vehicle rates. This release does not invent or seed fares.
- Free map services have availability and usage limits; no paid provider is enabled.
- Hotel supplier search remains disabled in production; stay enquiries remain
  available. AI itinerary and road-matrix integrations require their existing
  server-side provider configuration and report unavailable when absent.
- Browser automation covers representative records and viewport sizes. Actual
  iOS/Android home-screen installation still requires a physical-device check.
- Test bookings, emails, map calls and customer data are synthetic. Outbound mail
  is captured locally and provider responses are mocked in acceptance tests.

## Verification

- Optimized production build, project TypeScript and lint pass. Source hashes
  tie browser evidence to the integrated application. The only later page change
  corrects the hotel enquiry banner and passed a rebuilt 14-viewport check.
- All 12 integrated database suites pass: 34 catalogue/ticket/notification groups,
  six runtime safeguards, itinerary/hotel catalogue checks, 102 CRUD checks,
  eight workflow races, 27 P1 races, 18 upload/review/payout races, ten private
  booking concurrency groups, five shared-trip groups and both booking journeys.
- The car journey passes 16 HTTP checks plus real browser/database assertions.
  The booking/refund journey passes 51 API checks, including complete settlement.
  Synthetic accounts, bookings, rates and related data are removed afterward.
- Chrome and WebKit pass 770 viewport checks across 55 route/state cases,
  42 interactions, 132 spacing checks, five home-screen groups and 28 additional
  calendar/map-control checks. No browser runtime errors occurred.
- Origin enforcement passes 54 HTTP and six real-browser checks. Hotel enquiry
  submission, customer/admin conversations and closure pass with 16 API checks.
- Pricing, booking-state, refund, route, itinerary, hotel, support, contact,
  Authgear, CMS, weekend and schema-gate unit/contract suites pass. Map/IST checks
  pass 15 assertions; stale-quote browser races pass five groups.
- One initial content-race run timed out while observing a queued database lock.
  Its cleanup passed; a diagnostic advisory-lock probe and the complete rerun
  passed without changing application logic or weakening assertions. The first
  failure log is retained with the release artifacts.
- Before publication, the database gate accepts only migration 030 as pending,
  backed by the fresh schema replay proof. Final live deployment/parity results
  are recorded in the project memory after Vercel becomes ready.

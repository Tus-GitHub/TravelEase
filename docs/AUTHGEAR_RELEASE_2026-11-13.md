# Login choices release — 2026-11-13

User authorized publishing the login changes with mobile OTP disabled until
Authgear approves India, while excluding all other local changes.

## Behaviour

- Login offers email + password or mobile + OTP. Google remains available.
- Mobile authorization is gated by the server-only
  `AUTHGEAR_MOBILE_ENABLED` flag; the default is disabled.
- Production is explicitly configured with `AUTHGEAR_MOBILE_ENABLED=false`.
  No Authgear credentials or production callback were added. Disabled requests
  return to email/Google login without contacting Authgear or sending messages.
- The gated integration uses hosted OIDC with PKCE, state, nonce, verified
  signatures/claims and verified-phone UserInfo. Existing local users, roles and
  sessions remain authoritative. A signed-in account links its mobile identity
  once through My account. Contact phone values never match accounts.
- Linking/replacing/removing mobile login is transactional. Identity conflicts
  do not transfer ownership; replacement/removal revokes other sessions.
- No phone-only registration, migrations, new tables/columns, billing, paid
  provider setup, SMS sends or unrelated feature/runtime changes are included.

## Scope and preservation

Baseline: `75db0e2a8adecaefe2d04129abb510bf775f2f81` (verified live production,
`main`, `development`, and their remote references before this release).

The release contains the login/profile UI, MobileLoginCard, the three mobile API
routes, Authgear OIDC and local account/session helpers, mobile audit action
names, three authentication test files, the `jose` dependency/lock entry, and
Authgear-only setup/release documentation. Existing password and Google routes
are unchanged. Package scripts unrelated to mobile authentication are excluded.

111 original modified/untracked files were copied and SHA-256 verified before
an owned stash isolated the release. After publishing, restore those files and
verify their bytes against the backup before reporting completion. MEMORY.md and
ignored local credentials stay local. The original local database/runtime,
hotels, routing, itinerary, support, CMS/weekend work and applied migration files
are excluded from this commit.

## Validation

- TypeScript and ESLint passed for the isolated release.
- 24 mocked Authgear/OIDC tests passed, including signature, nonce, audience,
  issuer, expiry, authentication freshness and verified-phone failures.
- 16 real development transaction checks passed, including identity conflicts,
  disabled/deleted users, session binding, replacement and concurrent unlink/login.
  Synthetic accounts and sessions were removed and absence verified.
- Isolated optimized production build passed. Chrome/API authentication
  regression passed79 HTTP checks plus browser/database assertions, including
  both login choices, disabled-SMS fallback, Google presence, signup verification,
  password recovery, session expiry and concurrent password resets/logins.
  Nine emails terminated at the loopback sink; fixtures and temporary app were
  cleaned and their absence verified. No real SMS or external email was sent.
- Prepublication `npm run db:check`: **IN SYNC**, development29 / production29,
  no migration-ledger or schema-definition differences.

Publish using `npm run publish` from clean development; it repeats the parity
gate, merges development into main and pushes. Production migrations remain the
normal automatic Vercel predeploy step; no manual production migration.
After deployment, verify Vercel READY for the release commit, live login choices,
mobile-unavailable redirect, Google/email fallbacks, and database parity again.

## Activation still pending

The Authgear project is on Free ($0), with no billing or paid upgrade enabled.
India (+91) is disabled by the provider. The approved free-only support request
was submitted and acknowledged. The published allowance is 100 combined
SMS/WhatsApp messages/month, including resends. Real India delivery and the
quota hard-stop are not yet verified.

Keep mobile disabled after this release. After Authgear confirms free India
access and quota behaviour, a separately authorized activation must register the
exact HTTPS production callback, add server credentials, verify an OTP under the
user's control, and enable the flag. Never enable billing, top-ups or a paid
gateway to bypass the restriction.

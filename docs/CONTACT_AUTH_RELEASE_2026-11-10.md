# Contact delivery and authentication release — 2026-11-10

User authorized publication of contact-form delivery and authentication fixes only.
Published from main/development baseline736f8e2 through npm run publish.
Commit75db0e2a8adecaefe2d04129abb510bf775f2f81; production Vercel deployment
dpl_3wHKMJaVKpgDb9EpxjdWWD4K76MH is READY at https://travelease-rouge.vercel.app.

## Scope

- Guest contact form -> validated API -> existing SMTP -> saved admin contact inbox.
- Inbox validation/editor, immediate inbox reads and safe Reply-To email construction.
- Atomic verification/reset/session changes, sibling-token retirement and login/reset locking.
- Concurrent resend cooldown, bounded typed auth JSON and same-origin validation.
- Signup confirmation, safe login return paths, retryable recovery errors and logout failure handling.
- Focused contact/settings/auth tests and operator documentation.

No migrations, table/column changes, dependencies or environment/secret changes.
Only the previously selected contact inbox setting was copied to production;
no catalogue/CMS/booking data was copied. Hotel/AI/routing features, support fixes,
runtime database hardening and unrelated documentation/code remain excluded.
Existing booking, Weekend Trips, CMS and Google OAuth implementations are retained.

## Verification

- Curated tree: TypeScript and lint passed;12 contact test groups passed.
- Required read-only parity check: IN SYNC29/29, no definition differences.
- LAN DNS refused the Neon hostname. Two public resolvers agreed; local verification
  uses a temporary process-only Neon DNS fallback with TLS verification retained.
  No system/production DNS or application connection configuration changed.
- Exact isolated optimized build and real Chrome/auth API/dev DB acceptance passed:
  75 HTTP checks, nine loopback emails, token expiry/replay/sibling-link retirement,
  concurrent resend/reset/login, rollback, cookies, UI failures and fixture cleanup.
- Existing development inbox resolution/admin changes passed with all writes rolled back.
- Real contact Chrome -> API -> existing development inbox -> verified TLS loopback
  SMTP -> UI receipt passed. Retained input, duplicate accepted retry, forged
  recipient/origin rejection, reset and mobile overflow/page-error checks passed.
  One message captured locally. Screenshots reviewed; test app/sinks cleaned.
- Production SMTP and EMAIL_FROM variable presence verified through Vercel metadata,
  with no secret values printed or changed. Production has no saved contact inbox;
  after READY, configured the same previously user-selected verified-sender inbox
  with a guarded single-setting transaction, prior-row backup and system audit.
  No real external email was sent; production Inbox receipt remains a separate check.

## Preservation and release

127 original local/history files copied to a hash-verified artifact backup before
the owned contact-auth-release-preserve-20261110 stash. Only29 selected source/test
files plus three package scripts and focused release documentation were installed
for validation (32 changed files total). Restored and byte-verified125 original
source/document files;123 remain byte-identical after retaining the focused DEPLOY
appendix and auth runner's build-test improvements. MEMORY/plan were preserved.
Artifact backup remains. Removed only the verified owned preservation stash after
restoration/audit; no other stash was touched.

npm run publish passed the parity gate, fast-forwarded main from development,
pushed both branches and returned to development. Main/development and both
recorded origin refs match75db0e2. Vercel READY confirmed for the exact commit.
Final db:check IN SYNC29/29, no definition differences. No migration was needed.

Production:26 HTTP checks and desktop/mobile real Chrome contact/login/admin-access
checks passed with zero page errors. Same-origin bounded auth/contact input,
cross-origin rejection, invalid reset/verification links and guest admin protection
passed. Hotel, AI and routing provider APIs remain404. No external test email,
real customer account, production token or booking was created. Runtime error
inspection showed only the existing pg SSL-mode compatibility warning; runtime
database hardening remains outside this release. Production email Inbox receipt
and real Google OAuth remain separate acceptance checks.

Fresh public settings response confirms the selected inbox is displayed. The
existing public-settings URL can retain its old response through its60-second
cache plus300-second stale-while-revalidate window; the fresh query key returned
MISS with the correct address. Contact delivery reads the saved inbox directly.

This final outcome update and merged operator appendix are local release records;
the published code commit contains the pre-publication validation/scope record.

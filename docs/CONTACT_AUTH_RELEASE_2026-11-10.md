# Contact delivery and authentication release — 2026-11-10

User authorized publication of contact-form delivery and authentication fixes only.
Prepared from main/development baseline736f8e2. Validation passed; publication pending.

## Scope

- Guest contact form -> validated API -> existing SMTP -> saved admin contact inbox.
- Inbox validation/editor, immediate inbox reads and safe Reply-To email construction.
- Atomic verification/reset/session changes, sibling-token retirement and login/reset locking.
- Concurrent resend cooldown, bounded typed auth JSON and same-origin validation.
- Signup confirmation, safe login return paths, retryable recovery errors and logout failure handling.
- Focused contact/settings/auth tests and operator documentation.

No migrations, table/column changes, dependencies or secret/config changes. No
development content copied to production. Hotel/AI/routing features, support fixes,
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
  the release will configure the same previously user-selected inbox after READY,
  with a guarded single-setting transaction and system-attributed audit record.
  No real external email was sent; production Inbox receipt remains a separate check.

## Preservation and release

127 original local/history files copied to a hash-verified artifact backup before
the owned contact-auth-release-preserve-20261110 stash. Only29 selected source/test
files plus three package scripts and focused release documentation were restored
for validation. The original local files will be restored and byte-verified after
publication; only this owned stash may then be removed. Other stashes stay intact.

Publication must use npm run publish from clean development, then Vercel READY for
the exact commit, safe live checks, and another db:check. No external test email,
real customer account, production token or booking is created by acceptance.

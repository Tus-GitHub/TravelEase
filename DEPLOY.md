# Deploying TravelEase (free)

Stack: **Vercel Hobby** (hosting, $0) + **Neon** (Postgres, $0) + the free `*.vercel.app` URL.

- **`main`** → the live site (Vercel production, Neon `production` DB).
- **`development`** → where work happens (Vercel preview URL, Neon `development` DB).
- **Publish = merge `development` → `main` and push.** Pending DB migrations apply themselves on the production deploy.

---

## One-time setup

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

## JSON page CMS (development, 2026-11-06)

Open `/admin/pages` through **Pages / CMS** in the admin sidebar. Homepage and
About are initialized from the existing site content. Administrators can create
custom pages, reuse Homepage/About layouts, edit text/photos/buttons/backgrounds,
add/duplicate/reorder/hide sections, preview drafts, and publish with a custom
confirmation dialog. Page settings include SEO and header/footer menu entries.
The editor uses existing admin auth, theme components and Cloudinary configuration;
no extra provider or dependency is required. Full guide/schema: docs/CMS_PLAN.md.

JSON documents are stored in the two user-approved tables `cms_pages` and
`cms_page_revisions`. Migration028 is applied on DEVELOPMENT only and must never
be edited. `db/cms-setup-dev.mjs --dev` applied it after checking the previous27
baseline/checksums, verified only reviewed additions, archived the old baseline
to `db/dev-schema-baseline-before-cms.json`, and advanced the reviewed baseline
to28. Narrow grants use the existing runtime role; future dev role setup retains
SELECT/INSERT-only access to the revisions table. No production migration, grants,
connection or deployment was performed.

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
is separate from deploying code to production. A later explicitly authorized
release must still use the existing db:check/publish runbook; production migrations
run automatically. Also review any restricted production role's grants for the new
tables before release. Development draft/content edits are not copied to production
by a code deployment; migration028 seeds the initial homepage/About snapshot there.


## CMS release rehearsal (2026-11-06)

User authorized production CMS publication, migration027 coordinate columns and
a temporary DEVELOPMENT schema-only rehearsal. Rehearsal passed and its database
was removed. See docs/CMS_RELEASE_2026-11-06.md for the exact scope and evidence.
The enhanced db:check requires current development baseline/hash parity and either
full production parity or fresh isolated-replay proof bound to both endpoints,
schemas and all SQL files. Evidence expires after48 hours; it cannot waive unrelated
drift. Production migrations still run only through Vercel predeploy.

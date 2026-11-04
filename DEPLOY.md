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
**Manage photo(s)** under its name. Upload JPEG/PNG/WebP up to 3 MB. Vehicles
support ten photos and a selectable cover; other records have one replaceable
image. Photos are public, so do not upload licence/identity documents here.
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

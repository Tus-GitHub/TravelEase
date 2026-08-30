// Runs during Vercel's build (wired via the "vercel-build" script in
// package.json). On the PRODUCTION deploy only, it applies any pending
// migrations to the production database before the new code starts serving.
//
// Why here: `git push origin main` is the publish action, and app code on
// `main` may expect schema that production doesn't have yet. Running migrations
// as the first build step means the schema is always in place before the new
// deployment goes live. If a migration fails, the build fails and the previous
// deployment keeps serving — nothing half-migrated ever goes live.
//
// Preview deploys (VERCEL_ENV=preview) skip this — their DATABASE_URL points at
// the Neon `development` branch, which is migrated locally with `npm run migrate`.

const { runMigrations } = require("./migrate-pg");

async function main() {
  const env = process.env.VERCEL_ENV || "(unset)";

  if (env !== "production") {
    console.log(`predeploy: VERCEL_ENV=${env} — not a production deploy, skipping migrations.`);
    return;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("predeploy: DATABASE_URL is not set for the production deploy.");
  }

  console.log("predeploy: production deploy — applying pending migrations before build.");
  const { appliedCount } = await runMigrations({
    connectionString,
    label: "PRODUCTION (Vercel deploy)",
  });
  console.log(`predeploy: ${appliedCount} migration(s) applied. Continuing to build.`);
}

main().catch((err) => {
  console.error(`predeploy FAILED: ${err.message || err}`);
  process.exit(1);
});

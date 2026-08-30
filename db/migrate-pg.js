const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const MIGRATIONS_DIR = path.join(__dirname, "pg-migrations");

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      migration_id VARCHAR(255) PRIMARY KEY,
      applied_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

async function getAppliedMigrations(client) {
  const result = await client.query("SELECT migration_id FROM schema_migrations");
  return new Set(result.rows.map((row) => row.migration_id));
}

async function applyMigration(client, filename, sqlText) {
  await client.query("BEGIN");
  try {
    await client.query(sqlText);
    await client.query("INSERT INTO schema_migrations (migration_id) VALUES ($1)", [filename]);
    await client.query("COMMIT");
    console.log(`Applied: ${filename}`);
  } catch (err) {
    await client.query("ROLLBACK");
    throw new Error(`Migration ${filename} failed: ${err.message}`);
  }
}

// Apply every pending migration against one database. Reusable so both the CLI
// below and the Vercel predeploy step (db/predeploy.js) share identical logic.
async function runMigrations({ connectionString, label }) {
  console.log(`Target: ${label}`);
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await ensureMigrationsTable(client);
    const applied = await getAppliedMigrations(client);

    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    let appliedCount = 0;
    for (const file of files) {
      if (applied.has(file)) {
        console.log(`Skipping (already applied): ${file}`);
        continue;
      }
      const sqlText = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
      await applyMigration(client, file, sqlText);
      appliedCount++;
    }

    console.log(
      `Done. ${appliedCount} migration(s) applied, ${files.length - appliedCount} already up to date.`,
    );
    return { appliedCount, total: files.length };
  } finally {
    await client.end();
  }
}

async function main() {
  // `--production` targets the production Neon branch (DATABASE_URL_PRODUCTION);
  // default is the development branch (DATABASE_URL). Both live in .env.local.
  const useProd = process.argv.includes("--production");
  const envVar = useProd ? "DATABASE_URL_PRODUCTION" : "DATABASE_URL";
  const connectionString = process.env[envVar];
  if (!connectionString) {
    throw new Error(`${envVar} is not set (expected in .env.local)`);
  }
  await runMigrations({
    connectionString,
    label: useProd ? "PRODUCTION branch" : "development branch",
  });
}

module.exports = { runMigrations, MIGRATIONS_DIR };

// Run as a CLI only when invoked directly (`node db/migrate-pg.js`), not when
// require()d by db/predeploy.js.
if (require.main === module) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

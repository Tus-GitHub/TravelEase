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

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set (expected in .env.local)");
  }

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

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

  console.log(`Done. ${appliedCount} migration(s) applied, ${files.length - appliedCount} already up to date.`);
  await client.end();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});

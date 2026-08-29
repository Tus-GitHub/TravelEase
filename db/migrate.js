const fs = require("fs");
const path = require("path");
const sql = require("mssql/msnodesqlv8");

const MIGRATIONS_DIR = path.join(__dirname, "migrations");

async function ensureMigrationsTable(pool) {
  await pool.request().query(`
    IF OBJECT_ID('dbo.SchemaMigrations', 'U') IS NULL
    CREATE TABLE dbo.SchemaMigrations (
      MigrationId NVARCHAR(255) PRIMARY KEY,
      AppliedAt   DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
  `);
}

async function getAppliedMigrations(pool) {
  const result = await pool.request().query("SELECT MigrationId FROM dbo.SchemaMigrations");
  return new Set(result.recordset.map((row) => row.MigrationId));
}

async function applyMigration(pool, filename, sqlText) {
  const transaction = pool.transaction();
  await transaction.begin();
  try {
    await transaction.request().batch(sqlText);
    await transaction
      .request()
      .input("id", sql.NVarChar, filename)
      .query("INSERT INTO dbo.SchemaMigrations (MigrationId) VALUES (@id)");
    await transaction.commit();
    console.log(`Applied: ${filename}`);
  } catch (err) {
    await transaction.rollback();
    throw new Error(`Migration ${filename} failed: ${err.message}`);
  }
}

async function main() {
  const server = process.env.DB_SERVER || "localhost";
  const database = process.env.DB_NAME || "TravelAgentDB";
  const pool = await new sql.ConnectionPool({
    connectionString: `Driver={ODBC Driver 17 for SQL Server};Server=${server};Database=${database};Trusted_Connection=Yes;`,
  }).connect();

  await ensureMigrationsTable(pool);
  const applied = await getAppliedMigrations(pool);

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
    await applyMigration(pool, file, sqlText);
    appliedCount++;
  }

  console.log(`Done. ${appliedCount} migration(s) applied, ${files.length - appliedCount} already up to date.`);
  await pool.close();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});

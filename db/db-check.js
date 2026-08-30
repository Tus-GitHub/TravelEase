// Compares the two Neon branches — `development` (DATABASE_URL) and `production`
// (DATABASE_URL_PRODUCTION) — before publishing. Run: `npm run db:check`.
//
// It checks:
//   1. the schema_migrations ledger on each side
//   2. every public column (name, type, nullability, default)
//   3. triggers and functions in the public schema
//
// Exit codes:
//   0  IN SYNC, or production is only behind by migrations that exist as local
//      files — the Vercel deploy will apply those, so it's safe to publish.
//   1  Real drift: production ahead of development, an applied migration with no
//      local file, or schema differences while the ledgers already match (means
//      a database was hand-edited). Investigate before publishing.

const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const MIGRATIONS_DIR = path.join(__dirname, "pg-migrations");

async function snapshot(connectionString) {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    let migrations = [];
    try {
      const r = await client.query(
        "SELECT migration_id FROM schema_migrations ORDER BY migration_id",
      );
      migrations = r.rows.map((row) => row.migration_id);
    } catch {
      migrations = []; // table doesn't exist yet on this branch
    }

    const columns = (
      await client.query(`
        SELECT table_name || '.' || column_name AS key,
               data_type,
               is_nullable,
               COALESCE(column_default, '') AS column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
        ORDER BY 1
      `)
    ).rows;

    const triggers = (
      await client.query(`
        SELECT DISTINCT event_object_table || ':' || trigger_name AS key
        FROM information_schema.triggers
        WHERE trigger_schema = 'public'
        ORDER BY 1
      `)
    ).rows.map((row) => row.key);

    const functions = (
      await client.query(`
        SELECT routine_name AS key
        FROM information_schema.routines
        WHERE routine_schema = 'public' AND routine_type = 'FUNCTION'
        ORDER BY 1
      `)
    ).rows.map((row) => row.key);

    return { migrations, columns, triggers, functions };
  } finally {
    await client.end();
  }
}

function setDiff(a, b) {
  const bs = new Set(b);
  return a.filter((x) => !bs.has(x));
}

function columnMap(rows) {
  const m = new Map();
  for (const r of rows) {
    m.set(r.key, `${r.data_type} | nullable=${r.is_nullable} | default=${r.column_default}`);
  }
  return m;
}

function printList(label, items) {
  if (items.length === 0) {
    console.log(`  ${label}: none`);
  } else {
    console.log(`  ${label}:`);
    for (const it of items) console.log(`      ${it}`);
  }
}

async function main() {
  const devUrl = process.env.DATABASE_URL;
  const prodUrl = process.env.DATABASE_URL_PRODUCTION;
  if (!devUrl) throw new Error("DATABASE_URL is not set (expected in .env.local)");
  if (!prodUrl) throw new Error("DATABASE_URL_PRODUCTION is not set (expected in .env.local)");

  const [dev, prod] = await Promise.all([snapshot(devUrl), snapshot(prodUrl)]);

  const localFiles = new Set(
    fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")),
  );

  const migOnlyDev = setDiff(dev.migrations, prod.migrations); // production is behind by these
  const migOnlyProd = setDiff(prod.migrations, dev.migrations); // production is ahead — unusual
  const migMissingFile = [...new Set([...dev.migrations, ...prod.migrations])].filter(
    (m) => !localFiles.has(m),
  );

  const devCols = columnMap(dev.columns);
  const prodCols = columnMap(prod.columns);
  const colOnlyDev = [...devCols.keys()].filter((k) => !prodCols.has(k));
  const colOnlyProd = [...prodCols.keys()].filter((k) => !devCols.has(k));
  const colChanged = [...devCols.keys()].filter(
    (k) => prodCols.has(k) && devCols.get(k) !== prodCols.get(k),
  );

  const trigOnlyDev = setDiff(dev.triggers, prod.triggers);
  const trigOnlyProd = setDiff(prod.triggers, dev.triggers);
  const fnOnlyDev = setDiff(dev.functions, prod.functions);
  const fnOnlyProd = setDiff(prod.functions, dev.functions);

  const ledgersEqual = migOnlyDev.length === 0 && migOnlyProd.length === 0;
  const schemaEqual =
    colOnlyDev.length === 0 &&
    colOnlyProd.length === 0 &&
    colChanged.length === 0 &&
    trigOnlyDev.length === 0 &&
    trigOnlyProd.length === 0 &&
    fnOnlyDev.length === 0 &&
    fnOnlyProd.length === 0;

  console.log("");
  console.log("  DB parity:  development   vs   production");
  console.log(`  migrations applied:  development ${dev.migrations.length}   production ${prod.migrations.length}`);
  console.log("");
  console.log("Migrations");
  printList("only on development (production is BEHIND)", migOnlyDev);
  printList("only on production (production is AHEAD — unusual)", migOnlyProd);
  printList("applied somewhere but no local .sql file", migMissingFile);
  console.log("");
  console.log("Schema");
  printList("columns only on development", colOnlyDev);
  printList("columns only on production", colOnlyProd);
  printList("columns whose type/nullable/default differ", colChanged);
  printList("triggers only on development", trigOnlyDev);
  printList("triggers only on production", trigOnlyProd);
  printList("functions only on development", fnOnlyDev);
  printList("functions only on production", fnOnlyProd);
  console.log("");
  console.log("─".repeat(60));

  // ---- verdict --------------------------------------------------------------
  if (ledgersEqual && schemaEqual) {
    console.log("RESULT: IN SYNC. Safe to publish.");
    process.exit(0);
  }

  if (migOnlyProd.length > 0) {
    console.log("RESULT: production is AHEAD of development. A migration ran on");
    console.log("        production that development never got. Investigate before");
    console.log("        publishing — do NOT merge to main yet.");
    process.exit(1);
  }

  if (migMissingFile.length > 0) {
    console.log("RESULT: a migration is recorded as applied but its .sql file is");
    console.log("        missing locally. The migration set is inconsistent —");
    console.log("        investigate before publishing.");
    process.exit(1);
  }

  if (ledgersEqual && !schemaEqual) {
    console.log("RESULT: migration ledgers match but the schemas differ. A database");
    console.log("        was changed by hand outside a migration. Reconcile it into");
    console.log("        a numbered migration before publishing.");
    process.exit(1);
  }

  // Remaining case: production behind only by migrations that DO have local
  // files, and every schema difference is plausibly from those pending files.
  console.log(`RESULT: production is behind by ${migOnlyDev.length} migration(s), all present`);
  console.log("        as local files. The production deploy (vercel-build) will apply");
  console.log("        them before the new code serves. OK to publish — then run");
  console.log("        `npm run db:check` again; it should report IN SYNC.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

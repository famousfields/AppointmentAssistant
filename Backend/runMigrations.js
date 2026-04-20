const fs = require("fs/promises");
const path = require("path");

const MIGRATIONS_DIR = path.join(__dirname, "migrations");

function normalizeStatement(statement = "") {
  return String(statement)
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function isIgnorableMigrationError(statement, error) {
  const normalized = normalizeStatement(statement);

  // Older MySQL versions do not support some IF NOT EXISTS / IF EXISTS patterns,
  // so replaying migrations against partially migrated databases needs to be tolerant.
  if (error.code === "ER_DUP_FIELDNAME") {
    return true;
  }

  if (error.code === "ER_CANT_DROP_FIELD_OR_KEY" && normalized.includes("DROP INDEX")) {
    return true;
  }

  if (
    (error.code === "ER_DUP_KEYNAME" || error.code === "ER_FK_DUP_NAME") &&
    (normalized.includes("ADD UNIQUE KEY") ||
      normalized.includes("ADD KEY") ||
      normalized.includes("ADD CONSTRAINT"))
  ) {
    return true;
  }

  return false;
}

async function ensureMigrationsTable(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      executed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function runMigrations(db) {
  await ensureMigrationsTable(db);

  const files = (await fs.readdir(MIGRATIONS_DIR))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const filename of files) {
    const [rows] = await db.query(
      "SELECT id FROM schema_migrations WHERE filename = ? LIMIT 1",
      [filename]
    );

    if (rows.length > 0) continue;

    const migrationPath = path.join(MIGRATIONS_DIR, filename);
    const sql = await fs.readFile(migrationPath, "utf8");

    if (!sql.trim()) {
      await db.query("INSERT INTO schema_migrations (filename) VALUES (?)", [filename]);
      continue;
    }

    const statements = sql
      .split(/;\s*\n/g)
      .map((statement) => statement.trim())
      .filter(Boolean);

    await db.query("START TRANSACTION");
    try {
      for (const statement of statements) {
        try {
          await db.query(statement);
        } catch (error) {
          if (isIgnorableMigrationError(statement, error)) {
            console.warn(
              `Skipping already-applied migration statement in ${filename}: ${error.code}`
            );
            continue;
          }
          throw error;
        }
      }
      await db.query("INSERT INTO schema_migrations (filename) VALUES (?)", [filename]);
      await db.query("COMMIT");
      console.log(`✅ Applied migration: ${filename}`);
    } catch (error) {
      await db.query("ROLLBACK");
      throw error;
    }
  }
}

if (require.main === module) {
  const db = require("./db");
  runMigrations(db.promise())
    .then(() => {
      console.log("✅ Migrations complete");
      db.end();
    })
    .catch((error) => {
      console.error("❌ Migration failed:", error);
      db.end();
      process.exit(1);
    });
}

module.exports = runMigrations;

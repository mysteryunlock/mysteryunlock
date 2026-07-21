/**
 * Startup migration runner — applies any unapplied SQL files from
 * supabase/migrations/ in filename order.
 *
 * Tracking: a lightweight `_migration_history` table records which files have
 * been run so already-applied files are always skipped.  All DDL in the
 * migration files uses IF NOT EXISTS / IF EXISTS guards, so retrying a file
 * that was partially applied is safe.
 *
 * Transaction handling: migration files are executed as-is — some include
 * their own BEGIN/COMMIT blocks. The runner never wraps file SQL in an outer
 * transaction. After a file completes successfully, its filename is recorded
 * in _migration_history in a separate autocommit statement.
 *
 * Requires: SUPABASE_DIRECT_URL environment variable (Supabase postgres
 * connection string).  Find it in your Supabase project → Settings →
 * Database → Connection string → URI (Session pooler, port 5432).
 *
 * Note: Replit's runtime injects DATABASE_URL pointing to its own managed
 * PostgreSQL instance, which is separate from the Supabase database used by
 * this project.  SUPABASE_DIRECT_URL is therefore used instead so the runner
 * always targets the correct database.
 *
 * If SUPABASE_DIRECT_URL is absent the runner logs a warning and exits without
 * error so the server still starts normally.  Any migration failure is logged
 * clearly but will not crash the server — the failed file will be retried on
 * the next startup until it succeeds.
 */

import { readdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pkg from "pg";

const { Client } = pkg;

const MIGRATIONS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "migrations"
);

const HISTORY_TABLE_DDL = `
  CREATE TABLE IF NOT EXISTS public._migration_history (
    filename   TEXT        PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`;

export async function runMigrations() {
  // SUPABASE_DIRECT_URL is the Supabase Session-pooler connection string.
  // We cannot use DATABASE_URL here because Replit's runtime injects that key
  // pointing to its own managed PostgreSQL — not the Supabase database.
  const connectionString = process.env.SUPABASE_DIRECT_URL;

  if (!connectionString) {
    console.warn(
      "[migrations] SUPABASE_DIRECT_URL is not set — skipping automatic migrations.\n" +
        "             Set SUPABASE_DIRECT_URL to your Supabase Session-pooler connection\n" +
        "             string (project → Settings → Database → Connection string, port 5432)\n" +
        "             to enable automatic schema migrations on startup."
    );
    return;
  }

  const client = new Client({ connectionString });

  try {
    await client.connect();

    // Ensure the tracking table exists (autocommit, no outer transaction)
    await client.query(HISTORY_TABLE_DDL);

    // Fetch already-applied filenames
    const { rows: applied } = await client.query(
      "SELECT filename FROM public._migration_history ORDER BY filename"
    );
    const appliedSet = new Set(applied.map((r) => r.filename));

    // Read all .sql files, sorted lexicographically (timestamp-prefix ordering)
    const allFiles = (await readdir(MIGRATIONS_DIR))
      .filter((f) => f.endsWith(".sql"))
      .sort();

    const pending = allFiles.filter((f) => !appliedSet.has(f));

    if (pending.length === 0) {
      console.log("[migrations] All migrations already applied — nothing to do.");
      return;
    }

    console.log(
      `[migrations] ${pending.length} pending migration(s) to apply: ${pending.join(", ")}`
    );

    let failCount = 0;

    for (const filename of pending) {
      const filePath = join(MIGRATIONS_DIR, filename);
      const sql = await readFile(filePath, "utf8");

      try {
        // Execute the migration SQL exactly as written.
        // Files that manage their own transaction (BEGIN/COMMIT) are handled
        // by PostgreSQL naturally. Files without transactions run in autocommit
        // mode. We never add an outer transaction wrapper.
        await client.query(sql);

        // Record success in a separate autocommit statement so it does not
        // interfere with any transaction the migration file already committed.
        await client.query(
          "INSERT INTO public._migration_history (filename) VALUES ($1) ON CONFLICT DO NOTHING",
          [filename]
        );

        console.log(`[migrations] ✓ Applied ${filename}`);
      } catch (err) {
        failCount++;
        console.error(
          `[migrations] ✗ Failed to apply ${filename}: ${err.message}`
        );
        // Continue with remaining migrations — DDL is idempotent (IF NOT
        // EXISTS guards), so one failure should not block the rest.
        // The failed file will be retried on the next startup.
      }
    }

    if (failCount > 0) {
      console.warn(
        `[migrations] ${failCount} migration(s) failed. ` +
          "The application will continue but some schema may be missing. " +
          "Check the errors above and ensure DATABASE_URL points to the correct database."
      );
    } else {
      console.log("[migrations] Migration run complete — all files applied.");
    }
  } finally {
    await client.end().catch(() => {});
  }
}

/**
 * Unit tests for the schema-guard helpers in marketing-template.functions.ts
 *
 * `isSchemaMissingError` pattern-matches Postgres error messages that indicate
 * a missing relation or column (i.e. a pending migration).  `guardSchema`
 * wraps a Supabase error: schema-missing errors become an actionable message
 * pointing to the migration file; all other errors pass through unchanged.
 *
 * Run with: bun test src/lib/__tests__/marketing-template-schema-guard.test.ts
 */

import { describe, it, expect } from "bun:test";
import {
  isSchemaMissingError,
  guardSchema,
} from "@/lib/marketing-template.functions";

// ── isSchemaMissingError ──────────────────────────────────────────────────────

describe("isSchemaMissingError", () => {
  // ── patterns that SHOULD match ────────────────────────────────────────────

  it('matches "relation X does not exist" (missing table)', () => {
    expect(
      isSchemaMissingError('relation "marketing_templates" does not exist'),
    ).toBe(true);
  });

  it('matches "column X of relation Y does not exist" (missing column)', () => {
    expect(
      isSchemaMissingError(
        'column "scheduled_at" of relation "marketing_broadcasts" does not exist',
      ),
    ).toBe(true);
  });

  it('matches bare "does not exist" substring', () => {
    expect(isSchemaMissingError("does not exist")).toBe(true);
  });

  it('matches "undefined column" variant', () => {
    expect(isSchemaMissingError("undefined column: scheduled_at")).toBe(true);
  });

  it('matches messages containing both "column" and "relation"', () => {
    expect(
      isSchemaMissingError("column foo of relation bar is unknown"),
    ).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(
      isSchemaMissingError('Relation "marketing_templates" Does Not Exist'),
    ).toBe(true);
    expect(isSchemaMissingError("UNDEFINED COLUMN: foo")).toBe(true);
    expect(
      isSchemaMissingError("COLUMN foo OF RELATION bar"),
    ).toBe(true);
  });

  // ── patterns that should NOT match ────────────────────────────────────────

  it("does not match a generic permission error", () => {
    expect(
      isSchemaMissingError("permission denied for table marketing_templates"),
    ).toBe(false);
  });

  it("does not match a unique-constraint violation", () => {
    expect(
      isSchemaMissingError(
        'duplicate key value violates unique constraint "marketing_templates_pkey"',
      ),
    ).toBe(false);
  });

  it("does not match a foreign-key violation", () => {
    expect(
      isSchemaMissingError(
        'insert or update on table "x" violates foreign key constraint "x_shop_id_fkey"',
      ),
    ).toBe(false);
  });

  it("does not match a network / connection error", () => {
    expect(isSchemaMissingError("connection refused")).toBe(false);
  });

  it("does not match an empty string", () => {
    expect(isSchemaMissingError("")).toBe(false);
  });

  it("does not match a message with only 'column' but not 'relation' and not 'does not exist'", () => {
    // "column" alone without "relation" or "does not exist" should not match
    expect(isSchemaMissingError("column value too long")).toBe(false);
  });
});

// ── guardSchema ───────────────────────────────────────────────────────────────

const MIGRATION_FILE = "20260706200000_marketing_templates.sql";

describe("guardSchema", () => {
  // ── schema-missing errors → actionable message ────────────────────────────

  it('wraps a "does not exist" error with an actionable migration message', () => {
    const err = guardSchema(
      { message: 'relation "marketing_templates" does not exist' },
      "listTemplates",
    );
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toContain("Database migration not applied");
    expect(err.message).toContain("listTemplates");
    expect(err.message).toContain(MIGRATION_FILE);
  });

  it("includes the original Postgres message in the actionable error", () => {
    const original = 'relation "marketing_templates" does not exist';
    const err = guardSchema({ message: original }, "createTemplate");
    expect(err.message).toContain(original);
  });

  it("includes the hint in the actionable error", () => {
    const err = guardSchema(
      { message: "undefined column: scheduled_at" },
      "saveScheduledBroadcast",
    );
    expect(err.message).toContain("saveScheduledBroadcast");
  });

  it("mentions the SQL editor instruction in the actionable error", () => {
    const err = guardSchema(
      { message: 'column "scheduled_at" of relation "marketing_broadcasts" does not exist' },
      "listScheduledBroadcasts",
    );
    expect(err.message).toContain("Supabase SQL editor");
  });

  it("mentions the pending_migrations.sql fallback", () => {
    const err = guardSchema(
      { message: "does not exist" },
      "deleteTemplate",
    );
    expect(err.message).toContain("pending_migrations.sql");
  });

  // ── non-schema errors → pass-through unchanged ────────────────────────────

  it("re-throws a permission error with the original message, unchanged", () => {
    const original = "permission denied for table marketing_templates";
    const err = guardSchema({ message: original }, "listTemplates");
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe(original);
  });

  it("re-throws a unique-constraint error unchanged", () => {
    const original =
      'duplicate key value violates unique constraint "marketing_templates_pkey"';
    const err = guardSchema({ message: original }, "createTemplate");
    expect(err.message).toBe(original);
  });

  it("re-throws a network error unchanged", () => {
    const original = "connection refused";
    const err = guardSchema({ message: original }, "updateTemplate");
    expect(err.message).toBe(original);
  });

  it("re-throws a foreign-key violation unchanged", () => {
    const original =
      'insert or update on table "x" violates foreign key constraint "x_shop_id_fkey"';
    const err = guardSchema({ message: original }, "createTemplate");
    expect(err.message).toBe(original);
  });

  it("always returns an Error instance, never re-throws the original object", () => {
    const err1 = guardSchema({ message: "does not exist" }, "hint");
    const err2 = guardSchema({ message: "some other error" }, "hint");
    expect(err1).toBeInstanceOf(Error);
    expect(err2).toBeInstanceOf(Error);
  });
});

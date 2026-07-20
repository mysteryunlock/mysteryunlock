/**
 * Integration-style tests for the scheduled-broadcast server-function handlers.
 *
 * Strategy
 * --------
 * Bun runs each test file in its own process, so the module registry is clean.
 * We register mock.module() calls BEFORE the dynamic import of
 * marketing-template.functions.ts so that:
 *
 *   • createServerFn (from @tanstack/react-start) is replaced with a thin
 *     shim that captures the real handler closure and calls it directly with
 *     an injected Supabase context — no HTTP round-trip, no TanStack router
 *     infrastructure needed.
 *
 *   • requireSupabaseAuth (from the auth-middleware module) is replaced with
 *     a stub so its side-effectful import chain (ws, supabase-js …) is
 *     bypassed entirely.
 *
 * The functions loaded via dynamic import ARE the real exported server
 * functions (saveScheduledBroadcast, listScheduledBroadcasts, etc.).  Their
 * handler closures contain the real guardSchema call, so a regression that
 * removes or bypasses guardSchema will immediately break these tests.
 *
 * Run with:
 *   bun test src/lib/__tests__/marketing-template-handlers.test.ts
 */

import { mock, describe, it, expect, beforeAll } from "bun:test";

// ── Constants ─────────────────────────────────────────────────────────────────

const SHOP_ID        = "00000000-0000-0000-0000-000000000002";
const BROADCAST_ID   = "00000000-0000-0000-0000-000000000003";
const FAKE_USER_ID   = "00000000-0000-0000-0000-000000000001";
const MIGRATION_FILE = "20260706200000_marketing_templates.sql";
const SENTINEL       = "Database migration not applied";

const SCHEMA_MISSING_MSG =
  'column "scheduled_at" of relation "marketing_broadcasts" does not exist';
const RELATION_MISSING_MSG =
  'relation "marketing_broadcasts" does not exist';
const PERMISSION_ERR =
  "permission denied for table marketing_broadcasts";

// ── Supabase stub ─────────────────────────────────────────────────────────────
//
// Every chained Supabase method returns `this` so the caller can keep chaining.
// Terminal methods (.single(), .maybeSingle()) resolve with the configured
// result.  A .then() property lets `await chain` resolve the same way (needed
// for callers that don't use a terminal method, e.g. cancelScheduledBroadcast).

type QueryResult = { data: unknown; error: { message: string } | null };

function makeChain(result: QueryResult) {
  const terminal = () => Promise.resolve(result);
  const chain: Record<string, unknown> = {
    select:      () => chain,
    insert:      () => chain,
    update:      () => chain,
    delete:      () => chain,
    eq:          () => chain,
    limit:       () => chain,
    order:       () => chain,
    single:      terminal,
    maybeSingle: terminal,
    // Allow `await chain` without an explicit terminal method.
    then: (
      resolve: (v: QueryResult) => void,
      reject?: (e: unknown) => void,
    ) => Promise.resolve(result).then(resolve, reject),
  };
  return chain;
}

/**
 * Builds a Supabase stub where:
 *  - `shops` table always succeeds (so assertOwner() passes)
 *  - every other table returns the given error (or success when null)
 */
function makeSupabaseStub(broadcastsError: string | null) {
  return {
    from: (table: string) => {
      if (table === "shops") {
        // assertOwner needs a non-null row to proceed
        return makeChain({ data: { id: SHOP_ID }, error: null });
      }
      if (broadcastsError !== null) {
        return makeChain({ data: null, error: { message: broadcastsError } });
      }
      // Success path — return minimal valid data per table
      return makeChain({ data: [], error: null });
    },
  };
}

// ── Mutable context store ─────────────────────────────────────────────────────
//
// Tests swap context.supabase before calling the real server function.

const contextStore = {
  supabase: makeSupabaseStub(SCHEMA_MISSING_MSG) as unknown,
  userId:   FAKE_USER_ID,
};

// ── Module mocks ──────────────────────────────────────────────────────────────
//
// IMPORTANT: these calls must happen before any import of the module under
// test.  Bun evaluates these at module-parse time, before the dynamic import
// in beforeAll(), so the mocked versions are in the registry when
// marketing-template.functions.ts is first loaded.

mock.module("@tanstack/react-start", () => ({
  /**
   * Minimal createServerFn shim.
   *
   * .middleware() / .validator() are no-ops that return `this`.
   * .handler(fn) wraps the real handler fn so that when the exported function
   * is called as `fn({ data })`, the handler receives
   * `{ data, context: contextStore }` — exactly what the real TanStack
   * pipeline would supply after the auth middleware runs.
   */
  createServerFn: (_options?: unknown) => {
    const builder: Record<string, unknown> = {};
    builder.middleware  = () => builder;
    builder.validator   = () => builder;
    builder.handler     = (handlerFn: (arg: unknown) => Promise<unknown>) => {
      // Return the "real" exported server function.
      // When a test calls saveScheduledBroadcast({ data: {...} }), this async
      // function runs the actual handler closure with injected context.
      return async (opts: { data?: unknown } = {}) =>
        handlerFn({ data: opts.data ?? opts, context: contextStore });
    };
    return builder;
  },
}));

mock.module("@/integrations/supabase/auth-middleware", () => ({
  // The shim ignores middleware entirely; this just satisfies the import.
  requireSupabaseAuth: {
    options: {
      type:   "function",
      server: async ({ next }: { next: () => unknown }) => next(),
    },
  },
}));

// ── Dynamically import the REAL module after mocks are in place ───────────────

type MarketingFns = {
  saveScheduledBroadcast:    (opts: { data: unknown }) => Promise<unknown>;
  listScheduledBroadcasts:   (opts: { data: unknown }) => Promise<unknown>;
  cancelScheduledBroadcast:  (opts: { data: unknown }) => Promise<unknown>;
  markBroadcastSent:         (opts: { data: unknown }) => Promise<unknown>;
  isSchemaMissingError:      (msg: string) => boolean;
  guardSchema:               (error: { message: string }, hint: string) => Error;
};

let fns: MarketingFns;

beforeAll(async () => {
  fns = (await import(
    "@/lib/marketing-template.functions"
  )) as unknown as MarketingFns;
});

// ── Helper — set Supabase context for a test ──────────────────────────────────

function withError(errorMsg: string | null) {
  contextStore.supabase = makeSupabaseStub(errorMsg);
}

// ── Canonical test data ───────────────────────────────────────────────────────

const validSaveData = {
  shopId:         SHOP_ID,
  channel:        "sms" as const,
  body:           "Hello",
  segmentFilter:  "all",
  recipientCount: 10,
  scheduledAt:    new Date().toISOString(),
};

const validListData = { shopId: SHOP_ID };

const validCancelData = { shopId: SHOP_ID, broadcastId: BROADCAST_ID };

const validMarkSentData = { shopId: SHOP_ID, broadcastId: BROADCAST_ID };

// ══════════════════════════════════════════════════════════════════════════════
// saveScheduledBroadcast
// ══════════════════════════════════════════════════════════════════════════════

describe("saveScheduledBroadcast — schema-guard integration", () => {
  it("throws 'Database migration not applied' for a missing-column error", async () => {
    withError(SCHEMA_MISSING_MSG);
    await expect(
      fns.saveScheduledBroadcast({ data: validSaveData }),
    ).rejects.toThrow(SENTINEL);
  });

  it("includes the migration filename in the thrown error", async () => {
    withError(SCHEMA_MISSING_MSG);
    const err = await fns
      .saveScheduledBroadcast({ data: validSaveData })
      .catch((e: Error) => e);
    expect((err as Error).message).toContain(MIGRATION_FILE);
  });

  it("includes the handler hint 'saveScheduledBroadcast' in the error", async () => {
    withError(SCHEMA_MISSING_MSG);
    const err = await fns
      .saveScheduledBroadcast({ data: validSaveData })
      .catch((e: Error) => e);
    expect((err as Error).message).toContain("saveScheduledBroadcast");
  });

  it("also fires for a missing-relation error (table not yet created)", async () => {
    withError(RELATION_MISSING_MSG);
    await expect(
      fns.saveScheduledBroadcast({ data: validSaveData }),
    ).rejects.toThrow(SENTINEL);
  });

  it("mentions the SQL-editor instruction", async () => {
    withError(SCHEMA_MISSING_MSG);
    const err = await fns
      .saveScheduledBroadcast({ data: validSaveData })
      .catch((e: Error) => e);
    expect((err as Error).message).toContain("Supabase SQL editor");
  });

  it("passes through a non-schema error unchanged", async () => {
    withError(PERMISSION_ERR);
    const err = await fns
      .saveScheduledBroadcast({ data: validSaveData })
      .catch((e: Error) => e);
    expect((err as Error).message).toBe(PERMISSION_ERR);
    expect((err as Error).message).not.toContain(SENTINEL);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// listScheduledBroadcasts
// ══════════════════════════════════════════════════════════════════════════════

describe("listScheduledBroadcasts — schema-guard integration", () => {
  it("throws 'Database migration not applied' for a missing-column error", async () => {
    withError(SCHEMA_MISSING_MSG);
    await expect(
      fns.listScheduledBroadcasts({ data: validListData }),
    ).rejects.toThrow(SENTINEL);
  });

  it("includes the migration filename in the thrown error", async () => {
    withError(SCHEMA_MISSING_MSG);
    const err = await fns
      .listScheduledBroadcasts({ data: validListData })
      .catch((e: Error) => e);
    expect((err as Error).message).toContain(MIGRATION_FILE);
  });

  it("includes the handler hint 'listScheduledBroadcasts' in the error", async () => {
    withError(SCHEMA_MISSING_MSG);
    const err = await fns
      .listScheduledBroadcasts({ data: validListData })
      .catch((e: Error) => e);
    expect((err as Error).message).toContain("listScheduledBroadcasts");
  });

  it("also fires for a missing-relation error (table not yet created)", async () => {
    withError(RELATION_MISSING_MSG);
    await expect(
      fns.listScheduledBroadcasts({ data: validListData }),
    ).rejects.toThrow(SENTINEL);
  });

  it("passes through a non-schema error unchanged", async () => {
    withError(PERMISSION_ERR);
    const err = await fns
      .listScheduledBroadcasts({ data: validListData })
      .catch((e: Error) => e);
    expect((err as Error).message).toBe(PERMISSION_ERR);
    expect((err as Error).message).not.toContain(SENTINEL);
  });

  it("returns an empty broadcasts array when no error occurs", async () => {
    withError(null);
    const result = (await fns.listScheduledBroadcasts({
      data: validListData,
    })) as { broadcasts: unknown[] };
    expect(Array.isArray(result.broadcasts)).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// cancelScheduledBroadcast
// ══════════════════════════════════════════════════════════════════════════════

describe("cancelScheduledBroadcast — schema-guard integration", () => {
  it("throws 'Database migration not applied' for a missing-column error", async () => {
    withError(SCHEMA_MISSING_MSG);
    await expect(
      fns.cancelScheduledBroadcast({ data: validCancelData }),
    ).rejects.toThrow(SENTINEL);
  });

  it("includes the migration filename in the thrown error", async () => {
    withError(SCHEMA_MISSING_MSG);
    const err = await fns
      .cancelScheduledBroadcast({ data: validCancelData })
      .catch((e: Error) => e);
    expect((err as Error).message).toContain(MIGRATION_FILE);
  });

  it("includes the handler hint 'cancelScheduledBroadcast' in the error", async () => {
    withError(SCHEMA_MISSING_MSG);
    const err = await fns
      .cancelScheduledBroadcast({ data: validCancelData })
      .catch((e: Error) => e);
    expect((err as Error).message).toContain("cancelScheduledBroadcast");
  });

  it("also fires for a missing-relation error (table not yet created)", async () => {
    withError(RELATION_MISSING_MSG);
    await expect(
      fns.cancelScheduledBroadcast({ data: validCancelData }),
    ).rejects.toThrow(SENTINEL);
  });

  it("instructs the operator to open the SQL editor", async () => {
    withError(SCHEMA_MISSING_MSG);
    const err = await fns
      .cancelScheduledBroadcast({ data: validCancelData })
      .catch((e: Error) => e);
    expect((err as Error).message).toContain("Supabase SQL editor");
  });

  it("passes through a non-schema error unchanged", async () => {
    withError(PERMISSION_ERR);
    const err = await fns
      .cancelScheduledBroadcast({ data: validCancelData })
      .catch((e: Error) => e);
    expect((err as Error).message).toBe(PERMISSION_ERR);
    expect((err as Error).message).not.toContain(SENTINEL);
  });

  it("mentions the pending_migrations.sql fallback in schema-missing errors", async () => {
    withError(SCHEMA_MISSING_MSG);
    const err = await fns
      .cancelScheduledBroadcast({ data: validCancelData })
      .catch((e: Error) => e);
    expect((err as Error).message).toContain("pending_migrations.sql");
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// markBroadcastSent
// ══════════════════════════════════════════════════════════════════════════════

describe("markBroadcastSent — schema-guard integration", () => {
  it("throws 'Database migration not applied' for a missing-column error", async () => {
    withError(SCHEMA_MISSING_MSG);
    await expect(
      fns.markBroadcastSent({ data: validMarkSentData }),
    ).rejects.toThrow(SENTINEL);
  });

  it("includes the migration filename in the thrown error", async () => {
    withError(SCHEMA_MISSING_MSG);
    const err = await fns
      .markBroadcastSent({ data: validMarkSentData })
      .catch((e: Error) => e);
    expect((err as Error).message).toContain(MIGRATION_FILE);
  });

  it("includes the handler hint 'markBroadcastSent' in the error", async () => {
    withError(SCHEMA_MISSING_MSG);
    const err = await fns
      .markBroadcastSent({ data: validMarkSentData })
      .catch((e: Error) => e);
    expect((err as Error).message).toContain("markBroadcastSent");
  });

  it("also fires for a missing-relation error (table not yet created)", async () => {
    withError(RELATION_MISSING_MSG);
    await expect(
      fns.markBroadcastSent({ data: validMarkSentData }),
    ).rejects.toThrow(SENTINEL);
  });

  it("passes through a non-schema error unchanged", async () => {
    withError(PERMISSION_ERR);
    const err = await fns
      .markBroadcastSent({ data: validMarkSentData })
      .catch((e: Error) => e);
    expect((err as Error).message).toBe(PERMISSION_ERR);
    expect((err as Error).message).not.toContain(SENTINEL);
  });

  it("mentions the pending_migrations.sql fallback in schema-missing errors", async () => {
    withError(SCHEMA_MISSING_MSG);
    const err = await fns
      .markBroadcastSent({ data: validMarkSentData })
      .catch((e: Error) => e);
    expect((err as Error).message).toContain("pending_migrations.sql");
  });
});

// ── Cross-handler: Supabase error pattern coverage ────────────────────────────
//
// Confirm the stub values used above match the real error patterns that
// Supabase / Postgres emits, so the tests represent real-world failures.

describe("isSchemaMissingError — Supabase pattern coverage", () => {
  it("recognises the missing-column pattern used in the stubs", async () => {
    expect(fns.isSchemaMissingError(SCHEMA_MISSING_MSG)).toBe(true);
  });

  it("recognises the missing-relation pattern used in the stubs", async () => {
    expect(fns.isSchemaMissingError(RELATION_MISSING_MSG)).toBe(true);
  });

  it("does not flag a permission error as schema-missing", async () => {
    expect(fns.isSchemaMissingError(PERMISSION_ERR)).toBe(false);
  });
});

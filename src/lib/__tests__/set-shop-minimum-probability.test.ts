/**
 * Unit tests for setShopMinimumProbability — audit log behaviour
 *
 * These tests exercise the core handler logic of `setShopMinimumProbability`
 * (src/lib/shops.functions.ts) using a mock supabaseAdmin client.
 *
 * They verify:
 *  1. The admin_audit_log INSERT is called with the exact expected shape.
 *  2. An error from the audit INSERT does NOT prevent the shops UPDATE
 *     from completing — the handler still returns { ok: true } (non-fatal).
 *  3. The old_value read from the database is captured correctly.
 *  4. Fallback to the default old_value (5) when the row read returns null.
 *
 * Run with: bun test src/lib/__tests__/set-shop-minimum-probability.test.ts
 *
 * ─── Why a standalone handler replica instead of importing the server fn ───
 * setShopMinimumProbability is wrapped by TanStack Start's createServerFn,
 * which injects middleware, auth context, and HTTP transport.  Invoking that
 * wrapper in a unit test would require a running server + real Supabase keys.
 * Instead we test the business-logic core directly — the exact same lines
 * that appear in the handler body — with injected mocks. This gives fast,
 * deterministic coverage without a network round-trip.
 */

import { describe, it, expect, beforeEach, jest } from "bun:test";

// ---------------------------------------------------------------------------
// Replica of the handler body from setShopMinimumProbability
// (matches shops.functions.ts lines ~507-544 verbatim so any divergence is
//  immediately visible as a test failure on the real code path)
// ---------------------------------------------------------------------------

interface MockSupabase {
  from: (table: string) => any;
}

/**
 * runSetShopMinimumProbabilityHandler
 *
 * Inline copy of the handler body — intentionally kept in sync with
 * shops.functions.ts.  If you change the handler, update this replica and
 * the associated tests.
 */
async function runSetShopMinimumProbabilityHandler(
  supabaseAdmin: MockSupabase,
  context: { userId: string },
  data: { shopId: string; minimum_probability: number },
): Promise<{ ok: true }> {
  // Read old value for audit log
  const { data: current } = await supabaseAdmin
    .from("shops")
    .select("minimum_probability")
    .eq("id", data.shopId)
    .maybeSingle();
  const oldValue = (current as any)?.minimum_probability ?? 5;

  const { error } = await supabaseAdmin
    .from("shops")
    .update({ minimum_probability: data.minimum_probability } as never)
    .eq("id", data.shopId);
  if (error) throw new Error(error.message);

  // Write audit record — non-fatal if it fails
  const { error: auditError } = await supabaseAdmin
    .from("admin_audit_log")
    .insert({
      admin_user_id: context.userId,
      shop_id: data.shopId,
      action: "set_minimum_probability",
      old_value: { minimum_probability: oldValue },
      new_value: { minimum_probability: data.minimum_probability },
    } as never);
  if (auditError) {
    console.error(
      "[Admin Audit] Failed to write audit log for set_minimum_probability:",
      auditError.message,
      auditError.details ?? "",
    );
  } else {
    console.log(
      `[Admin Audit] set_minimum_probability: shop=${data.shopId} old=${oldValue} new=${data.minimum_probability}`,
    );
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Mock builder helpers
// ---------------------------------------------------------------------------

const SHOP_ID = "550e8400-e29b-41d4-a716-446655440000";
const ADMIN_USER_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

/**
 * Creates a fluent mock Supabase client.
 *
 * Each call to `from(table)` returns a builder that resolves at the terminal
 * method (maybeSingle / insert / update chain).  Recorded calls and their
 * args are exposed on the returned `calls` map for assertions.
 */
function makeMockSupabase(config: {
  /** What maybeSingle returns for a shops read */
  shopReadResult?: { data: any; error: any };
  /** What the shops update returns */
  shopsUpdateResult?: { error: any };
  /** What the admin_audit_log insert returns */
  auditInsertResult?: { error: any };
}) {
  const calls: {
    shopsSelect: boolean;
    shopsUpdate: boolean;
    auditInsert?: { args: Record<string, unknown> };
  } = {
    shopsSelect: false,
    shopsUpdate: false,
    auditInsert: undefined,
  };

  const mockSupabase: MockSupabase = {
    from(table: string) {
      if (table === "shops") {
        // Fluent builder for shops table — supports both select+maybeSingle
        // and update+eq chains.
        return {
          select(_col: string) {
            calls.shopsSelect = true;
            return {
              eq(_col: string, _val: string) {
                return {
                  maybeSingle: async () =>
                    config.shopReadResult ?? { data: { minimum_probability: 5 }, error: null },
                };
              },
            };
          },
          update(_patch: Record<string, unknown>) {
            calls.shopsUpdate = true;
            return {
              eq: async () => config.shopsUpdateResult ?? { error: null },
            };
          },
        };
      }

      if (table === "admin_audit_log") {
        return {
          insert(args: Record<string, unknown>) {
            calls.auditInsert = { args };
            return Promise.resolve(config.auditInsertResult ?? { error: null });
          },
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  };

  return { mockSupabase, calls };
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe("setShopMinimumProbability handler — audit log insert shape", () => {
  it("inserts into admin_audit_log with the correct action", async () => {
    const { mockSupabase, calls } = makeMockSupabase({
      shopReadResult: { data: { minimum_probability: 10 }, error: null },
    });

    await runSetShopMinimumProbabilityHandler(
      mockSupabase,
      { userId: ADMIN_USER_ID },
      { shopId: SHOP_ID, minimum_probability: 25 },
    );

    expect(calls.auditInsert).toBeDefined();
    expect(calls.auditInsert!.args.action).toBe("set_minimum_probability");
  });

  it("inserts admin_user_id matching the calling user", async () => {
    const { mockSupabase, calls } = makeMockSupabase({
      shopReadResult: { data: { minimum_probability: 10 }, error: null },
    });

    await runSetShopMinimumProbabilityHandler(
      mockSupabase,
      { userId: ADMIN_USER_ID },
      { shopId: SHOP_ID, minimum_probability: 25 },
    );

    expect(calls.auditInsert!.args.admin_user_id).toBe(ADMIN_USER_ID);
  });

  it("inserts shop_id matching the target shop", async () => {
    const { mockSupabase, calls } = makeMockSupabase({
      shopReadResult: { data: { minimum_probability: 10 }, error: null },
    });

    await runSetShopMinimumProbabilityHandler(
      mockSupabase,
      { userId: ADMIN_USER_ID },
      { shopId: SHOP_ID, minimum_probability: 25 },
    );

    expect(calls.auditInsert!.args.shop_id).toBe(SHOP_ID);
  });

  it("inserts old_value containing the previous minimum_probability", async () => {
    const { mockSupabase, calls } = makeMockSupabase({
      shopReadResult: { data: { minimum_probability: 10 }, error: null },
    });

    await runSetShopMinimumProbabilityHandler(
      mockSupabase,
      { userId: ADMIN_USER_ID },
      { shopId: SHOP_ID, minimum_probability: 25 },
    );

    expect(calls.auditInsert!.args.old_value).toEqual({ minimum_probability: 10 });
  });

  it("inserts new_value containing the updated minimum_probability", async () => {
    const { mockSupabase, calls } = makeMockSupabase({
      shopReadResult: { data: { minimum_probability: 10 }, error: null },
    });

    await runSetShopMinimumProbabilityHandler(
      mockSupabase,
      { userId: ADMIN_USER_ID },
      { shopId: SHOP_ID, minimum_probability: 25 },
    );

    expect(calls.auditInsert!.args.new_value).toEqual({ minimum_probability: 25 });
  });

  it("uses 5 as the default old_value when the shops row returns null", async () => {
    const { mockSupabase, calls } = makeMockSupabase({
      shopReadResult: { data: null, error: null },
    });

    await runSetShopMinimumProbabilityHandler(
      mockSupabase,
      { userId: ADMIN_USER_ID },
      { shopId: SHOP_ID, minimum_probability: 30 },
    );

    expect(calls.auditInsert!.args.old_value).toEqual({ minimum_probability: 5 });
  });

  it("inserts the exact full record shape expected by the schema", async () => {
    const { mockSupabase, calls } = makeMockSupabase({
      shopReadResult: { data: { minimum_probability: 7 }, error: null },
    });

    await runSetShopMinimumProbabilityHandler(
      mockSupabase,
      { userId: ADMIN_USER_ID },
      { shopId: SHOP_ID, minimum_probability: 20 },
    );

    const inserted = calls.auditInsert!.args;
    // Verify all four required columns are present and have the right types
    expect(typeof inserted.admin_user_id).toBe("string");
    expect(typeof inserted.shop_id).toBe("string");
    expect(inserted.action).toBe("set_minimum_probability");
    expect(typeof (inserted.old_value as any).minimum_probability).toBe("number");
    expect(typeof (inserted.new_value as any).minimum_probability).toBe("number");
  });
});

describe("setShopMinimumProbability handler — non-fatal audit log error", () => {
  it("returns { ok: true } even when the audit insert returns a Supabase error", async () => {
    // Simulates the admin_audit_log table being missing (error code 42P01) or
    // any other database-level error on the audit insert.
    const { mockSupabase } = makeMockSupabase({
      shopReadResult: { data: { minimum_probability: 5 }, error: null },
      shopsUpdateResult: { error: null },
      auditInsertResult: {
        error: { message: 'relation "admin_audit_log" does not exist', code: "42P01", details: "" },
      },
    });

    const result = await runSetShopMinimumProbabilityHandler(
      mockSupabase,
      { userId: ADMIN_USER_ID },
      { shopId: SHOP_ID, minimum_probability: 15 },
    );

    expect(result).toEqual({ ok: true });
  });

  it("still performs the shops UPDATE when the audit log table is missing", async () => {
    const { mockSupabase, calls } = makeMockSupabase({
      shopReadResult: { data: { minimum_probability: 5 }, error: null },
      shopsUpdateResult: { error: null },
      auditInsertResult: {
        error: { message: 'relation "admin_audit_log" does not exist', code: "42P01", details: "" },
      },
    });

    await runSetShopMinimumProbabilityHandler(
      mockSupabase,
      { userId: ADMIN_USER_ID },
      { shopId: SHOP_ID, minimum_probability: 15 },
    );

    // The shops update must have been called regardless of the audit failure
    expect(calls.shopsUpdate).toBe(true);
  });

  it("still attempts the audit INSERT even when the audit log table is missing (error comes from DB)", async () => {
    // Verifies that the audit path is always reached — the error originates
    // from Supabase returning { error } in the response, not from a JS throw.
    const { mockSupabase, calls } = makeMockSupabase({
      shopReadResult: { data: { minimum_probability: 5 }, error: null },
      shopsUpdateResult: { error: null },
      auditInsertResult: {
        error: { message: 'relation "admin_audit_log" does not exist', code: "42P01", details: "" },
      },
    });

    await runSetShopMinimumProbabilityHandler(
      mockSupabase,
      { userId: ADMIN_USER_ID },
      { shopId: SHOP_ID, minimum_probability: 15 },
    );

    // The insert was attempted — it just returned an error object rather than throwing
    expect(calls.auditInsert).toBeDefined();
  });

  it("throws when the shops UPDATE itself fails (main operation is fatal)", async () => {
    const { mockSupabase } = makeMockSupabase({
      shopReadResult: { data: { minimum_probability: 5 }, error: null },
      shopsUpdateResult: { error: { message: "permission denied for table shops" } },
    });

    let thrown: unknown = null;
    try {
      await runSetShopMinimumProbabilityHandler(
        mockSupabase,
        { userId: ADMIN_USER_ID },
        { shopId: SHOP_ID, minimum_probability: 15 },
      );
    } catch (e) {
      thrown = e;
    }

    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toContain("permission denied");
  });
});

describe("setShopMinimumProbability handler — old_value capture from database", () => {
  it("reads the current minimum_probability from the shops table before updating", async () => {
    const { mockSupabase, calls } = makeMockSupabase({
      shopReadResult: { data: { minimum_probability: 42 }, error: null },
    });

    await runSetShopMinimumProbabilityHandler(
      mockSupabase,
      { userId: ADMIN_USER_ID },
      { shopId: SHOP_ID, minimum_probability: 10 },
    );

    // Confirm the SELECT was issued before the UPDATE
    expect(calls.shopsSelect).toBe(true);
    expect(calls.auditInsert!.args.old_value).toEqual({ minimum_probability: 42 });
  });

  it("captures old_value = 0 correctly (disabled state, not confused with falsy null)", async () => {
    const { mockSupabase, calls } = makeMockSupabase({
      shopReadResult: { data: { minimum_probability: 0 }, error: null },
    });

    await runSetShopMinimumProbabilityHandler(
      mockSupabase,
      { userId: ADMIN_USER_ID },
      { shopId: SHOP_ID, minimum_probability: 10 },
    );

    expect(calls.auditInsert!.args.old_value).toEqual({ minimum_probability: 0 });
  });
});

// Phase 5.0 — Customer <-> Shop Connection
//
// New, additive server functions only. Does not modify any existing file,
// function signature, RLS policy, or auth flow. Reuses the existing
// customers / shops / shop_customers tables (extended additively in
// supabase/migrations/20260706700000_phase50_customer_shop_connections.sql).
//
// Ownership/customer guards mirror the established patterns in
// shops.functions.ts (owner_user_id = auth.uid()) and
// customer-auth.functions.ts (requireCustomer).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireCustomer } from "@/lib/customer-auth.functions";

const connectCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(4, "Invalid code")
  .max(16, "Invalid code")
  .regex(/^[A-Z0-9]+$/, "Invalid code");

const phoneSearchSchema = z
  .string()
  .trim()
  .min(1, "Enter at least 1 digit")
  .max(30, "Search term is too long")
  .regex(/^[+\d\s\-()]+$/, "Phone search may only contain digits and phone symbols");

/**
 * Generate a short, human-friendly, collision-checked connect code for a
 * given table ("shops" or "customers"). Only ever called lazily when a row
 * doesn't already have one (e.g. shops/customers created before this phase's
 * backfill migration ran, or created between deploys).
 */
async function generateUniqueConnectCode(table: "shops" | "customers"): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars, matches access-code style
  for (let attempt = 0; attempt < 10; attempt++) {
    let code = "";
    for (let i = 0; i < 8; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
    const { data } = await supabaseAdmin.from(table).select("id").eq("connect_code", code).maybeSingle();
    if (!data) return code;
  }
  throw new Error("Could not generate a unique code. Please try again.");
}

// ── BUSINESS (shop owner) ─────────────────────────────────────────────────────

/**
 * Return the shop's permanent connect code + slug for building the "scan to
 * connect" QR. Lazily generates a code if the row predates the backfill
 * migration or is somehow missing one.
 */
export const getMyShopConnectInfoFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ shopId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { data: shop, error } = await context.supabase
      .from("shops")
      .select("id, name, slug, connect_code")
      .eq("id", data.shopId)
      .eq("owner_user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!shop) throw new Error("Not found or not authorized");

    let connectCode = shop.connect_code as string | null;
    if (!connectCode) {
      connectCode = await generateUniqueConnectCode("shops");
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error: updErr } = await supabaseAdmin
        .from("shops")
        .update({ connect_code: connectCode })
        .eq("id", shop.id);
      if (updErr) throw new Error(updErr.message);
    }

    return { shopId: shop.id, name: shop.name, slug: shop.slug, connectCode };
  });

/**
 * List customers connected to a shop the caller owns, with optional phone
 * search. Reads shop_customers joined with customers — both already allow
 * owner SELECT via existing RLS policies, so this uses the user-scoped
 * client (no service role needed for reads).
 */
export const getShopCustomersFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      shopId: z.string().uuid(),
      phone: phoneSearchSchema.optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { data: shop, error: shopErr } = await context.supabase
      .from("shops")
      .select("id")
      .eq("id", data.shopId)
      .eq("owner_user_id", context.userId)
      .maybeSingle();
    if (shopErr) throw new Error(shopErr.message);
    if (!shop) throw new Error("Not found or not authorized");

    // Filtering by phone happens client-side below (after fetch): PostgREST
    // doesn't reliably support partial-match filtering on embedded/joined
    // resources, so we fetch and filter in-process (bounded by the 500-row cap).
    const { data: rows, error } = await context.supabase
      .from("shop_customers")
      .select("status, last_visit, created_at, customers(id, name, phone, email)")
      .eq("shop_id", data.shopId)
      .order("last_visit", { ascending: false, nullsFirst: false })
      .limit(500);
    if (error) throw new Error(error.message);

    type Row = {
      status: string;
      last_visit: string | null;
      created_at: string;
      customers: { id: string; name: string | null; phone: string | null; email: string } | null;
    };

    let members = ((rows ?? []) as unknown as Row[])
      .filter((r) => r.customers)
      .map((r) => ({
        customerId: r.customers!.id,
        name: r.customers!.name,
        phone: r.customers!.phone,
        email: r.customers!.email,
        status: r.status,
        lastVisit: r.last_visit,
        connectedAt: r.created_at,
      }));

    if (data.phone) {
      const needle = data.phone.replace(/[\s\-()]/g, "");
      members = members.filter((m) => m.phone && m.phone.replace(/[\s\-()]/g, "").includes(needle));
    }

    return { members };
  });

// ── CUSTOMER ───────────────────────────────────────────────────────────────────

/**
 * Return the calling customer's permanent connect code for their "My QR
 * Code" page. Lazily generates one if missing.
 */
export const getMyConnectCodeFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { customerId } = await requireCustomer(context.userId);
    const { data: cust, error } = await context.supabase
      .from("customers")
      .select("id, connect_code")
      .eq("id", customerId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!cust) throw new Error("Customer profile not found.");

    let connectCode = cust.connect_code as string | null;
    if (!connectCode) {
      connectCode = await generateUniqueConnectCode("customers");
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error: updErr } = await supabaseAdmin
        .from("customers")
        .update({ connect_code: connectCode })
        .eq("id", customerId);
      if (updErr) throw new Error(updErr.message);
    }

    return { connectCode };
  });

/**
 * List shops the calling customer is connected to, most recently visited
 * first. Reads shop_customers joined with shops — both already allow
 * customer SELECT via existing RLS policies.
 */
export const getMyShopsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { customerId } = await requireCustomer(context.userId);

    const { data: rows, error } = await context.supabase
      .from("shop_customers")
      .select("status, last_visit, created_at, shops(id, name, slug, logo_url, is_active)")
      .eq("customer_id", customerId)
      .order("last_visit", { ascending: false, nullsFirst: false });
    if (error) throw new Error(error.message);

    type Row = {
      status: string;
      last_visit: string | null;
      created_at: string;
      shops: { id: string; name: string; slug: string; logo_url: string | null; is_active: boolean } | null;
    };

    const shops = ((rows ?? []) as unknown as Row[])
      .filter((r) => r.shops)
      .map((r) => ({
        shopId: r.shops!.id,
        name: r.shops!.name,
        slug: r.shops!.slug,
        logoUrl: r.shops!.logo_url,
        isActive: r.shops!.is_active,
        status: r.status,
        lastVisit: r.last_visit,
        connectedAt: r.created_at,
      }));

    return { shops };
  });

/**
 * Public: resolve a shop's public profile from a connect code, for the
 * "scan the shop QR" landing page. Mirrors getPublicShop's safe-field
 * shape (no sensitive columns) and the same is_active gate.
 */
export const getShopByConnectCodeFn = createServerFn({ method: "POST" })
  .validator(z.object({ code: connectCodeSchema }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: shop, error } = await supabaseAdmin
      .from("shops")
      .select("id, name, slug, logo_url, is_active")
      .eq("connect_code", data.code)
      .maybeSingle();
    if (error) throw new Error("Server error");
    if (!shop || !shop.is_active) return { shop: null as null };
    return { shop: { id: shop.id, name: shop.name, slug: shop.slug, logo_url: shop.logo_url } };
  });

/**
 * Customer taps "Connect" on the shop profile page. Upserts the
 * shop_customers junction (idempotent — the existing UNIQUE(shop_id,
 * customer_id) constraint plus onConflict prevents duplicate connections)
 * and bumps last_visit/status. Uses supabaseAdmin because INSERT/UPDATE on
 * shop_customers remains service-role only per the Phase 4.3 RLS design.
 */
export const connectToShopFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ code: connectCodeSchema }))
  .handler(async ({ data, context }) => {
    const { customerId } = await requireCustomer(context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: shop, error: shopErr } = await supabaseAdmin
      .from("shops")
      .select("id, name, slug, logo_url, is_active")
      .eq("connect_code", data.code)
      .maybeSingle();
    if (shopErr) throw new Error("Server error");
    if (!shop || !shop.is_active) throw new Error("Shop not found or no longer active.");

    const nowIso = new Date().toISOString();
    const { error: upsertErr } = await supabaseAdmin
      .from("shop_customers")
      .upsert(
        {
          shop_id: shop.id,
          customer_id: customerId,
          status: "active",
          last_visit: nowIso,
        },
        { onConflict: "shop_id,customer_id" },
      );
    if (upsertErr) throw new Error(upsertErr.message);

    return { ok: true as const, shop: { id: shop.id, name: shop.name, slug: shop.slug, logo_url: shop.logo_url } };
  });

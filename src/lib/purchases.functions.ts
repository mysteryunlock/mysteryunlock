// Phase 5.1 — Purchase Recording
//
// Additive server functions only. No modifications to existing files,
// function signatures, RLS policies, or DB schema beyond the new
// purchases table in 20260707100000_phase51_purchases.sql.
//
// All writes use supabaseAdmin (service_role) — INSERT/UPDATE/DELETE
// on purchases are not granted to the authenticated role. Ownership and
// customer-connection are always verified server-side before any write.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireCustomer } from "@/lib/customer-auth.functions";

// ── Types ─────────────────────────────────────────────────────────────────────

export type Purchase = {
  id: string;
  shop_id: string;
  shop_name?: string;
  customer_id: string;
  amount: number;
  category: string;
  notes: string | null;
  created_by: string;
  created_at: string;
};

export type CustomerPurchaseStats = {
  lifetimeSpend: number;
  totalPurchases: number;
  avgOrderValue: number;
  lastPurchase: string | null;
  monthlySpend: number;
};

export const PURCHASE_CATEGORIES = [
  "General",
  "Food & Beverage",
  "Retail",
  "Services",
  "Entertainment",
  "Other",
] as const;

// ── Shared helpers ────────────────────────────────────────────────────────────

async function computeStats(shopId: string, customerId: string): Promise<CustomerPurchaseStats> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: rows } = await supabaseAdmin
    .from("purchases")
    .select("amount, created_at")
    .eq("shop_id", shopId)
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  const all = rows ?? [];
  const total = all.reduce((s, r) => s + Number(r.amount), 0);
  const count = all.length;
  const monthStart = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const monthly = all
    .filter((r) => new Date(r.created_at).getTime() >= monthStart)
    .reduce((s, r) => s + Number(r.amount), 0);

  return {
    lifetimeSpend:  total,
    totalPurchases: count,
    avgOrderValue:  count > 0 ? total / count : 0,
    lastPurchase:   all[0]?.created_at ?? null,
    monthlySpend:   monthly,
  };
}

async function assertShopOwner(userId: string, shopId: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("shops")
    .select("id")
    .eq("id", shopId)
    .eq("owner_user_id", userId)
    .maybeSingle();
  if (!data) throw new Error("Forbidden: you do not own this shop.");
}

// ── BUSINESS OWNER ────────────────────────────────────────────────────────────

/**
 * Record a purchase for a connected customer.
 * Updates shop_customers.last_visit and returns updated stats.
 * Throws if the caller does not own the shop or the customer is not connected.
 */
export const recordPurchaseFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      shopId:     z.string().uuid("Invalid shop ID"),
      customerId: z.string().uuid("Invalid customer ID"),
      amount:     z.number().positive("Amount must be greater than zero").max(999999.99, "Amount is too large"),
      category:   z.string().min(1).max(100),
      notes:      z.string().max(500).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    await assertShopOwner(context.userId, data.shopId);

    const { data: conn } = await supabaseAdmin
      .from("shop_customers")
      .select("id")
      .eq("shop_id", data.shopId)
      .eq("customer_id", data.customerId)
      .maybeSingle();
    if (!conn) throw new Error("Customer is not connected to this shop.");

    const { data: purchase, error } = await supabaseAdmin
      .from("purchases")
      .insert({
        shop_id:     data.shopId,
        customer_id: data.customerId,
        amount:      data.amount,
        category:    data.category,
        notes:       data.notes ?? null,
        created_by:  context.userId,
      })
      .select("id, shop_id, customer_id, amount, category, notes, created_by, created_at")
      .single();
    if (error) throw new Error(error.message);

    await supabaseAdmin
      .from("shop_customers")
      .update({ last_visit: new Date().toISOString() })
      .eq("shop_id", data.shopId)
      .eq("customer_id", data.customerId);

    const stats = await computeStats(data.shopId, data.customerId);
    return {
      purchase: { ...purchase, amount: Number(purchase.amount) } as Purchase,
      stats,
    };
  });

/**
 * Get a connected customer's purchase history and lifetime stats for a shop.
 * Business-owner only.
 */
export const getCustomerPurchasesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      shopId:     z.string().uuid(),
      customerId: z.string().uuid(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    await assertShopOwner(context.userId, data.shopId);

    const { data: rows, error } = await supabaseAdmin
      .from("purchases")
      .select("id, shop_id, customer_id, amount, category, notes, created_by, created_at")
      .eq("shop_id", data.shopId)
      .eq("customer_id", data.customerId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);

    const purchases: Purchase[] = (rows ?? []).map((r) => ({
      ...r,
      amount: Number(r.amount),
    }));

    const stats = await computeStats(data.shopId, data.customerId);
    return { purchases, stats };
  });

/**
 * Get only the calculated stats for a customer (no purchase rows).
 * Business-owner only. Useful for displaying KPI cards without fetching history.
 */
export const getCustomerStatsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      shopId:     z.string().uuid(),
      customerId: z.string().uuid(),
    }),
  )
  .handler(async ({ data, context }) => {
    await assertShopOwner(context.userId, data.shopId);
    const stats = await computeStats(data.shopId, data.customerId);
    return { stats };
  });

// ── CUSTOMER ─────────────────────────────────────────────────────────────────

/**
 * Return the calling customer's full purchase history across all shops,
 * with shop names resolved and lifetime stats calculated.
 */
export const getMyPurchasesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { customerId } = await requireCustomer(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows, error } = await supabaseAdmin
      .from("purchases")
      .select("id, shop_id, customer_id, amount, category, notes, created_at")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    const shopIds = [...new Set((rows ?? []).map((r) => r.shop_id))];
    let shopNames: Record<string, string> = {};
    if (shopIds.length > 0) {
      const { data: shops } = await supabaseAdmin
        .from("shops")
        .select("id, name")
        .in("id", shopIds);
      for (const s of shops ?? []) shopNames[s.id] = s.name;
    }

    const purchases: Purchase[] = (rows ?? []).map((r) => ({
      ...r,
      shop_name: shopNames[r.shop_id] ?? r.shop_id,
      amount:    Number(r.amount),
      created_by: "",
    }));

    const total   = purchases.reduce((s, r) => s + r.amount, 0);
    const count   = purchases.length;
    const now     = Date.now();
    const monthly = purchases
      .filter((r) => new Date(r.created_at).getTime() >= now - 30 * 24 * 60 * 60 * 1000)
      .reduce((s, r) => s + r.amount, 0);

    const stats: CustomerPurchaseStats = {
      lifetimeSpend:  total,
      totalPurchases: count,
      avgOrderValue:  count > 0 ? total / count : 0,
      lastPurchase:   purchases[0]?.created_at ?? null,
      monthlySpend:   monthly,
    };

    return { purchases, stats };
  });
